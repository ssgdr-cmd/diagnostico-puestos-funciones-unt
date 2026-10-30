// UNT · recepción sin cuentas individuales, pero con protección del backend.
// La identidad consignada es autodeclarada y requiere contraste institucional posterior.
// Deploy con verify_jwt = false; controles implementados aquí.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE_ORIGIN = 'https://ssgdr-cmd.github.io';
const MAX_BYTES = 200_000;
const cors = {
  'Access-Control-Allow-Origin': SITE_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,apikey',
  'Vary': 'Origin',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};
function respond(body: unknown, status=200) {
  return new Response(JSON.stringify(body), {status, headers:cors});
}
function text(v: unknown) { return typeof v === 'string' ? v.trim() : ''; }
function cap(v: unknown, n=150) { return text(v).slice(0,n); }
function upper(v: unknown,n=150) { return cap(v,n).toLocaleUpperCase('es-PE'); }
async function digest(v: string) {
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function error(msg:string,status=400) { return respond({error:msg},status); }

Deno.serve(async request => {
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST') return error('Método no permitido',405);
  if(request.headers.get('Origin')!==SITE_ORIGIN) return error('Origen no autorizado',403);
  const url=Deno.env.get('SUPABASE_URL');
  const key=Deno.env.get('UNT_DATABASE_SECRET')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret=Deno.env.get('UNT_TURNSTILE_SECRET');
  const salt=Deno.env.get('UNT_RATE_SALT');
  if(!url||!key||!secret||!salt) return error('El servicio institucional aún no está habilitado',503);
  const raw=await request.text();
  if(raw.length>MAX_BYTES) return error('El formulario excede el tamaño permitido',413);
  let body:Record<string,unknown>;
  try {body=JSON.parse(raw);}catch{return error('Contenido no válido');}
  if(!isObj(body))return error('Solicitud incorrecta');
  if(body.website) return error('Solicitud no válida'); // señuelo antiautomatización
  const token=text(body.turnstileToken);
  if(!token) return error('Confirme la verificación de seguridad');
  const ip=(request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,64);
  const form=new FormData(); form.append('secret',secret);form.append('response',token);form.append('remoteip',ip);
  let checked;
  try{const verified=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});checked=await verified.json();}catch{return error('No fue posible completar la verificación de seguridad',503);}
  if(!checked?.success) return error('Verificación vencida o incorrecta. Actualice e intente nuevamente',403);

  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const hourCode='H'+new Date().toISOString().slice(0,13);
  const minuteCode='M'+new Date().toISOString().slice(0,16);
  const hash=await digest(salt+'|'+ip);
  const [{data:perHour,error:e1},{data:perMinute,error:e2}]=await Promise.all([
    db.rpc('intake_count_attempt',{p_key_hash:hash,p_period_code:hourCode}),
    db.rpc('intake_count_attempt',{p_key_hash:hash,p_period_code:minuteCode})
  ]);
  if(e1||e2) return error('Error de control de recepción',503);
  if((perHour??10000)>400||(perMinute??10000)>30) return error('Se ha alcanzado el límite temporal de envíos. Intente más tarde.',429);

  const faculty=text(body.faculty_id);
  const role=text(body.role);
  const profile=body.profile;
  const content=body.content;
  if(!isObj(profile)||!isObj(content)||!['staff','faculty_admin','authority'].includes(role))return error('Formulario no válido');
  if(!/^[a-z]{2,5}$/.test(faculty))return error('Facultad no válida');
  const last=upper(profile.last_names), first=upper(profile.first_names);
  const dni=text(profile.dni), phone=text(profile.phone);
  const job=upper(profile.job_title,200), code=upper(profile.worker_code,60);
  const org=upper(profile.org_unit,250);
  const inst=text(profile.institutional_email).toLowerCase();
  const personal=text(profile.personal_email).toLowerCase();
  const level=upper(profile.education_level,30);
  if(last.length<2||first.length<2||job.length<2||!code||!org)return error('Complete los datos de identificación');
  if(!/^\d{8}$/.test(dni)||!/^\d{9}$/.test(phone))return error('Verifique los números de DNI y celular');
  if(!/^[^\s@]+@unitru\.edu\.pe$/.test(inst)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal))return error('Verifique los correos electrónicos');
  if(!['SECUNDARIA','TÉCNICO','SUPERIOR'].includes(level))return error('Nivel educativo incorrecto');
  if(upper(profile.address,300).length<5)return error('Falta indicar el domicilio');
  if(role==='authority'){
    if(!['DECANATO','ESCUELA','DEPARTAMENTO'].includes(text(profile.authority_scope)))return error('Indique el tipo de autoridad');
    if(text(profile.authority_scope)!=='DECANATO'&&!text(profile.authority_unit))return error('Indique la escuela o departamento académico');
  }
  if(!Array.isArray(profile.academic_titles)||!Array.isArray(profile.academic_grades) || profile.academic_titles.length>40 || profile.academic_grades.length>40)return error('Formación académica no válida');
  if(!Array.isArray(content.functions)||!isObj(content.authority))return error('Información funcional incompleta');
  const functions=content.functions;
  if(role==='staff'||role==='faculty_admin'){
    if(!functions.length||functions.length>35)return error('Indique sus principales funciones');
    let productsCount=0;
    for(const fn of functions){if(!isObj(fn)||text(fn.description).length<5||!Array.isArray(fn.activities)||!fn.activities.length||fn.activities.length>40)return error('Revise las funciones y actividades');
      for(const a of fn.activities){if(!isObj(a)||text(a.description).length<5||!Array.isArray(a.products)||!a.products.length||a.products.length>30)return error('Revise las actividades y los productos');
        for(const p of a.products){productsCount++;if(!isObj(p)||text(p.name).length<3)return error('Complete la denominación de los productos');}
      }
    }
    if(productsCount>400)return error('Demasiados productos en un único registro');
  } else if(functions.length>0) return error('Este módulo solo registra necesidades de la unidad');
  for(const k of ['needs','revisions','outsourcing','difficulties']){
    if(!Array.isArray(content.authority[k])||content.authority[k].length>40)return error('Revise las necesidades de la unidad');
  }
  // Crear una recepción nueva: sin sesión de usuario y sin posibilidad pública de modificar o leer registros.
  const normalized={...profile,last_names:last,first_names:first,dni,phone,address:upper(profile.address,300),
    job_title:job,worker_code:code,org_unit:org,institutional_email:inst,personal_email:personal,
    education_level:level,faculty_id:faculty,role,registration_origin:role==='faculty_admin'?'faculty_admin_direct':'public_form'};
  const receipt=(role==='faculty_admin'?'ADM-':'UNT-'+new Date().getUTCFullYear()+'-')+crypto.randomUUID().slice(0,8).toUpperCase();
  const {data,error:insertError}=await db.from('intake_submissions').insert({
    receipt_code:receipt,faculty_id:faculty,role_at_submission:role==='faculty_admin'?'staff':role,
    owner_name:last+', '+first,worker_code:code,job_title:job,org_unit:org,
    profile:normalized,content,status:'submitted'
  }).select('id').single();
  if(insertError){console.error('intake insertion failed',insertError.code);return error('No pudo almacenarse el registro. Consulte a la URH.',503);}
  return respond({ok:true,id:data.id,receipt});
});
