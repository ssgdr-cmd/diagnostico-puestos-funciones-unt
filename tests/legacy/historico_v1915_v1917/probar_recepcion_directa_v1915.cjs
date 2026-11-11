const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'..','supabase/functions/unt-registros/index.ts'),'utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal(transpiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
let handler, entry;
const profile={last_names:'PEREZ',first_names:'ANA',worker_code:'UNT-2026-TEST',dni:'12345678',phone:'987654321',job_title:'ASISTENTE ADMINISTRATIVA',org_unit:'SECRETARIA ACADEMICA',institutional_email:'prueba@unitru.edu.pe',personal_email:'prueba@example.com',education_level:'SECUNDARIA',address:'TRUJILLO',faculty_id:'fce',role:'staff'};
const content={functions:[{description:'GESTIONAR LOS DOCUMENTOS DE LA FACULTAD',activities:[{description:'RECIBIR Y REGISTRAR DOCUMENTOS',products:[{name:'REGISTROS DOCUMENTARIOS'}]}]}],authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}};
function makeQuery(table){const q={_eqs:[],_insert:null,_update:null,_select:[],select(){return this},eq(k,v){this._eqs.push([k,v]);return this},neq(){return this},in(){return this},limit(){return this},insert(row){entry={...row};return Promise.resolve({data:null,error:null})},update(updates){this._update=updates;return this},async maybeSingle(){if(table==='faculties')return {data:{id:'fce'},error:null};if(table==='intake_submissions'){
const row=this._eqs.some(([k,v])=>k==='id'&&v===entry?.id)?entry:null;
if(this._update){if(!row)return {data:null,error:null};entry={...row,...this._update};return {data:{revision_no:entry.revision_no,status:entry.status,updated_at:entry.updated_at},error:null}}
return {data:row,error:null}
}return {data:null,error:null}},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q}
const db={auth:{getUser:async()=>{throw Error('Anónimo no requiere Auth')}} ,rpc:async()=>({data:1,error:null}),from:makeQuery};
const sandbox={exports:{},require:()=>({createClient:()=>db}),Deno:{env:{get(k){return {UNT_ALLOWED_ORIGINS:'https://ssgdr-cmd.github.io',UNT_DATABASE_SECRET:'secret',SUPABASE_URL:'https://demo.supabase.co',UNT_RATE_SALT:'salt',UNT_REQUIRE_ROSTER:'false'}[k]||null}},serve:f=>handler=f},crypto,TextEncoder,Request,Response,console};
vm.runInNewContext(transpiled.outputText,sandbox,{filename:'unt-registros/index.ts'});
async function api(action,extra={},authorization){const req=new Request('https://demo.supabase.co/functions/v1/unt-registros',{method:'POST',headers:{Origin:'https://ssgdr-cmd.github.io','Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:JSON.stringify({action,...extra})});const response=await handler(req);return {status:response.status,body:await response.json()}}
(async()=>{
 const created=await api('create',{faculty_id:'fce',role:'staff',profile,content});
 assert.equal(created.status,200,JSON.stringify(created));assert.equal(created.body.ok,true);
 assert.equal(entry.verified_user_id,null);
 assert.equal(entry.profile.identity_confirmed,false);
 const args={record_id:created.body.id,editToken:created.body.editToken};
 const retrieved=await api('get',args);assert.equal(retrieved.status,200,JSON.stringify(retrieved));
 const saved=await api('save',{...args,profile,content,revision_no:1});assert.equal(saved.status,200,JSON.stringify(saved));
 const submitted=await api('submit',{...args,profile,content,revision_no:2});assert.equal(submitted.status,200,JSON.stringify(submitted));
 const denied=await api('create',{faculty_id:'fce',role:'faculty_admin',profile:{...profile,worker_code:'ADM-001'},content});
 assert.equal(denied.status,503,'La ficha del administrador requiere padrón institucional activo');
 const malformed=await api('get',{record_id:created.body.id,editToken:'x'});assert.equal(malformed.status,401);
 console.log('OK recepción pública sin OTP: creación, lectura, guardado, presentación; administrador y token inválido bloqueados');
})().catch(e=>{console.error(e);process.exitCode=1});
