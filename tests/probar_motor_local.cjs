const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');const ctx={window:{},console};vm.createContext(ctx);
for(const file of ['redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const engine=ctx.window.UNT_LOCAL_ASSISTANT;
function f(text){return engine.generate({descripcion:text,objetivoDelCampo:'function'})}
const cases=[
 ['Matrícula y asistencia', 'Registro las matrículas de estudiantes y controlo la asistencia del personal administrativo.', 2, /matr[ií]cula/i],
 ['Negación parcial', 'No apruebo documentos, pero recibo y registro las solicitudes que llegan a la facultad.', 1, /documentaci[oó]n/i],
 ['Responsabilidad de terceros', 'Yo reviso los contratos y el jefe firma y aprueba la vinculación.',1,/contractual/i],
 ['Turnos de personal', 'Organizo el rol de turnos del personal de servicio de la facultad.',1,/turnos/i],
 ['Múltiples ámbitos', 'Recibo y registro documentos, controlo la asistencia, limpio oficinas, inventario bienes, registro matrículas, programo turnos.',4,/inventario/i],
];
let count=0;for(const [name,text,min,pattern] of cases){const r=f(text),texts=r.propuestas.map(x=>x.funcion).join(' | ');assert.ok(r.propuestas.length>=min,`${name}: se esperaban ${min} funciones, recibidas ${r.propuestas.length}`);assert.match(texts,pattern,`${name}: falta ámbito`);if(name==='Múltiples ámbitos')assert.ok(r.preguntas.length>=1,'Debe advertir ambigüedad');if(name==='Responsabilidad de terceros')assert.doesNotMatch(texts,/suscrib|firmar|aprobar/i,'No atribuir facultades del jefe');console.log('OK:',name,'—',r.propuestas.length,'funciones');count++;}
console.log(`TOTAL: ${count}/${cases.length} pruebas locales superadas; no sustituye evaluación humana.`);
