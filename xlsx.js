/* Exportación institucional a Excel (.xlsx) con datos detallados; no usa librerías externas. */
window.UNT_XLSX = (() => {
  const e=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const cells=arr=>arr.map((c,i)=>`<c r="${column(i+1)}${arr._row}" t="inlineStr"><is><t xml:space="preserve">${e(c)}</t></is></c>`).join('');
  function column(n){let s='';while(n){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26)}return s;}
  function sheet(rows){return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>${rows.map((r,i)=>{r._row=i+1;return `<row r="${i+1}">${cells(r)}</row>`}).join('')}</sheetData></worksheet>`;}
  function build(records,facName){
    const resumen=[['FACULTAD','CÓDIGO TRABAJADOR','APELLIDOS Y NOMBRES','DNI','PUESTO','UNIDAD DE ORGANIZACIÓN','NÚMERO DE CELULAR','DOMICILIO ACTUAL','CORREO INSTITUCIONAL','CORREO PERSONAL','NIVEL EDUCATIVO','TÍTULOS','GRADOS ACADÉMICOS','TIPO','ESTADO','FUNCIONES','ACTIVIDADES','PRODUCTOS','OBSERVACIONES']];
    const necesidades=[['FACULTAD','AUTORIDAD','CARGO','UNIDAD DE ORGANIZACIÓN','TIPO DE NECESIDAD','NÚMERO','DESCRIPCIÓN / FUNCIÓN','DETALLE / PRODUCTOS','FRECUENCIA / PERIODO','JUSTIFICACIÓN / PROPUESTA']];
    const productos=[['FACULTAD','TRABAJADOR','PUESTO','FUNCIÓN','ACTIVIDAD','PRODUCTO','FRECUENCIA','UNIDAD DE MEDIDA','VOLUMEN HABITUAL','VOLUMEN CRÍTICO','MESES DE MAYOR DEMANDA','INTENSIDAD 1-10','COMPLEJIDAD 1-10','PRIORIDAD 1-10','INICIO','DEPENDENCIA ORIGEN','DEPENDENCIA DESTINO','CAUSAS DE INCREMENTO','OBSERVACIONES']];
    records.forEach(r=>{
      const fns=r.content?.functions||[],act=fns.reduce((n,f)=>n+(f.activities||[]).length,0),pr=fns.reduce((n,f)=>n+(f.activities||[]).reduce((k,a)=>k+(a.products||[]).length,0),0);
      const fac=facName(r.faculty_id);
      const pf=r.profile||{};resumen.push([fac,r.worker_code||'',r.owner_name||'',pf.dni||'',r.job_title||'',r.org_unit||'',pf.phone||'',pf.address||'',pf.institutional_email||'',pf.personal_email||'',pf.education_level||'',(pf.academic_titles||[]).map(x=>x.name).join('; '),(pf.academic_grades||[]).map(x=>x.level+' '+x.name).join('; '),r.role||'',r.status||'',fns.length,act,pr,r.content?.observations||'']);
      for(const [key,label] of [['needs','FUNCIONES NECESARIAS'],['revisions','FUNCIONES POR REVISAR'],['outsourcing','CONTRATACIONES EXTERNAS'],['difficulties','DIFICULTADES']]) { (r.content?.authority?.[key]||[]).forEach((a,i)=>{necesidades.push([fac,r.owner_name||'',r.job_title||'',r.org_unit||'',label,i+1,...[0,1,2,3].map(x=>a[x]||'')]);}); }
      fns.forEach((f,fi)=>(f.activities||[]).forEach((a,ai)=>(a.products||[]).forEach((p,pi)=>{
        productos.push([fac,r.owner_name||'',r.job_title||'',`${fi+1}. ${f.description||''}`,`${fi+1}.${ai+1} ${a.description||''}`,`${fi+1}.${ai+1}.${pi+1} ${p.name||''}`,p.frequency||'',p.unit||'',p.normal??'',p.peak??'',(p.months||[]).join(', '),p.intensity??'',p.complexity??'',p.priority??'',p.origin||'',p.previous_unit||'',p.next_unit||'',p.reason||'',p.notes||'']);
      })));
    });
    const files={
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="RESUMEN" sheetId="1" r:id="rId1"/><sheet name="PRODUCTOS" sheetId="2" r:id="rId2"/><sheet name="NECESIDADES" sheetId="3" r:id="rId3"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml':sheet(resumen),
      'xl/worksheets/sheet2.xml':sheet(productos),
      'xl/worksheets/sheet3.xml':sheet(necesidades)
    };
    return window.UNT_DOCX.pack(files);
  }
  return {build};
})();
