const fs=require('fs'), path=require('path'), assert=require('assert');
const root=path.resolve(__dirname,'..');global.window=global;
eval(fs.readFileSync(path.join(root,'docx.js'),'utf8'));
const example={faculty:'Derecho y Ciencias Políticas',administrator:'ADMINISTRADOR DE PRUEBA',records:[{faculty_checked:true,owner_name:'SERVIDOR FICTICIO',worker_code:'COD-001',job_title:'TÉCNICO ADMINISTRATIVO',org_unit:'DECANATO',receipt_code:'FIC-001',content:{functions:[{description:'GESTIONAR LA INFORMACIÓN',activities:[{description:'REVISAR DOCUMENTOS',products:[{name:'INFORME',indicator:'NÚMERO DE INFORMES',frequency:'MENSUAL',unit:'DOCUMENTOS',normal:'3',peak:'8'}]}]}]}}]};
(async()=>{
const doc=await window.UNT_DOCX.buildOficioFacultad(example).arrayBuffer(); const raw=Buffer.from(doc).toString('utf8');
for(const expected of ['ALBERTO LUIS CAVA CARHUAYO','PRESENTE.-','FUNCIONES, ACTIVIDADES, INDICADORES','GESTIONAR LA INFORMACIÓN','NÚMERO DE INFORMES','REVISADO POR EL ADMINISTRADOR','FIRMA Y SELLO DEL DECANO','EXPEDIENTE SGDUNT','REGISTRO SGDUNT','Año de la Esperanza'])assert(raw.includes(expected),expected);
assert(!raw.includes('ACTA Y RELACIÓN DETALLADA DE CONFORMIDAD FUNCIONAL'));
assert.throws(()=>window.UNT_DOCX.buildOficioFacultad({...example,records:example.records.map(x=>({...x,faculty_checked:false}))}),/pendientes/);
console.log('OFICIO V19.2.2: 12 validaciones superadas.');
})();
