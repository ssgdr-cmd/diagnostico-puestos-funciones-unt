/** UNT V19.3.2: panel privado URH exclusivamente.
 * El administrador de facultad acredita su conformidad por Word firmado,
 * sin crear cuentas digitales ni consultar fichas de terceros.
 */
import {createClient} from 'npm:@supabase/supabase-js@2';
const origins=(Deno.env.get('UNT_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);
const t=(x:unknown)=>typeof x==='string'?x.trim():'';
const pattern=/^[0-9a-f-]{36}$/i;
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origins.includes(req.headers.get('Origin')||'')?{'Access-Control-Allow-Origin':req.headers.get('Origin')||''}:{})}});
const fail=(req:Request,error:string,status=400)=>json(req,{ok:false,error},status);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-retry-count, traceparent, tracestate, baggage','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin',...(origins.includes(req.headers.get('Origin')||'')?{'Access-Control-Allow-Origin':req.headers.get('Origin')||''}:{})}});
 if(req.method!=='POST')return fail(req,'Método no permitido',405);
 if(!origins.includes(req.headers.get('Origin')||''))return fail(req,'Origen no autorizado',403);
 const raw=await req.text();if(raw.length>20000)return fail(req,'Solicitud demasiado extensa',413);
 let b;try{b=JSON.parse(raw)}catch{return fail(req,'Solicitud incorrecta')};if(!b||typeof b!=='object'||Array.isArray(b))return fail(req,'Solicitud incorrecta');
 const faculty=t(b.faculty_id),action=t(b.action);
 if(!/^[a-z]{2,5}$/.test(faculty)||!['list','review','prepare','forward','coverage','issue-link','revoke-link','review-overview','progress'].includes(action))return fail(req,'Operación inválida');
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('UNT_DATABASE_SECRET')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!secret)return fail(req,'Servicio no configurado',503);
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();if(!jwt)return fail(req,'Inicie sesión con correo institucional autorizado.',401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await db.auth.getUser(jwt);
 if(authError||!user||!user.email||!user.email_confirmed_at)return fail(req,'Sesión incorrecta o correo no confirmado.',401);
 const {data:urh}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();const isUrh=urh?.role==='urh_admin';
 if(!isUrh)return fail(req,'Solo la Unidad de Recursos Humanos está autorizada para consultar y validar registros.',403);
 const {data:fac}=await db.from('faculties').select('id').eq('id',faculty).maybeSingle();if(!fac)return fail(req,'Facultad no encontrada',404);
 if(action==='progress'){
   // Solo recuentos agrupados: no se devuelven perfiles o contenido de borradores.
   const {data,error}=await db.rpc('unt_urh_progress_v1930',{p_actor:user.id});
   if(error)return fail(req,'No se pudo consultar la cobertura agregada; verifique la migración V19.3.0',503);
   return json(req,{ok:true,rows:data||[]});
 }
 if(action==='review-overview'){
   const {data,error}=await db.from('unt_faculty_review_checks').select('record_id,faculty_id,checked,reviewed_revision,reviewer_name,notes,checked_at').limit(1500);
   if(error)return fail(req,'No se pudo consultar los vistos buenos de facultad',503);
   return json(req,{ok:true,checks:data||[]});
 }
 if(action==='issue-link'||action==='revoke-link'){
   if(action==='revoke-link'){
     const {error}=await db.from('unt_faculty_review_links').update({active:false}).eq('faculty_id',faculty);
     if(error)return fail(req,'No se pudo revocar el enlace',503);
     return json(req,{ok:true});
   }
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   const token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
   const expires=new Date(Date.now()+30*24*3600*1000).toISOString();
   const {error}=await db.from('unt_faculty_review_links').upsert({faculty_id:faculty,token_hash:digest,active:true,created_by:user.id,created_at:new Date().toISOString(),expires_at:expires,last_used_at:null},{onConflict:'faculty_id'});
   if(error)return fail(req,'No se pudo generar el enlace; compruebe la migración V19.2.1',503);
   return json(req,{ok:true,faculty_id:faculty,review_token:token,expires_at:expires});
 }
 if(action==='coverage'){
   const {data:coverage,error:coverageError}=await db.rpc('unt_faculty_coverage_v1913',{p_faculty:faculty});
   if(coverageError)return fail(req,'No fue posible calcular la cobertura del padrón.',503);
   return json(req,{ok:true,coverage});
 }
 if(action==='list'){
   const [recs,dispatches]=await Promise.all([
     db.from('intake_submissions').select('id,receipt_code,faculty_id,role_at_submission,owner_name,worker_code,job_title,org_unit,profile,content,status,review_note,reviewed_at,created_at,updated_at').eq('faculty_id',faculty).neq('status','draft').order('created_at',{ascending:false}).limit(1500),
     db.from('unt_intake_dispatches').select('*').eq('faculty_id',faculty).order('created_at',{ascending:false}).limit(100)
   ]);
   if(recs.error||dispatches.error)return fail(req,'No fue posible consultar los expedientes',503);
   return json(req,{ok:true,records:recs.data||[],dispatches:dispatches.data||[]});
 }
 if(action==='review'){
   const id=t(b.record_id),decision=t(b.decision),note=t(b.note).slice(0,1400),physical=t(b.physical_reference).slice(0,160);
   if(!pattern.test(id)||!['approve','return'].includes(decision))return fail(req,'Operación de revisión incorrecta');
   if(decision==='return'&&note.length<8)return fail(req,'Describa una observación de al menos ocho caracteres');
   // El backend comprueba documento firmado del personal; las autoridades
   // reportan directamente y URH puede revisar su declaración digital.
   const {data:validated,error:reviewError}=await db.rpc('unt_review_document_v1920',{
     p_record:id,p_faculty:faculty,p_decision:decision,p_note:note,
     p_document_reference:physical,p_actor:user.id
   });
   if(reviewError||validated!==true)return fail(req,reviewError?.message||'No se pudo completar la revisión documental.',409);
   return json(req,{ok:true});
 }
 if(action==='prepare'){
   const partial=b.partial===true,reason=t(b.reason);
   if(partial && (!isUrh || reason.length<20 || reason.length>1500))
     return fail(req,'Solo URH puede preparar remisiones parciales con justificación de al menos 20 caracteres.',403);
   const {data:id,error}=await db.rpc('unt_prepare_dispatch_v1913',{
     p_faculty:faculty,p_actor:user.id,p_partial:partial,p_reason:partial?reason:''
   });
   if(error||!id)return fail(req,error?.message||'No se pudo preparar la remisión; compruebe padrón y fichas pendientes.',409);
   return json(req,{ok:true,id,partial});
 }
 if(action==='forward'){
   const id=t(b.dispatch_id),office=t(b.office_number),physical=t(b.physical_reference);
   if(!pattern.test(id)||office.length<3)return fail(req,'La remisión requiere un oficio válido');
   const {data:dispatch}=await db.from('unt_intake_dispatches').select('id').eq('id',id).eq('faculty_id',faculty).eq('status','prepared').maybeSingle();
   if(!dispatch)return fail(req,'No existe una remisión preparada de esa facultad',403);
   const {error}=await db.rpc('unt_forward_intake_v1913',{p_dispatch:id,p_office:office,p_reference:physical,p_actor:user.id});
   if(error)return fail(req,error.message,409);
   return json(req,{ok:true});
 }
 return fail(req,'Acción desconocida');
});
