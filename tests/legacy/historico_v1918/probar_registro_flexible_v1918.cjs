const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../supabase/functions/unt-registros/index.ts'),'utf8');
const build=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(build.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,'TypeScript errors');
let handler,updates=[];
const dataset={faculties:[{id:'fce'}],intake_submissions:[]};
const db={auth:{getUser:async()=>({error:'No valid session',data:{}})},rpc:async()=>({data:1,error:null}),from(table){const filters=[],exclude=[];let update=null,added=null;return {
 select(){return this},eq(k,v){filters.push([k,v]);return this},neq(k,v){exclude.push([k,v]);return this},in(){return this},limit(){return this},
 insert(o){dataset[table].push(o);return Promise.resolve({data:null,error:null})},
 update(o){update=o;return this},
 maybeSingle(){const found=(dataset[table]||[]).find(r=>filters.every(([k,v])=>r[k]===v)&&exclude.every(([k,v])=>r[k]!==v));if(found&&update){Object.assign(found,update);updates.push(found);return Promise.resolve({data:{revision_no:found.revision_no,status:found.status,updated_at:found.updated_at},error:null})}return Promise.resolve({data:found||null,error:null})},
 then(resolve,reject){return Promise.resolve({data:(dataset[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v)&&exclude.every(([k,v])=>r[k]!==v)),error:null}).then(resolve,reject)}
 }} };
const env={UNT_ALLOWED_ORIGINS:'https://ssgdr-cmd.github.io',UNT_DATABASE_SECRET:'test',SUPABASE_URL:'https://mock.supabase.co',UNT_RATE_SALT:'salt',UNT_REQUIRE_ROSTER:'true'};
const sandbox={exports:{},require:()=>({createClient:()=>db}),Deno:{env:{get:k=>env[k]||null},serve:fn=>handler=fn},crypto,TextEncoder,Request,Response,console};
vm.runInNewContext(build.outputText,sandbox);
async function call(action,extra={},origin='https://ssgdr-cmd.github.io'){
 const request=new Request('https://mock.supabase.co/functions/v1/unt-registros',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
 const response=await handler(request);return {status:response.status,body:await response.json()};
}
const names={staff:'SERVIDOR ADMINISTRATIVO',authority:'DECANO',faculty_admin:'ADMINISTRADOR DE FACULTAD'};
const content=(role)=>role==='authority'?{functions:[],observations:'',authority:{needs:[],revisions:[],outsourcing:[],difficulties:[],no_needs_confirmed:false}}:{functions:[{id:'x',description:'',activities:[{id:'a',description:'',products:[{name:''}]}]}],observations:'',authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}};
const profile=(role,code)=>({last_names:'PEREZ',first_names:'ANA',worker_code:code,faculty_id:'fce',role,requested_role:role,dni:'',phone:'',address:'',job_title:names[role],org_unit:'',institutional_email:'',personal_email:'',education_level:role==='authority'?'':'TÉCNICO',higher_detail:'ADMINISTRACIÓN',academic_grades:[{level:'BACHILLER TÉCNICO',name:'CONTABILIDAD'}],academic_titles:[{type:'TÉCNICO',name:'TÉCNICO EN CONTABILIDAD'}]});
(async()=>{
 for(const role of ['staff','authority','faculty_admin']){
  let p=profile(role,'TEST-'+role);let c=content(role);const create=await call('create',{faculty_id:'fce',role,profile:p,content:c});
  assert.equal(create.status,200,`${role} cannot create: ${JSON.stringify(create.body)}`);
  const id=create.body.id,editToken=create.body.editToken;
  assert.equal((await call('get',{record_id:id,editToken})).status,200,`${role} cannot read its draft`);
  p={...p,education_level:'SUPERIOR',academic_grades:[{level:'BACHILLER',name:'ECONOMÍA'},{level:'MAESTRÍA',name:'GESTIÓN PÚBLICA'}],academic_titles:[{type:'PROFESIONAL',name:'ECONOMISTA'}]};
  let save=await call('save',{record_id:id,editToken,profile:p,content:c,revision_no:1});
  assert.equal(save.status,200,`${role} cannot save educational changes: ${JSON.stringify(save.body)}`);
  const submit=await call('submit',{record_id:id,editToken,profile:p,content:c,revision_no:2});
  assert.equal(submit.status,200,`${role} cannot submit incomplete institutional data: ${JSON.stringify(submit.body)}`);
  const record=dataset.intake_submissions.find(r=>r.id===id);
  assert.equal(record.profile.academic_grades.length,2);
  assert.equal(record.profile.academic_titles[0].name,'ECONOMISTA');
  assert.equal(record.status,'submitted');
  if(role==='faculty_admin')assert(record.receipt_code.startsWith('ADM-'));
  console.log('OK:',role,'create → save → submit; multiple academic grades retained');
 }
 const forbidden=await call('create',{faculty_id:'fce',role:'urh_admin',profile:profile('staff','BAD'),content:content('staff')});assert.equal(forbidden.status,400);
 const origin=await call('create',{faculty_id:'fce',role:'staff',profile:profile('staff','BAD'),content:content('staff')},'https://evil.test');assert.equal(origin.status,403);
 console.log('OK: privileged role cannot self-register, cross-origin blocked');
})().catch(e=>{console.error(e);process.exitCode=1});
