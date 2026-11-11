/** UNT / Recepción directa V19.1.9: seguro para equipos compartidos.
 * Declarantes: sin OTP ni contraseñas. La clave temporal de edición
 * únicamente vive en memoria de la pestaña, nunca en almacenamiento persistente.
 * Revisión/URH: siguen exigiendo autenticación y autorización.
 * Una declaración abierta NO constituye verificación de identidad: la URH debe
 * comprobar el padrón y la titularidad antes de validar información.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
type Body=Record<string,unknown>;
const val=(v:unknown)=>typeof v==='string'?v.trim():'';
const obj=(v:unknown):v is Body=>v!==null && typeof v==='object'&&!Array.isArray(v);
const clamp=(v:unknown,n:number)=>val(v).slice(0,n);
const allowedOrigins=(Deno.env.get('UNT_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);
const alphabet=/^[0-9a-f-]{36}$/i;
function response(req:Request,data:unknown,status=200){
 const origin=req.headers.get('Origin')||'';
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})}});
}
function no(req:Request,reason:string,status=400){return response(req,{ok:false,error:reason},status)}
async function sha256(x:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x));return [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('')}
function randomToken(){const b=crypto.getRandomValues(new Uint8Array(32));return [...b].map(n=>n.toString(16).padStart(2,'0')).join('')}
const validEmail=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const canEdit=(s:string)=>['draft','changes_requested'].includes(s);
const roles=new Set(['staff','authority','faculty_admin']);
function validateProfile(p:Body,strict:boolean){
 if(!strict)return '';
 // El borrador no depende de teléfono, domicilio, nivel educativo, grados,
 // títulos, correo UNITRU o especialidad. La URH contrasta después la declaración.
 // Se mantiene únicamente identificación mínima para poder individualizar la ficha.
 if(!val(p.last_names)||!val(p.first_names)||!val(p.worker_code))
  return 'Indique apellidos, nombres y código de trabajador.';
 return '';
}
function validateContent(c:Body,role:string){
 if(!Array.isArray(c.functions)||!obj(c.authority))return 'La estructura del registro no es válida.';
 // No exigir productos, actividades ni necesidades mínimas durante la declaración.
 // La URH evaluará la suficiencia de la ficha y solicitará subsanaciones.
 for(const key of ['needs','revisions','outsourcing','difficulties']){
  if(!Array.isArray(c.authority[key]))return 'La estructura de necesidades no es válida.';
 }
 return '';
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS'){
  const origin=req.headers.get('Origin')||'';
  return new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-retry-count, traceparent, tracestate, baggage','Vary':'Origin',...(allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})}})
 }
 if(req.method!=='POST')return no(req,'Método no permitido',405);
 if(!allowedOrigins.includes(req.headers.get('Origin')||''))return no(req,'Origen no autorizado',403);
 const key=Deno.env.get('UNT_DATABASE_SECRET')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const url=Deno.env.get('SUPABASE_URL');
 const salt=Deno.env.get('UNT_RATE_SALT');if(!url||!key||!salt)return no(req,'El backend institucional necesita configuración.',503);
 const raw=await req.text();if(raw.length>2000000)return no(req,'La ficha excede el tamaño permitido',413);
 let b:Body;try{b=JSON.parse(raw)}catch{return no(req,'Contenido JSON inválido')};if(!obj(b))return no(req,'Solicitud incorrecta');
 const act=val(b.action);if(!['create','save','submit'].includes(act))return no(req,'Acción no autorizada');
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 // El registro propio es directo; los permisos de revisión de URH se manejan
 // en el servicio independiente unt-faculty-supervised.
 if(act==='create'){
   if(b.website)return no(req,'Solicitud incorrecta');
   const faculty=val(b.faculty_id),role=val(b.role);
   if(!/^[a-z]{2,5}$/.test(faculty)||!roles.has(role)||!obj(b.profile)||!obj(b.content))return no(req,'Complete la identificación antes de crear el borrador');
   const profile=b.profile as Body;const err=validateProfile(profile,true);if(err)return no(req,err);
   const {data:fac}=await db.from('faculties').select('id').eq('id',faculty).maybeSingle();if(!fac)return no(req,'Facultad no encontrada');
   // COBERTURA INSTITUCIONAL (aprox. 350-400 declaraciones):
   // NO limitar por IP pública: múltiples equipos UNITRU pueden compartir NAT.
   // NO limitar por correo: es opcional y su ausencia produciría un límite común.
   // NO limitar globalmente a 120 creaciones/minuto: bloquearía campañas masivas.
   // Solo se evita la repetición automatizada sobre un MISMO código de trabajador.
   // Este control no acredita identidad; la URH verifica las declaraciones.
   const identity=faculty+'|'+val(profile.worker_code).toUpperCase();
   const minute=new Date().toISOString().slice(0,16),hour=minute.slice(0,13);
   const rateHash=await sha256(salt+'|code|'+identity);
   const [m,h]=await Promise.all([
     db.rpc('intake_count_attempt',{p_key_hash:rateHash,p_period_code:'M'+minute}),
     db.rpc('intake_count_attempt',{p_key_hash:rateHash,p_period_code:'H'+hour})
   ]);
   if(m.error||h.error)return no(req,'Control de recepción temporalmente no disponible',503);
   if(Number(m.data)>4||Number(h.data)>24)
     return no(req,'Se registraron varios intentos con este mismo código de trabajador. Comuníquese con la URH.',429);
   // La recepción es libre y no debe quedar bloqueada por padrones incompletos.
   // Un correo o un código DECLARADO no acredita identidad. La revisión y remisión
   // continúan comprobándose contra el padrón en el módulo institucional de URH.
   // El administrador registra su propia ficha sin asumir permisos de revisor.
   const {data:existing}=await db.from('intake_submissions').select('id,status').eq('faculty_id',faculty).eq('worker_code',val(profile.worker_code).toUpperCase()).in('status',['submitted','changes_requested','validated','forwarded']).limit(1);
   if(existing?.length)return no(req,'Ya existe una ficha presentada para este trabajador. La URH debe revisar la duplicidad.',409);
   const token=randomToken(),hash=await sha256(token),id=crypto.randomUUID(),receipt='UNT-'+new Date().getFullYear()+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
   const normalized={...profile,faculty_id:faculty,role,registration_origin:'v19_2_0_conformidad_documental',identity_confirmed:false,education_level:role==='authority'?'SUPERIOR':profile.education_level};
   const {error}=await db.from('intake_submissions').insert({id,receipt_code:role==='faculty_admin'?'ADM-'+receipt:receipt,faculty_id:faculty,role_at_submission:role==='faculty_admin'?'staff':role,owner_name:clamp(profile.last_names,150).toUpperCase()+', '+clamp(profile.first_names,150).toUpperCase(),worker_code:clamp(profile.worker_code,60).toUpperCase(),job_title:clamp(profile.job_title,200),org_unit:clamp(profile.org_unit,200),profile:normalized,content:b.content,status:'draft',edit_token_hash:hash,revision_no:1,verified_user_id:null});
   if(error){console.error('create failed',error.code);return no(req,error.code==='23505'?'Ya existe una ficha del administrador de esta facultad. Solicite acceso a la URH.':'No se pudo guardar el borrador.',error.code==='23505'?409:503)}
   return response(req,{ok:true,id,receipt:role==='faculty_admin'?'ADM-'+receipt:receipt,editToken:token,status:'draft',revision_no:1});
 }
 const id=val(b.record_id),token=val(b.editToken);
 if(!alphabet.test(id)||!/^[0-9a-f]{64}$/i.test(token))return no(req,'El acceso de edición no es válido',401);
 const hash=await sha256(token);
 const {data:row,error:readErr}=await db.from('intake_submissions').select('id,receipt_code,faculty_id,role_at_submission,profile,content,status,revision_no,review_note,updated_at,edit_token_hash,verified_user_id').eq('id',id).eq('edit_token_hash',hash).maybeSingle();
 if(readErr)return no(req,'Error al consultar la ficha',503);
 if(!row)return no(req,'Ficha o acceso no encontrado',403);
 // No existe operación pública para consultar o recuperar fichas guardadas.
 // La clave de edición solo sirve mientras el formulario permanece abierto.
 if(!canEdit(row.status))return no(req,'La ficha ya fue presentada o validada y está bloqueada.',409);
 if(!obj(b.profile)||!obj(b.content))return no(req,'Información de borrador incompleta');
 const profile=b.profile as Body,content=b.content as Body;
 const role=val(row.profile?.role)||'staff';
   if(val(profile.worker_code).toUpperCase()!==val(row.profile?.worker_code).toUpperCase()||
      val(profile.faculty_id)!==row.faculty_id||
      val(profile.role)!==val(row.profile?.role))
     return no(req,'No se puede cambiar el código, la facultad o el perfil de una ficha ya creada. Consulte a URH.',409);
   // Documento y correos se pueden corregir en el borrador por el declarante
   // que conserva el token privado. Su titularidad no se presume verificada.
 if(act==='submit'){
   const ep=validateProfile(profile,true),ec=validateContent(content,role);if(ep||ec)return no(req,ep||ec);
   const {data:duplicates}=await db.from('intake_submissions').select('id').eq('faculty_id',row.faculty_id).eq('worker_code',val(profile.worker_code).toUpperCase()).neq('id',id).in('status',['submitted','changes_requested','validated','forwarded']).limit(1);
   if(duplicates?.length)return no(req,'Ya existe otra ficha con este código de trabajador. Contacte a URH.',409);
 }
 const oldStatus=row.status,version=Number(b.revision_no);
 if(!Number.isInteger(version)||version!==row.revision_no)return no(req,'La ficha ya recibió cambios. Revise la versión actual dentro de esta pestaña.',409);
 const nextStatus=act==='submit'?'submitted':row.status;
 // Control de concurrencia: solo una escritura valida la revision conocida.
 const query=db.from('intake_submissions').update({profile:{...profile,faculty_id:row.faculty_id,role,education_level:role==='authority'?'SUPERIOR':profile.education_level},content,owner_name:clamp(profile.last_names,150).toUpperCase()+', '+clamp(profile.first_names,150).toUpperCase(),job_title:clamp(profile.job_title,200),org_unit:clamp(profile.org_unit,200),updated_at:new Date().toISOString(),status:nextStatus,revision_no:row.revision_no+1,verified_user_id:row.verified_user_id,...(act==='submit'?{submitted_at:new Date().toISOString(),review_note:null}:{})}).eq('id',id).eq('edit_token_hash',hash).eq('revision_no',version).eq('status',oldStatus).select('revision_no,status,updated_at').maybeSingle();
 const {data:updated,error:updateError}=await query;
 if(updateError||!updated)return no(req,'No fue posible guardar esta versión. Revise los datos en la pestaña actual.',409);
 return response(req,{ok:true,receipt:row.receipt_code,id,status:nextStatus,revision_no:updated.revision_no,updated_at:updated.updated_at});
});
