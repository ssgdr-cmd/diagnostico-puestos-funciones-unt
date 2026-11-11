const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=path.join(__dirname,'..');
for(const name of ['unt-registros','unt-faculty-supervised','unt-intake','unt-ai-formulacion']){
 const file=path.join(root,'supabase/functions',name,'index.ts');
 const raw=fs.readFileSync(file,'utf8');
 const result=ts.transpileModule(raw,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 assert.equal(result.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,`${name}: error sintáctico TypeScript`);
 let handler;
 const ctx={exports:{},require:()=>({createClient:()=>{throw Error('No se debe invocar Supabase en OPTIONS')}}),
   Deno:{env:{get:k=>k==='UNT_ALLOWED_ORIGINS'?'https://unt.github.io':null},serve:fn=>{handler=fn}},
   Request,Response,URL,FormData,crypto,TextEncoder,console};
 vm.runInNewContext(result.outputText,ctx,{filename:name});
 assert.equal(typeof handler,'function');
 (async()=>{
  const res=await handler(new Request('https://ejemplo/functions/v1/'+name,{method:'OPTIONS',headers:{Origin:'https://unt.github.io','Access-Control-Request-Headers':'authorization, apikey, content-type'}}));
  assert.equal(res.status,204,`${name}: preflight debe funcionar`);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://unt.github.io');
  assert.match(res.headers.get('Access-Control-Allow-Headers')||'',/authorization/);
  const denied=await handler(new Request('https://ejemplo/functions/v1/'+name,{method:'OPTIONS',headers:{Origin:'https://malicioso.example'}}));
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null,'No abrir CORS a un origen no autorizado');
  if(name==='unt-ai-formulacion'){
    const old=await handler(new Request('https://ejemplo/functions/v1/'+name,{method:'POST',headers:{Origin:'https://unt.github.io'}}));
    assert.equal(old.status,410,'El antiguo endpoint externo debe estar deshabilitado');
  }
  console.log('OK',name,': CORS seguro, sin errores de TypeScript');
 })().catch(e=>{console.error(e);process.exitCode=1});
}
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert.doesNotMatch(app,/unt-ai-formulacion|ai_remote_consent|remoteConsent/,'La interfaz no debe ofrecer IA externa');
const sql=fs.readFileSync(path.join(root,'supabase/migracion_v19_1_1_api_local.sql'),'utf8');
assert.match(sql,/AFTER INSERT OR UPDATE ON public\.intake_submissions/,'Auditoría transaccional');
assert.match(sql,/unt_review_intake_v1911/,'RPC atómico para revisión');
console.log('OK interfaz sin IA externa; migración de auditoría presente');
