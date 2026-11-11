// Ensayo simulado: 400 trabajadores tras la misma IP pública.
// No prueba el rendimiento ni los límites reales de Supabase en producción.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../supabase/functions/unt-registros/index.ts'),'utf8');
const build=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(build.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
assert(!src.includes("['overall',120]"),'Shared overall limit still exists');
assert(!src.includes("keys.push(['ip|"),'Shared IP limit still exists');
assert(!src.includes("'mail|'"),'Shared email limit still exists');
let handler;
const records=[],rates=new Map(),calls=[];
const db={
  rpc:async(name,props)=>{
    if(name!=='intake_count_attempt')return {error:{message:'wrong rpc'}};
    const k=props.p_key_hash+'|'+props.p_period_code;
    const count=(rates.get(k)||0)+1;rates.set(k,count);calls.push(props);
    return {data:count,error:null};
  },
  from(name){
    const filters=[],values=[],notFilters=[]; let update=null;
    const matches=r=>filters.every(([k,v])=>r[k]===v)&&values.every(([k,vs])=>vs.includes(r[k]))&&notFilters.every(([k,v])=>r[k]!==v);
    const q={select(){return this},eq(k,v){filters.push([k,v]);return this},in(k,v){values.push([k,v]);return this},neq(k,v){notFilters.push([k,v]);return this},limit(){return this},update(v){update=v;return this},
      maybeSingle:async()=>({data:name==='faculties'?{id:'fce'}:records.find(matches)||null,error:null}),
      insert:async v=>{if(name!=='intake_submissions')return {error:{message:'unexpected insert'}};records.push(v);return {error:null,data:v}},
      then(ok,fail){const list=name==='intake_submissions'?records.filter(matches):[];return Promise.resolve({data:list,error:null}).then(ok,fail)}
    };return q;
  }
};
const env={UNT_ALLOWED_ORIGINS:'https://ssgdr-cmd.github.io',UNT_DATABASE_SECRET:'mock-only',SUPABASE_URL:'https://mock.supabase.co',UNT_RATE_SALT:'test-salt'};
vm.runInNewContext(build.outputText,{exports:{},require:()=>({createClient:()=>db}),Deno:{env:{get:k=>env[k]||null},serve:fn=>{handler=fn}},crypto,TextEncoder,Request,Response,console});
const content={functions:[],observations:'',authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}};
async function create(code){
 const profile={last_names:'PEREZ',first_names:'PERSONA',worker_code:code,faculty_id:'fce',role:'staff',institutional_email:'',education_level:'SUPERIOR'};
 const req=new Request('https://mock.supabase.co/functions/v1/unt-registros',{method:'POST',headers:{Origin:'https://ssgdr-cmd.github.io','Content-Type':'application/json','x-forwarded-for':'190.0.0.1'},body:JSON.stringify({action:'create',faculty_id:'fce',role:'staff',profile,content})});
 const res=await handler(req);return {code:res.status,body:await res.json()};
}
(async()=>{
 for(let i=1;i<=400;i++){
  const res=await create('UNT-'+String(i).padStart(4,'0'));
  assert.equal(res.code,200,`Staff ${i} blocked: ${JSON.stringify(res.body)}`);
 }
 assert.equal(records.length,400,'Expected 400 drafts');
 console.log('OK: 400 different employees from the SAME IP, with email left blank: all 400 registered in mocked backend.');
 for(let i=1;i<=4;i++)assert.equal((await create('UNT-EXCESO')).code,200);
 assert.equal((await create('UNT-EXCESO')).code,429,'Repeated-code protection missing');
 console.log('OK: repeated requests with the same code still have targeted anti-abuse protection.');
})().catch(e=>{console.error(e);process.exitCode=1});
