/** Prueba de API real V19.3.2 con DB/Fetch simulados. NO toca datos institucionales. */
const fs=require('fs'),assert=require('assert'),vm=require('vm'),ts=require('typescript');
const root=require('path').join(__dirname,'..');
async function buildEdge(name,db,authUser={id:'urh-uid',email:'ssgdr@unitru.edu.pe',email_confirmed_at:'2026-11-01'}){
  let handler;
  const path=`${root}/supabase/functions/${name}/index.ts`;
  const source=fs.readFileSync(path,'utf8').replace(/^import \{createClient\} from 'npm:@supabase\/supabase-js@2';\s*/m,'');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const client={...db,auth:{getUser:async(jwt)=>({data:{user:jwt==='valid-urh'?authUser:null},error:null})}};
  const ctx={Deno:{env:{get:n=>({'UNT_ALLOWED_ORIGINS':'https://ssgdr-cmd.github.io','SUPABASE_URL':'https://example.supabase.co','SUPABASE_SERVICE_ROLE_KEY':'server-key'}[n])},serve:f=>{handler=f}},createClient:()=>client,Response,Request,TextEncoder,Uint8Array,crypto,Date,JSON,Map,Array,Object,String,Number,console};
  vm.runInNewContext(js,ctx,{filename:name+'.js'});
  return handler;
}
class Q{
  constructor(table,fixtures){this.table=table;this.fixtures=fixtures;this.pred=[];}
  select(){return this};eq(key,val){this.pred.push(r=>r[key]===val);return this};gt(key,val){this.pred.push(r=>r[key]>val);return this};
  order(){return this};limit(){return this};maybeSingle(){const r=this.get();return Promise.resolve({data:r[0]||null,error:null})};
  get(){return (this.fixtures[this.table]||[]).filter(r=>this.pred.every(fn=>fn(r)))}
  then(ok,fail){return Promise.resolve({data:this.get(),error:null}).then(ok,fail)}
}
(async()=>{
 const encoder=new TextEncoder();
 const token='a'.repeat(64);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
 const record={id:'11111111-1111-4111-8111-111111111111',receipt_code:'UNT-2026-1',faculty_id:'fce',worker_code:'UNT-002',owner_name:'SERVIDORA PRUEBA',job_title:'ADMINISTRATIVA',org_unit:'SECRETARÍA',role_at_submission:'staff',content:{functions:[{description:'Administrar documentos',activities:[{description:'Recibir y derivar',products:[{name:'Expediente',indicator:'Atendido'}]}]}]},status:'submitted',revision_no:3,updated_at:new Date().toISOString()};
 const fixtures={unt_faculty_review_links:[{faculty_id:'fce',token_hash:hash,active:true,expires_at:'2099-01-01'}],intake_submissions:[record],unt_faculty_review_checks:[{record_id:record.id,faculty_id:'fce',checked:true,reviewed_revision:2,reviewer_name:'REVISOR',notes:'',checked_at:new Date().toISOString()}],profiles:[{id:'urh-uid',role:'urh_admin'}],faculties:[{id:'fce'}]};
 const rpcCalls=[];
 const db={from:t=>new Q(t,fixtures),rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:name.includes('mark')||name.includes('review_document')?true:4,error:null}}};
 const reviewer=await buildEdge('unt-faculty-review',db);
 const call=(h,body,origin='https://ssgdr-cmd.github.io',authorization='')=>h(new Request('https://example.supabase.co/functions/v1',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(authorization?{Authorization:'Bearer '+authorization}:{})},body:JSON.stringify(body)}));
 let res=await call(reviewer,{faculty_id:'fce',review_token:token,action:'list'}),data=await res.json();
 assert.equal(res.status,200);assert.equal(data.records.length,1);assert.equal(data.records[0].faculty_checked,false,'Una versión anterior NO acredita revisión de la ficha actual');
 fixtures.unt_faculty_review_checks[0].reviewed_revision=3;
 res=await call(reviewer,{faculty_id:'fce',review_token:token,action:'list'});data=await res.json();assert.equal(data.records[0].faculty_checked,true);
 res=await call(reviewer,{faculty_id:'fce',review_token:'b'.repeat(64),action:'list'});assert.equal(res.status,403);
 res=await call(reviewer,{faculty_id:'fce',review_token:token,action:'list'},'https://sitio-no-autorizado.test');assert.equal(res.status,403);
 res=await call(reviewer,{faculty_id:'fce',review_token:token,action:'mark',record_id:record.id,reviewer_name:'ADMINISTRADOR PRUEBA',revision_no:3,checked:true});
 assert.equal(res.status,200);assert.equal(rpcCalls.at(-1).name,'unt_faculty_review_mark_v1921');
 res=await call(reviewer,{faculty_id:'fce',review_token:token,action:'save',record_id:record.id,reviewer_name:'ADMINISTRADOR PRUEBA',reason:'Corrección pertinente',revision_no:3,content:record.content});
 assert.equal(res.status,200);assert.equal(rpcCalls.at(-1).name,'unt_faculty_review_save_v1921');
 const urh=await buildEdge('unt-faculty-supervised',db);
 res=await call(urh,{action:'review-overview',faculty_id:'fce'});assert.equal(res.status,401,'Sin JWT no accede a URH');
 res=await call(urh,{action:'review-overview',faculty_id:'fce'},'https://ssgdr-cmd.github.io','valid-urh');assert.equal(res.status,200);data=await res.json();assert.equal(data.checks[0].reviewed_revision,3);
 res=await call(urh,{action:'review',faculty_id:'fce',record_id:record.id,decision:'approve',note:'',physical_reference:'SGDUNT 2026-0008'},'https://ssgdr-cmd.github.io','valid-urh');assert.equal(res.status,200);assert.equal(rpcCalls.at(-1).name,'unt_review_document_v1920');
 console.log('OK: API revisión y URH, origen, token, versión revisada, edición y validación documental simuladas.');
})().catch(e=>{console.error(e);process.exit(1)});
