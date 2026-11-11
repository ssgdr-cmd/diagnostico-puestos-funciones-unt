const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../supabase/functions/unt-registros/index.ts'),'utf8');
const build=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(build.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
let handler;const dataset={faculties:[{id:'fce'}],intake_submissions:[]};
const db={rpc:async()=>({data:1,error:null}),auth:{getUser:async()=>({data:{},error:'not authenticated'})},from(table){let filters=[],excludes=[],oneOf=[],update;
 const eligible=r=>filters.every(([k,v])=>r[k]===v)&&excludes.every(([k,v])=>r[k]!==v)&&oneOf.every(([k,vs])=>vs.includes(r[k]));
 return {select(){return this},eq(k,v){filters.push([k,v]);return this},neq(k,v){excludes.push([k,v]);return this},in(k,vs){oneOf.push([k,vs]);return this},limit(){return this},insert(o){dataset[table].push(o);return Promise.resolve({error:null,data:null})},update(o){update=o;return this},maybeSingle(){const found=(dataset[table]||[]).find(eligible);if(found&&update){Object.assign(found,update);return Promise.resolve({data:found,error:null})}return Promise.resolve({data:found||null,error:null})},then(ok,err){return Promise.resolve({data:(dataset[table]||[]).filter(eligible),error:null}).then(ok,err)}};
}};
const env={UNT_ALLOWED_ORIGINS:'https://ssgdr-cmd.github.io',UNT_DATABASE_SECRET:'test',SUPABASE_URL:'https://mock.supabase.co',UNT_RATE_SALT:'salt'};
const sandbox={exports:{},require:()=>({createClient:()=>db}),Deno:{env:{get:k=>env[k]||null},serve:fn=>handler=fn},crypto,TextEncoder,Request,Response,console};
vm.runInNewContext(build.outputText,sandbox);
async function call(action,extra={}){
 const req=new Request('https://mock.supabase.co/functions/v1/unt-registros',{method:'POST',headers:{Origin:'https://ssgdr-cmd.github.io','Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
 const res=await handler(req);return {status:res.status,body:await res.json()};
}
const profile=(role,code)=>({last_names:'PEREZ',first_names:'ANA',worker_code:code,faculty_id:'fce',role,dni:'',phone:'',education_level:'TÉCNICO'});
const content=(role)=>({functions:[],observations:'',authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}});
(async()=>{
 assert.equal((await call('get',{record_id:'x'})).status,400,'Public recovery removed');
 assert.equal((await call('recover_supervised',{record_id:'x'})).status,400,'Supervised recovery endpoint removed');
 for(const role of ['staff','authority','faculty_admin']){
  const p=profile(role,'TEST-'+role),c=content(role);
  const created=await call('create',{faculty_id:'fce',role,profile:p,content:c});assert.equal(created.status,200,`${role} create failed`);
  const id=created.body.id,editToken=created.body.editToken;
  const save=await call('save',{record_id:id,editToken,profile:p,content:c,revision_no:1});assert.equal(save.status,200,`${role} cannot save`);
  const submit=await call('submit',{record_id:id,editToken,profile:p,content:c,revision_no:2});assert.equal(submit.status,200,`${role} submit failed`);
  assert.equal(dataset.intake_submissions.find(x=>x.id===id).status,'submitted');
  assert.equal((await call('create',{faculty_id:'fce',role,profile:p,content:c})).status,409,'Presented registration duplicated');
  console.log('OK',role,'direct creation → saving → submission, no public recovery');
 }
 const p=profile('staff','ABANDONED-001'),c=content('staff');
 const first=await call('create',{faculty_id:'fce',role:'staff',profile:p,content:c});
 const second=await call('create',{faculty_id:'fce',role:'staff',profile:p,content:c});
 assert.equal(first.status,200);assert.equal(second.status,200,'An interrupted draft cannot block a new one');
 console.log('OK: abandoned draft allows new declaration; presented records remain protected.');
})().catch(e=>{console.error(e);process.exitCode=1});
