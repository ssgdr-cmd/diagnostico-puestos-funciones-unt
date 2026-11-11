const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('typescript');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert(!app.includes('Recepción directa del registro'),'No debe mostrarse el recuadro adicional');
assert(!app.includes('name="keep_on_device"'),'No debe mostrarse la casilla de persistencia');
assert(!app.includes('nueve dígitos'),'El navegador no debe bloquear por teléfono');
assert(app.includes("NÚMERO DE CELULAR (OPCIONAL)"),'El celular se presenta como opcional');

for(const item of ['signInWithOtp','verifyOtp','send-identity-code','identityCodeForm','verify-identity','authSignIn('])assert(!app.includes(item),'El frontend no debe contener '+item);
assert(app.includes('signInWithPassword'),'La revisión debe conservar una cuenta segura prehabilitada');
assert(app.includes("role==='faculty_admin'"));
const src=fs.readFileSync(path.join(root,'supabase/functions/unt-registros/index.ts'),'utf8');
const out=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(out.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
let handler,record;
const profile={last_names:'PEREZ',first_names:'ANA',worker_code:'UNT-TEST-ADM',dni:'12345678',phone:'',job_title:'ADMINISTRADOR DE FACULTAD',org_unit:'ADMINISTRACION',institutional_email:'admin@unitru.edu.pe',personal_email:'personal@example.com',education_level:'SUPERIOR',address:'TRUJILLO',faculty_id:'fce',role:'faculty_admin'};
const content={functions:[{description:'COORDINAR LA ATENCIÓN ADMINISTRATIVA DE LA FACULTAD',activities:[{description:'REGISTRAR Y REVISAR DOCUMENTOS',products:[{name:'EXPEDIENTES VERIFICADOS'}]}]}],authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}};
const data={faculties:[{id:'fce'}],unt_staff_roster:[{faculty_id:'fce',worker_code:profile.worker_code,institutional_email:profile.institutional_email,active:true}],unt_faculty_reviewers:[{faculty_id:'fce',email:profile.institutional_email,active:true}],intake_submissions:[]};
const db={auth:{getUser:async()=>{throw Error('Un declarante anónimo no debe llamar a Auth')}},rpc:async()=>({data:1,error:null}),from(table){const filters=[],exclusions=[];let updater=null;let selected='';return {
 select(fields){selected=fields;return this},eq(k,v){filters.push([k,v]);return this},neq(k,v){exclusions.push([k,v]);return this},in(){return this},limit(){return this},
 insert(row){record={...row};data.intake_submissions.push(record);return Promise.resolve({data:null,error:null})},
 update(obj){updater=obj;return this},
 maybeSingle(){let match=(data[table]||[]).find(r=>filters.every(([k,v])=>r[k]===v)&&exclusions.every(([k,v])=>r[k]!==v));if(updater&&match){Object.assign(match,updater);return Promise.resolve({data:{revision_no:match.revision_no,status:match.status,updated_at:match.updated_at},error:null})}return Promise.resolve({data:match||null,error:null})},
 then(resolve,reject){const found=(data[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v)&&exclusions.every(([k,v])=>r[k]!==v));return Promise.resolve({data:found,error:null}).then(resolve,reject)}
 }} };
const env={UNT_ALLOWED_ORIGINS:'https://ssgdr-cmd.github.io',UNT_DATABASE_SECRET:'server-secret',SUPABASE_URL:'https://sample.supabase.co',UNT_RATE_SALT:'salt',UNT_REQUIRE_ROSTER:'true'};
const sandbox={exports:{},require:()=>({createClient:()=>db}),Deno:{env:{get:k=>env[k]||null},serve:fn=>handler=fn},crypto,TextEncoder,Request,Response,console};
vm.runInNewContext(out.outputText,sandbox);
async function run(action,extra={}){
 const req=new Request('https://sample.supabase.co/functions/v1/unt-registros',{method:'POST',headers:{Origin:'https://ssgdr-cmd.github.io','Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
 const res=await handler(req);return {status:res.status,body:await res.json()};
}
(async()=>{
 const result=await run('create',{faculty_id:'fce',role:'faculty_admin',profile,content});assert.equal(result.status,200,JSON.stringify(result));
 assert(record.receipt_code.startsWith('ADM-'));assert.equal(record.profile.identity_confirmed,false);
 const token=result.body.editToken,id=result.body.id;
 assert.equal((await run('get',{record_id:id,editToken:token})).status,200);
 assert.equal((await run('save',{record_id:id,editToken:token,profile,content,revision_no:1})).status,200);
 assert.equal((await run('submit',{record_id:id,editToken:token,profile,content,revision_no:2})).status,200);
 const d=await run('create',{faculty_id:'fce',role:'faculty_admin',profile:{...profile,worker_code:'NO-EXISTE'},content});
 assert.equal(d.status,403,'Sin padrón no debe admitir al declarante');
 console.log('OK V19.1.7: formulario con teléfono vacío, creación, guardado y envío anónimos');
})().catch(e=>{console.error(e);process.exitCode=1});
