/** UNT V19.3.2: revisión scoped de facultad por enlace único emitido por URH.
 * El enlace no es un acceso público: contiene un secreto de 256 bits y expira.
 * Sin OTP ni contraseñas para los declarantes. Los decanos no aparecen aquí.
 */
import {createClient} from 'npm:@supabase/supabase-js@2';
const origins=(Deno.env.get('UNT_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);
const txt=(v:unknown)=>typeof v==='string'?v.trim():'';
const uuid=/^[0-9a-f-]{36}$/i;
const reply=(req:Request,data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origins.includes(req.headers.get('Origin')||'')?{'Access-Control-Allow-Origin':req.headers.get('Origin')||''}:{})}});
const err=(req:Request,msg:string,status=400)=>reply(req,{ok:false,error:msg},status);
async function hash(token:string){const v=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));return Array.from(v,x=>x.toString(16).padStart(2,'0')).join('');}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin',...(origins.includes(req.headers.get('Origin')||'')?{'Access-Control-Allow-Origin':req.headers.get('Origin')||''}:{})}});
 if(req.method!=='POST')return err(req,'Método no permitido',405);
 if(!origins.includes(req.headers.get('Origin')||''))return err(req,'Origen no autorizado',403);
 const raw=await req.text();if(raw.length>130000)return err(req,'Solicitud demasiado extensa',413);
 let b:Record<string,unknown>;try{b=JSON.parse(raw)}catch{return err(req,'Solicitud inválida')}
 if(!b||typeof b!=='object'||Array.isArray(b))return err(req,'Solicitud inválida');
 const faculty=txt(b.faculty_id),token=txt(b.review_token),action=txt(b.action);
 if(!/^[a-z]{2,5}$/.test(faculty)||!/^[a-f0-9]{64}$/i.test(token)||!['list','save','mark'].includes(action))return err(req,'Enlace de facultad no válido',403);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('UNT_DATABASE_SECRET')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return err(req,'Servicio aún no configurado',503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const digest=await hash(token);
 const {data:permit,error:permitError}=await db.from('unt_faculty_review_links').select('faculty_id').eq('faculty_id',faculty).eq('token_hash',digest).eq('active',true).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(permitError)return err(req,'Es necesario instalar la migración V19.2.1',503);
 if(!permit)return err(req,'El enlace de revisión no es válido, expiró o fue revocado por la URH',403);
 if(action==='list'){
  const [records,checks]=await Promise.all([
   db.from('intake_submissions').select('id,receipt_code,faculty_id,worker_code,owner_name,job_title,org_unit,role_at_submission,content,status,revision_no,updated_at').eq('faculty_id',faculty).eq('role_at_submission','staff').eq('status','submitted').order('owner_name',{ascending:true}).limit(800),
   db.from('unt_faculty_review_checks').select('record_id,checked,reviewed_revision,reviewer_name,notes,checked_at').eq('faculty_id',faculty).limit(800)
  ]);
  if(records.error||checks.error)return err(req,'No se pudo consultar las fichas de esta facultad',503);
  const ck=new Map((checks.data||[]).map(c=>[c.record_id,c]));
  const data=(records.data||[]).map(r=>({...r,faculty_checked:ck.get(r.id)?.checked===true&&Number(ck.get(r.id)?.reviewed_revision)===Number(r.revision_no),faculty_note:ck.get(r.id)?.notes||''}));
  return reply(req,{ok:true,records:data});
 }
 const id=txt(b.record_id),reviewer=txt(b.reviewer_name);
 if(!uuid.test(id)||reviewer.length<5||reviewer.length>150)return err(req,'Identifique al administrador y seleccione una ficha válida');
 if(action==='save'){
  const reason=txt(b.reason),content=b.content;
  if(!content||typeof content!=='object'||Array.isArray(content)||reason.length>1400)return err(req,'Contenido u observación no válidos');
  const {data,error}=await db.rpc('unt_faculty_review_save_v1921',{
   p_record:id,p_faculty:faculty,p_content:content,p_reason:reason,p_reviewer:reviewer,p_revision:Number(b.revision_no)
  });
  if(error)return err(req,error.message,409);
  return reply(req,{ok:true,revision_no:data});
 }
 if(action==='mark'){
  const {data,error}=await db.rpc('unt_faculty_review_mark_v1921',{
   p_record:id,p_faculty:faculty,p_checked:b.checked===true,p_reviewer:reviewer,p_revision:Number(b.revision_no)
  });
  if(error||data!==true)return err(req,error?.message||'No se pudo registrar el visto bueno',409);
  return reply(req,{ok:true});
 }
 return err(req,'Acción inválida');
});
