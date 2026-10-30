/* Proyecto de oficio UNT: Word OOXML sin dependencias externas.
   Arial 11, interlineado 1,5, márgenes 2,54 cm y anexos completos.
   Requiere revisión y firma del Decanato; NO constituye un oficio emitido. */
window.UNT_DOCX = (() => {
  const enc=new TextEncoder();
  const xmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const txt=v=>xmlEscape(String(v??'').trim()||'NO CONSIGNADO');
  function P(text,opt={}){
    const heading=opt.style||'Normal', align=opt.align?`<w:jc w:val="${opt.align}"/>`:'';
    const noBreak=opt.keep?'<w:keepNext/>':'';
    const before=opt.before?`<w:spacing w:before="${opt.before}"/>`:'';
    const br=opt.break?'<w:pageBreakBefore/>':'';
    const after=opt.after??110;
    return `<w:p><w:pPr><w:pStyle w:val="${heading}"/>${align}${noBreak}${br}<w:spacing w:after="${after}" w:line="360" w:lineRule="auto"/>${before}</w:pPr><w:r><w:rPr>${opt.bold?'<w:b/>':''}</w:rPr><w:t xml:space="preserve">${xmlEscape(String(text??''))}</w:t></w:r></w:p>`;
  }
  const C=(val,bold=false,width=1500)=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${bold?'E8EFF9':'FFFFFF'}"/><w:vAlign w:val="center"/></w:tcPr>${P(val,{style:'Normal',bold,after:30,align:'left'})}</w:tc>`;
  const T=(cols,rows,widths)=>`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="D6DFEC"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="65" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="65" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${cols.map((x,i)=>C(x,true,widths[i])).join('')}</w:tr>${rows.map(row=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((x,i)=>C(x,false,widths[i])).join('')}</w:tr>`).join('')}</w:tbl>`;
  function makeDoc(body){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
  function zip(files){const bytes=[];const central=[];let offset=0;const emit=(to,u)=>{to.push(...u)};const u16=(v)=>[v&255,(v>>8)&255];const u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];const tab=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);return c>>>0});const crc32=(array)=>{let c=0xffffffff;for(let b of array)c=tab[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0};
  for(const [name,content] of Object.entries(files)){const fn=enc.encode(name),data=enc.encode(content),crc=crc32(data),len=data.length,local=[...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(len),...u32(len),...u16(fn.length),...u16(0),...fn,...data];emit(bytes,local);const cd=[...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(len),...u32(len),...u16(fn.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...fn];emit(central,cd);offset+=local.length;}
  const count=Object.keys(files).length;const end=[...u32(0x06054b50),...u16(0),...u16(0),...u16(count),...u16(count),...u32(central.length),...u32(bytes.length),...u16(0)];return new Blob([new Uint8Array(bytes),new Uint8Array(central),new Uint8Array(end)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
  const detail=(v,empty='NO CONSIGNADO')=>{if(Array.isArray(v))return v.length?v.join(', '):empty;return (v===0||v)?String(v):empty;};
  function buildOffice(data){
    const faculty=String(data.faculty||'FACULTAD POR PRECISAR').replace(/^FACULTAD DE /i,''), rec=Array.isArray(data.records)?data.records:[];
    const date=data.date||'____ de __________ de 2026', n=rec.length;
    const paras=[
      P('UNIVERSIDAD NACIONAL DE TRUJILLO',{style:'Institution',align:'center',after:0}),
      P('FACULTAD DE '+faculty.toLocaleUpperCase('es-PE'),{style:'Subhead',align:'center',after:90}),
      P('PROYECTO DE OFICIO — BORRADOR SUJETO A REVISIÓN',{style:'Warning',align:'center',after:210}),
      P('Trujillo, '+date,{align:'right',after:110}),
      P('OFICIO N.° '+(data.officeNumber||'[NÚMERO] - [AÑO] / [SIGLAS DE FACULTAD]'),{style:'Subhead',after:75}),
      P('REGISTRO N.° [COMPLETAR]   ·   EXPEDIENTE N.° [COMPLETAR]   ·   FOLIOS [COMPLETAR]',{after:160}),
      P('SEÑOR(A):',{after:40}),
      P('DIRECTOR GENERAL DE ADMINISTRACIÓN',{bold:true,after:40}),
      P('Universidad Nacional de Trujillo',{after:170}),
      P('ASUNTO: Remisión de información del diagnóstico de puestos y funciones del personal administrativo de la Facultad de '+faculty+'.',{bold:true,after:120}),
      P('REFERENCIA: '+(data.tracking||'Pendiente de registro de remisión'),{after:160}),
      P('De mi consideración:',{after:170}),
      P('Me dirijo a usted para remitir la información del diagnóstico de puestos y funciones del personal administrativo de la Facultad de '+faculty+', registrada mediante el aplicativo institucional y revisada por la Administración de Facultad para su análisis técnico.'),
      P('Los anexos contienen la relación del personal y sus registros íntegros de funciones, actividades, productos, frecuencias, volúmenes, periodos de demanda y observaciones, así como las precisiones de las autoridades. Esta información deberá contrastarse con los antecedentes institucionales pertinentes.'),
      P('Se incorpora la relación nominal de '+n+' registro(s), con sus respectivos puestos, dependencias y contenido funcional, para su revisión y posterior trámite.'),
      P('Sin otro particular, hago propicia la ocasión para expresarle mi especial consideración.',{after:70}),
      P('Atentamente,',{after:100}),
      P('________________________________________',{align:'center',after:10}),
      P('DECANO(A) DE LA FACULTAD',{align:'center',bold:true,after:30}),
      P('ANEXO I. RELACIÓN NOMINAL COMPLETA DEL PERSONAL ADMINISTRATIVO',{style:'Subhead',after:130,keep:true,break:true})
    ];
    const rows=rec.map((r,i)=>[String(i+1),detail(r.name)+(String(r.receipt_code||'').startsWith('ADM-')?' [ADMINISTRADOR DE FACULTAD]':''),detail(r.worker_code),detail(r.job_title)+' / '+detail(r.org_unit)]);
    paras.push(T(['N.°','APELLIDOS Y NOMBRES','CÓDIGO','PUESTO / DEPENDENCIA'],rows,[450,2750,1050,3750]));
    paras.push(P('El anexo que sigue reproduce la información funcional remitida digitalmente, conservando su asociación por servidor, función, actividad y producto. Para efectos de autenticidad documental, deberá contrastarse con la versión digital registrada.',{after:150}));
    paras.push(P('ANEXO: INFORMACIÓN FUNCIONAL Y OPERATIVA',{style:'Subhead',after:180,keep:true}));
    rec.forEach((r,i)=>{
      paras.push(P((i+1)+'. '+detail(r.name),{style:'Subhead',after:90,keep:true}));
      paras.push(P('Código de trabajador: '+detail(r.worker_code)+'  |  Puesto: '+detail(r.job_title)));
      paras.push(P('Unidad de organización: '+detail(r.org_unit)+'  |  Facultad: '+faculty));
      const prof=r.profile||{};
      paras.push(P('DNI: '+detail(prof.dni)+'  |  Número de celular: '+detail(prof.phone)));
      paras.push(P('Domicilio actual: '+detail(prof.address)));
      paras.push(P('Correo institucional: '+detail(prof.institutional_email)+'  |  Correo personal: '+detail(prof.personal_email)));
      paras.push(P('Nivel educativo: '+detail(prof.education_level)));
      const titles=Array.isArray(prof.academic_titles)?prof.academic_titles:[];
      const grades=Array.isArray(prof.academic_grades)?prof.academic_grades:[];
      paras.push(P('Títulos: '+(titles.length?titles.map(t=>(t.type?t.type+' - ':'')+detail(t.name)).join('; '):'NO CONSIGNADOS')));
      paras.push(P('Grados académicos: '+(grades.length?grades.map(g=>detail(g.level)+' - '+detail(g.name)).join('; '):'NO CONSIGNADOS')));
      if(prof.authority_scope)paras.push(P('Responsabilidad: '+detail(prof.authority_scope)+'  |  Dependencia académica: '+detail(prof.authority_unit)));
      const content=r.content||{}, fns=content.functions||[];
      fns.forEach((f,fi)=>{
        paras.push(P('FUNCIÓN '+(fi+1)+': '+detail(f.description),{style:'Function',after:100,keep:true}));
        (f.activities||[]).forEach((a,ai)=>{
          paras.push(P('ACTIVIDAD '+(fi+1)+'.'+(ai+1)+': '+detail(a.description),{style:'Activity',after:95,keep:true}));
          (a.products||[]).forEach((v,pi)=>{
            paras.push(P('PRODUCTO '+(fi+1)+'.'+(ai+1)+'.'+(pi+1)+': '+detail(v.name),{bold:true,after:70,keep:true}));
            const blocks=[
              'Periodicidad: '+detail(v.frequency)+'; Unidad de medida: '+detail(v.unit),
              'Volumen habitual: '+detail(v.normal)+'; Volumen en periodo crítico: '+detail(v.peak),
              'Meses de mayor demanda: '+detail(v.months),
              'Intensidad: '+detail(v.intensity)+'/10; Complejidad: '+detail(v.complexity)+'/10; Prioridad: '+detail(v.priority)+'/10',
              'Inicio del trámite: '+detail(({inicia:'EN MI UNIDAD DE ORGANIZACIÓN',continua:'CONTINUIDAD DE OTRA UNIDAD DE ORGANIZACIÓN',independiente:'NO CORRESPONDE A UN TRÁMITE ENCADENADO'})[v.origin]||v.origin)+'; Unidad de organización de procedencia: '+detail(v.previous_unit)+'; Unidad de organización de destino: '+detail(v.next_unit),
              'Causas del incremento de trabajo: '+detail(v.reason),
              'Observaciones del producto: '+detail(v.notes)
            ];
            blocks.forEach(t=>paras.push(P(t,{after:40})));
          });
        });
        if(f.notes)paras.push(P('Precisiones de la función: '+f.notes,{after:110}));
      });
      if(content.observations)paras.push(P('Observaciones adicionales: '+content.observations,{after:120}));
      const authorities=content.authority||{};
      for(const [key,title] of [['needs','Funciones requeridas no atendidas'],['revisions','Funciones o actividades por revisar'],['outsourcing','Servicios externos recurrentes'],['difficulties','Dificultades operativas']]){
        if((authorities[key]||[]).length){paras.push(P(title.toUpperCase(),{style:'Activity'}));(authorities[key]||[]).forEach((item,j)=>{paras.push(P('REGISTRO '+(j+1),{bold:true,after:50}));const labels={needs:['Función requerida','Actividades y productos esperados','Frecuencia y periodo','Motivo de falta de atención'],revisions:['Función o actividad','Situación observada','Frecuencia o alcance','Propuesta de mejora'],outsourcing:['Servicio contratado','Entregables','Periodicidad y continuidad','Justificación o alternativa'],difficulties:['Dificultad','Proceso afectado','Frecuencia e impacto','Medida propuesta']}[key];(Array.isArray(item)?item:[String(item)]).forEach((entry,k)=>paras.push(P((labels[k]||'Detalle')+': '+detail(entry),{after:45})));});}
      }
      if(i<rec.length-1)paras.push(P(' ',{after:170}));
    });
    paras.push(P('La presente versión constituye exclusivamente un proyecto para revisión. El oficio definitivo deberá ser contrastado con la relación nominal y los anexos digitales, suscrito por el Decanato y tramitado por los canales institucionales correspondientes. El archivo Word no constituye por sí mismo constancia de recepción formal.',{after:140}));
    
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="110" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="es-PE"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Institution"><w:name w:val="Institution"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="12377B"/><w:sz w:val="22"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="InstitutionSmall"><w:name w:val="InstitutionSmall"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="51627A"/><w:sz w:val="22"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Subhead"><w:name w:val="Subhead"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="12377B"/><w:sz w:val="22"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Function"><w:name w:val="Function"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="12377B"/><w:sz w:val="22"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Activity"><w:name w:val="Activity"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="0C8F3D"/><w:sz w:val="22"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Warning"><w:name w:val="Warning"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="D8261A"/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`;
    return zip({
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml':makeDoc(paras.join('')),
      'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'word/styles.xml':styles
    });
  }
  return {buildOffice,pack:zip};
})();
