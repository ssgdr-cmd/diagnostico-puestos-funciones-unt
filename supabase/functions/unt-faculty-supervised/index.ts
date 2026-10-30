// UNT · revisión de expedientes de facultad con sesión autorizada de URH.
// No usa claves de facultad. Todas las operaciones con datos personales requieren JWT URH.
// verify_jwt=false porque se valida el JWT con auth.getUser en cada solicitud.
import { createClient } from 'npm:@supabase/supabase-js@2';
const ORIGIN='https://ssgdr-cmd.github.io';
const headers={ 'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Access-Control-Allow-Headers':'apikey,content-type,authorization', 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','Vary':'Origin'};
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers});}
const bad=(message:string,status=400)=>reply({error:message},status);
const val=(v:unknown)=>typeof v==='string'?v.trim():'';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return bad('Método no permitido',405);
 if(req.headers.get('Origin')!==ORIGIN)return bad('Origen no autorizado',403);
 const raw=await req.text();if(raw.length>220000)return bad('Solicitud demasiado extensa',413);
 let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return bad('Solicitud inválida')}
 const faculty=val(body.faculty_id),action=val(body.action);
 if(!['list','review','prepare','forward'].includes(action))return bad('Operación no permitida',400);
 if(!/^[a-z]{2,5}$/.test(faculty))return bad('Facultad no válida',400);
 const jwt=val(req.headers.get('Authorization')).replace(/^Bearer\s+/i,'');
 if(!jwt)return bad('Se requiere sesión URH para consultar o validar registros de terceros',401);
 const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('UNT_DATABASE_SECRET')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return bad('Servicio pendiente de habilitación',503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await db.auth.getUser(jwt);
 if(userError||!user)return bad('Sesión de URH incorrecta o vencida',401);
 const {data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(profileError||profile?.role!=='urh_admin')return bad('Solo la URH autoriza la revisión de expedientes',403);
 const {data:fac}=await db.from('faculties').select('id').eq('id',faculty).maybeSingle();
 if(!fac)return bad('Facultad no encontrada');
 if(action==='list'){
   const [recs,dispatches]=await Promise.all([
     db.from('intake_submissions').select('*').eq('faculty_id',faculty).order('created_at',{ascending:false}).limit(2000),
     db.from('unt_intake_dispatches').select('*').eq('faculty_id',faculty).order('created_at',{ascending:false}).limit(100)
   ]);
   if(recs.error||dispatches.error)return bad('No se pudieron consultar los registros',503);
   return reply({ok:true,records:recs.data||[],dispatches:dispatches.data||[]});
 }
 if(action==='review'){
   const id=val(body.record_id),decision=val(body.decision),note=val(body.note).slice(0,1000);
   if(!/^[0-9a-f-]{36}$/i.test(id)||!['approve','return'].includes(decision))return bad('Revisión incorrecta');
   if(decision==='return'&&note.length<8)return bad('Precise el motivo de observación (mínimo ocho caracteres)');
   const {data:updated,error}=await db.from('intake_submissions').update({
     status:decision==='approve'?'validated':'changes_requested',review_note:note,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()
   }).eq('id',id).eq('faculty_id',faculty).eq('status','submitted').select('id').maybeSingle();
   if(error||!updated)return bad('El registro no está pendiente o no pertenece a su facultad',409);
   return reply({ok:true});
 }
 if(action==='prepare'){
   const {data:own,error:ownError}=await db.from('intake_submissions').select('id,status').eq('faculty_id',faculty).like('receipt_code','ADM-%').maybeSingle();
   if(ownError||!own||own.status!=='validated')return bad('Primero registre y valide la ficha funcional del administrador',409);
   const {data:id,error}=await db.rpc('unt_prepare_intake_dispatch',{p_faculty:faculty});
   if(error)return bad(error.message,409);
   return reply({ok:true,id});
 }
 if(action==='forward'){
   const id=val(body.dispatch_id),office=val(body.office_number),physical=val(body.physical_reference);
   if(!/^[0-9a-f-]{36}$/i.test(id)||office.length<3)return bad('Ingrese el número de oficio y seleccione una remisión válida');
   const {data:dispatch}=await db.from('unt_intake_dispatches').select('id').eq('id',id).eq('faculty_id',faculty).eq('status','prepared').maybeSingle();
   if(!dispatch)return bad('La remisión no pertenece a su facultad o ya fue remitida',403);
   const {error}=await db.rpc('unt_forward_intake_dispatch',{p_dispatch:id,p_office:office,p_reference:physical});
   if(error)return bad(error.message,409);
   return reply({ok:true});
 }
 return bad('Operación no válida',400);
});
