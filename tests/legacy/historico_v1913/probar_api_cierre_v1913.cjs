/* Pruebas deterministas de Edge Functions contra dobles de Supabase.
 * No autentican, migran ni escriben en el proyecto real. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'..');
const calls=[];let handler;
const verified={id:'uid-admin',email:'admin@unitru.edu.pe',email_confirmed_at:'2026-11-03'};
const reviewer={id:'uid-reviewer',email:'revisor@unitru.edu.pe',email_confirmed_at:'2026-11-03'};
const worker={id:'uid-worker',email:'trabajador@unitru.edu.pe',email_confirmed_at:'2026-11-03'};
let allowRecover=true;
function query(table){
 const q={select(){return q},eq(){return q},neq(){return q},in(){return q},like(){return q},order(){return q},limit(){return Promise.resolve({data:[],error:null})},maybeSingle:async()=>({data:table==='profiles'?{role:currentUser?.id==='uid-admin'?'urh_admin':'no'}:table==='faculties'?{id:'fce'}:table==='unt_faculty_reviewers'?{active:true}:table==='unt_intake_dispatches'?{id:'12345678-1234-1234-1234-123456789000'}:null,error:null})};return q;
}
let currentUser=null;
const db={
 auth:{getUser:async jwt=>{currentUser=jwt==='admin'?verified:jwt==='reviewer'?reviewer:jwt==='worker'?worker:null;return {data:{user:currentUser},error:null}}},
 from:query,
 rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='intake_count_attempt')return {data:1,error:null};
  if(name==='unt_recover_with_grant_v1913')return allowRecover?{data:{id:'12345678-1234-1234-1234-123456789000',receipt:'UNT-2026-X',status:'draft'},error:null}:{data:null,error:{message:'Not granted'}};
  if(name==='unt_faculty_coverage_v1913')return {data:{expected:4,completed:2,missing:1,pending:1},error:null};
  if(name==='unt_authorize_recovery_v1913')return {data:true,error:null};
  if(name==='unt_prepare_dispatch_v1913')return {data:'11111111-1111-4111-8111-111111111111',error:null};
  if(name==='unt_forward_intake_v1913')return {data:true,error:null};
  return {data:true,error:null};
 }
};
function build(fn){
 handler=null;
 const src=fs.readFileSync(path.join(root,'supabase','functions',fn,'index.ts'),'utf8');
 const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports:{},require:()=>({createClient:()=>db}),Deno:{env:{get:k=>({UNT_ALLOWED_ORIGINS:'https://praxion.github.io',SUPABASE_URL:'https://mock.supabase.co',UNT_DATABASE_SECRET:'private-test-only',UNT_RATE_SALT:'salt',UNT_REQUIRE_ROSTER:'true'}[k])},serve:fn=>handler=fn},Request,Response,TextEncoder,crypto,console});
 return handler;
}
async function ask(action,person='admin',payload={},fn){
 const req=new Request('https://mock.supabase.co/functions/v1/mock',{method:'POST',headers:{Origin:'https://praxion.github.io','Content-Type':'application/json',...(person?{Authorization:'Bearer '+person}:{})},body:JSON.stringify({action,faculty_id:'fce',...payload})});
 const resp=await fn(req);return {status:resp.status,json:await resp.json()};
}
(async()=>{
 let fn=build('unt-registros');
 assert.equal((await ask('recover_supervised',null,{worker_code:'A-01'},fn)).status,401);
 assert.equal((await ask('recover_supervised','worker',{worker_code:'A-01'},fn)).status,200);
 assert.equal(calls.at(-1).name,'unt_recover_with_grant_v1913');
 allowRecover=false;
 assert.equal((await ask('recover_supervised','worker',{worker_code:'A-01'},fn)).status,403);
 fn=build('unt-faculty-supervised');
 assert.equal((await ask('recovery_authorize','reviewer',{worker_code:'A-01',reason:'Identidad comprobada con documentos físicos por URH'},fn)).status,403);
 assert.equal((await ask('recovery_authorize','admin',{worker_code:'A-01',reason:'Identidad comprobada con documentos físicos por URH'},fn)).status,200);
 assert.equal((await ask('coverage','reviewer',{},fn)).status,200);
 assert.equal((await ask('prepare','reviewer',{partial:true,reason:'Motivo justificado suficientemente largo'},fn)).status,403);
 assert.equal((await ask('prepare','reviewer',{partial:false},fn)).status,200);
 assert.equal((await ask('prepare','admin',{partial:true,reason:'Una remisión parcial autorizada por la unidad de recursos humanos'},fn)).status,200);
 assert.equal(calls.at(-1).name,'unt_prepare_dispatch_v1913');
 assert.equal((await ask('forward','reviewer',{dispatch_id:'12345678-1234-1234-1234-123456789000',office_number:'OFICIO 33'},fn)).status,200);
 assert.equal(calls.at(-1).name,'unt_forward_intake_v1913');
 const sql=fs.readFileSync(path.join(root,'supabase/migracion_v19_1_3_cierre.sql'),'utf8');
 for(const x of ['unt_faculty_coverage_v1913','unt_authorize_recovery_v1913','unt_recover_with_grant_v1913','unt_prepare_dispatch_v1913','unt_forward_intake_v1913'])assert(sql.includes('FUNCTION public.'+x),x);
 assert(sql.includes('Versión anterior deshabilitada'),'Preparación antigua sigue habilitada');
 console.log('OK 11 controles de API simulada: OTP requerido, recuperación autorizada, cobertura, parcial URH y auditoría de remisión');
})().catch(e=>{console.error(e);process.exitCode=1});
