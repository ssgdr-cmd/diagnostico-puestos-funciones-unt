'use strict';
// Genera 4 documentos de muestra con el constructor REAL y comprueba el contenido OOXML.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ctx={window:{},TextEncoder,Blob};
vm.runInNewContext(fs.readFileSync(path.join(root,'docx.js'),'utf8'),ctx);
const base={faculty:'CIENCIAS ECONÓMICAS',date:'03 DE NOVIEMBRE DE 2026',records:[
  {name:'ANA PRUEBA',worker_code:'T-01',job_title:'ASISTENTE ADMINISTRATIVO',org_unit:'DECANATO',
   profile:{dni:'00000000'},content:{functions:[{description:'Gestionar expedientes administrativos',activities:[]}],authority:{}}}
]};
const cases=[
  ['complementaria',{kind:'complementaria',partial:false,previousDispatches:[{tracking_code:'UNT-PREV-001',office_number:'OFICIO 001',items_count:3,forwarded_at:'2026-11-01'}]},['REMISIÓN COMPLEMENTARIA','REMISIONES PREVIAS','UNT-PREV-001','OFICIO 001','FICHAS NUEVAS']],
  ['parcial',{kind:'parcial',partial:true,justification:'Falta de dos fichas por ausencia prolongada'},['REMISIÓN PARCIAL','JUSTIFICACIÓN']],
  ['consolidado',{kind:'consolidado',previousDispatches:[{tracking_code:'UNT-PREV-001',office_number:'OFICIO 001',items_count:3}]},['CONSOLIDADO INTERNO','NO CONSTITUYE NUEVA REMISIÓN','UNT-PREV-001']],
  ['preview',{kind:'preview'},['VISTA PRELIMINAR','NO CONSTITUYE REMISIÓN PREPARADA','PENDIENTES DE REMISIÓN']]
];
(async()=>{
 for(const [kind,opts,checks] of cases){
  const blob=ctx.window.UNT_DOCX.buildOffice({...base,...opts});
  const bytes=Buffer.from(await blob.arrayBuffer());
  assert(bytes.subarray(0,2).equals(Buffer.from('PK')),'Invalid ZIP: '+kind);
  const dest=path.join(root,'tests','__docx_test_'+kind+'.docx');
  fs.writeFileSync(dest,bytes);
  const {execFileSync}=require('node:child_process');
  const xml=execFileSync('unzip',['-p',dest,'word/document.xml'],{encoding:'utf8'});
  for(const text of checks)assert(xml.includes(text),'Missing in '+kind+': '+text);
  fs.unlinkSync(dest);
  console.log('OK Word '+kind+': XML, referencias y alcance correcto');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
