const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const fn=src.slice(src.indexOf('async function saveDraft(silent=false){'),src.indexOf('\nasync function submitDraft(){'));
let respond;let calls=[];const state={recordToken:'token',profile:{worker_code:'001'},submission:{id:'id1',content:{functions:[]},status:'draft'},selectedFaculty:'fce',nav:'registro',revision_no:1,dirty:true,saveBusy:false};
const context={state,console,clearTimeout:()=>{},setTimeout:()=>0,editGeneration:1,activeSave:null,autosaveTimer:null,recordsApi:async(action,b)=>{calls.push(JSON.parse(JSON.stringify(b)));return new Promise(resolve=>{respond=()=>resolve({revision_no:b.revision_no+1,updated_at:'2026-11-03T00:00:00Z'})})},syncFunctionFields:()=>{},isLocked:()=>false,demo:false,notice:()=>{},storeRecovery:()=>{},queueUnsavedChanges:()=>{},JSON,Date};
vm.createContext(context);vm.runInContext(fn+'\n globalThis.doSave=saveDraft;',context);
(async()=>{
 const operation=context.doSave(true);
 await new Promise(r=>setImmediate(r));
 assert.equal(calls.length,1);
 state.submission.content.functions.push({description:'CAMBIO POSTERIOR'});context.editGeneration++;
 respond();const res=await operation;
 assert.equal(res,false,'Un guardado anterior no puede indicar que todo está sincronizado');
 assert.equal(state.dirty,true,'Conservar la marca de cambios pendientes');
 const next=context.doSave(true);await new Promise(r=>setImmediate(r));assert.equal(calls.length,2);assert.equal(calls[1].revision_no,2);respond();assert.equal(await next,true);assert.equal(state.dirty,false);
 console.log('OK: modificaciones durante guardado no se pierden; segunda escritura usa versión actualizada.');
})().catch(e=>{console.error(e);process.exitCode=1});
