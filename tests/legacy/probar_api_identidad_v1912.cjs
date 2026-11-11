'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'supabase/functions/unt-registros/index.ts'),'utf8');
const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let handler;let inserts=0;let lastInserted=null;
const row={id:'12345678-1234-1234-1234-123456789000',receipt_code:'UNT-2026-X',faculty_id:'fce',role_at_submission:'staff',
 status:'draft',edit_token_hash:'TOKEN_HASH',verified_user_id:'uid-good',revision_no:1,
 profile:{role:'staff',institutional_email:'titular@unitru.edu.pe',dni:'12345678',worker_code:'W-100',faculty_id:'fce'},
 content:{functions:[],authority:{}},updated_at:'2026-11-03T12:00:00Z'};
const roster={worker_code:'W-100',institutional_email:'titular@unitru.edu.pe'};
function query(table){
 let selected='';
 const q={
  select(columns){selected=columns||'';return q},eq(){return q},neq(){return q},in(){return q},order(){return q},limit(){return Promise.resolve({data:table==='intake_submissions'&&selected!=='id,status'?[row]:[]})},
  maybeSingle:async()=>({data:table==='faculties'?{id:'fce'}:table==='intake_submissions'?row:table==='unt_staff_roster'?roster:table==='unt_faculty_reviewers'?{active:true}:null,error:null}),
  insert:async data=>{inserts++;lastInserted=data;return {error:null}},
  update:()=>q
 };
 return q;
}
const db={
 auth:{getUser:async jwt=>({data:{user:jwt==='jwt_good'?{id:'uid-good',email:'titular@unitru.edu.pe',email_confirmed_at:'2026-11-03'}:jwt==='jwt_other'?{id:'uid-other',email:'otro@unitru.edu.pe',email_confirmed_at:'2026-11-03'}:{id:'uid-good',email:'titular@unitru.edu.pe',email_confirmed_at:null}},error:null})},
 from:query,rpc:async()=>({data:1,error:null})
};
vm.runInNewContext(js,{
 exports:{},require:()=>({createClient:()=>db}),
 Deno:{env:{get:k=>({UNT_ALLOWED_ORIGINS:'https://app.github.io',SUPABASE_URL:'https://mock.supabase.co',UNT_DATABASE_SECRET:'testonly',UNT_RATE_SALT:'test_salt',UNT_REQUIRE_ROSTER:'true'}[k])},serve:fn=>handler=fn},
 Request,Response,URL,TextEncoder,crypto,console
});
const id='12345678-1234-1234-1234-123456789000',token='a'.repeat(64);
async function request(action,auth,payload={}){
 const headers={Origin:'https://app.github.io','Content-Type':'application/json'};
 if(auth)headers.Authorization='Bearer '+auth;
 const res=await handler(new Request('https://mock.supabase.co/functions/v1/unt-registros',{method:'POST',headers,body:JSON.stringify({action,record_id:id,editToken:token,...payload})}));
 return {status:res.status,data:await res.json()};
}
(async()=>{
 // First security gate must block BEFORE the token is inspected or content is returned.
 assert.equal((await request('get',null)).status,401);
 assert.equal((await request('get','jwt_unconfirmed')).status,401);
 // Token hash in this fake fixture does not match real token: the query stub returns a row;
 // authorization must STILL reject users with different verified emails.
 assert.equal((await request('get','jwt_other')).status,403);
 assert.equal((await request('get','jwt_good')).status,200);
 const profile={...row.profile,institutional_email:'otro@unitru.edu.pe'};
 assert.equal((await request('save','jwt_good',{profile,content:row.content,revision_no:1})).status,409);
 assert.equal(inserts,0,'No debe insertarse un registro por acceso no verificado');
 const badCreate=await request('create','jwt_other',{faculty_id:'fce',role:'staff',profile:{...row.profile,last_names:'RIVERA',first_names:'ANA',job_title:'SECRETARIA',org_unit:'DECANATO',phone:'987654321',personal_email:'x@y.com',address:'TRUJILLO',education_level:'SUPERIOR'},content:row.content});
 assert.equal(badCreate.status,403,'El correo verificado debe coincidir con el perfil');
 const goodProfile={...row.profile,last_names:'RIVERA',first_names:'ANA',job_title:'SECRETARIA',org_unit:'DECANATO',phone:'987654321',personal_email:'x@y.com',address:'TRUJILLO',education_level:'SUPERIOR'};
 const goodCreate=await request('create','jwt_good',{faculty_id:'fce',role:'staff',profile:goodProfile,content:row.content});
 assert.equal(goodCreate.status,200,JSON.stringify(goodCreate));
 assert.equal(inserts,1);
 assert.equal(lastInserted.verified_user_id,'uid-good');
 assert.equal(goodCreate.data.editToken.length,64);
 console.log('OK 7 controles: sesión, correo, recuperación, identidad y alta autenticada');
})().catch(err=>{console.error(err);process.exitCode=1});
