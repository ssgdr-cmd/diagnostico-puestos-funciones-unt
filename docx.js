/* Proyecto de oficio UNT: Word OOXML sin dependencias externas.
   Arial 11, interlineado 1,5, márgenes 2,54 cm y anexos completos.
   Requiere revisión y firma del Decanato; NO constituye un oficio emitido. */
window.UNT_DOCX = (() => {
  const enc=new TextEncoder();
  const xmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const txt=v=>xmlEscape(String(v??'').trim()||'NO CONSIGNADO');
  function P(text,opt={}){
    const heading=opt.style||'Normal', alignment=opt.align||(Number.isFinite(opt.left)?'left':'');
    const align=alignment?`<w:jc w:val="${alignment}"/>`:'';
    const noBreak=(opt.keep?'<w:keepNext/>':'')+'<w:keepLines/>';
    const indentation=(Number.isFinite(opt.left)||Number.isFinite(opt.firstLine))?`<w:ind w:left="${Number.isFinite(opt.left)?opt.left:0}"${Number.isFinite(opt.firstLine)?` w:firstLine="${opt.firstLine}"`:''}/>`:'';
    const br=opt.break?'<w:pageBreakBefore/>':'';
    const after=opt.after??110;
    return `<w:p><w:pPr><w:pStyle w:val="${heading}"/>${align}${noBreak}${br}${indentation}<w:spacing w:after="${after}" w:before="${opt.before||0}" w:line="${opt.line||320}" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${opt.bold?'<w:b/>':''}</w:rPr><w:t xml:space="preserve">${xmlEscape(String(text??''))}</w:t></w:r></w:p>`;
  }
  const C=(val,bold=false,width=1500)=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${bold?'E8EFF9':'FFFFFF'}"/><w:vAlign w:val="center"/></w:tcPr>${P(val,{style:'Normal',bold,after:30,align:'left'})}</w:tc>`;
  const T=(cols,rows,widths)=>`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="D6DFEC"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="65" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="65" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${cols.map((x,i)=>C(x,true,widths[i])).join('')}</w:tr>${rows.map(row=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((x,i)=>C(x,false,widths[i])).join('')}</w:tr>`).join('')}</w:tbl>`;
  function makeDoc(body,header=false){
    const headerReference=header?'<w:headerReference w:type="default" r:id="rId2"/>':'';
    const topMargin=header?'1770':'1440';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr>${headerReference}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${topMargin}" w:right="1440" w:bottom="1050" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
  function zip(files){const bytes=[];const central=[];let offset=0;const emit=(to,u)=>{to.push(...u)};const u16=(v)=>[v&255,(v>>8)&255];const u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];const tab=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);return c>>>0});const crc32=(array)=>{let c=0xffffffff;for(let b of array)c=tab[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0};
  for(const [name,content] of Object.entries(files)){const fn=enc.encode(name),data=enc.encode(content),crc=crc32(data),len=data.length,local=[...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(len),...u32(len),...u16(fn.length),...u16(0),...fn,...data];emit(bytes,local);const cd=[...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(len),...u32(len),...u16(fn.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...fn];emit(central,cd);offset+=local.length;}
  const count=Object.keys(files).length;const end=[...u32(0x06054b50),...u16(0),...u16(0),...u16(count),...u16(count),...u32(central.length),...u32(bytes.length),...u16(0)];return new Blob([new Uint8Array(bytes),new Uint8Array(central),new Uint8Array(end)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
  const detail=(v,empty='NO CONSIGNADO')=>{if(Array.isArray(v))return v.length?v.join(', '):empty;return (v===0||v)?String(v):empty;};
  function buildOffice(data){
    const faculty=String(data.faculty||'FACULTAD POR PRECISAR').replace(/^FACULTAD DE /i,''), rec=Array.isArray(data.records)?data.records:[];
    const date=data.date||'____ de __________ de 2026', n=rec.length;
    const kind=['integral','parcial','complementaria','preview','consolidado'].includes(data.kind)?data.kind:'preview';
    const consolidated=kind==='consolidado', preview=kind==='preview', complementary=kind==='complementaria';
    const previous=Array.isArray(data.previousDispatches)?data.previousDispatches:[];
    const subject=consolidated?'Consolidado interno de consulta de fichas validadas y previamente remitidas'
      :preview?'Proyecto preliminar de fichas validadas, sin remisión preparada'
      :complementary?'Remisión complementaria de fichas validadas pendientes de envío'
      :data.partial?'Remisión parcial excepcional autorizada por la URH'
      :'Remisión integral de fichas validadas';

    const paras=[
      P('UNIVERSIDAD NACIONAL DE TRUJILLO',{style:'Institution',align:'center',after:0}),
      P('FACULTAD DE '+faculty.toLocaleUpperCase('es-PE'),{style:'Subhead',align:'center',after:90}),
      P(consolidated?'CONSOLIDADO INTERNO — NO CONSTITUYE NUEVA REMISIÓN':preview?'VISTA PRELIMINAR — NO CONSTITUYE REMISIÓN PREPARADA':'PROYECTO DE OFICIO — BORRADOR SUJETO A REVISIÓN',{style:'Warning',align:'center',after:210}),
      P('Trujillo, '+date,{align:'right',after:110}),
      P(consolidated?'CONTROL INTERNO DE CONSULTA — SIN NÚMERO DE OFICIO':'OFICIO N.° '+(data.officeNumber||'[NÚMERO] - [AÑO] / [SIGLAS DE FACULTAD]'),{style:'Subhead',after:75}),
      P('REGISTRO N.° [COMPLETAR]   ·   EXPEDIENTE N.° [COMPLETAR]   ·   FOLIOS [COMPLETAR]',{after:160}),
      ...(consolidated?[P('DOCUMENTO INTERNO PARA CONSULTA DE LA URH',{bold:true,after:40})]:[P('SEÑOR(A):',{after:40})]),
      ...(consolidated?[]:[P('DIRECTOR GENERAL DE ADMINISTRACIÓN',{bold:true,after:40})]),
      ...(consolidated?[]:[P('Universidad Nacional de Trujillo',{after:170})]),
      P('ASUNTO: '+subject+' del diagnóstico de puestos y funciones del personal administrativo de la Facultad de '+faculty+'.',{bold:true,after:120}),
      P('REFERENCIA: '+(data.tracking||'Pendiente de registro de remisión'),{after:160}),
      ...(consolidated?[]:[P('De mi consideración:',{after:170})]),
      P(consolidated?'El presente documento reúne únicamente para consulta técnica las fichas validadas y remitidas de la Facultad de '+faculty+'. No constituye una remisión formal adicional, no reemplaza los oficios anteriores ni modifica sus expedientes.':preview?'Se presenta una vista preliminar de fichas validadas de la Facultad de '+faculty+'. No existe aún una remisión preparada para este documento y su relación nominal puede variar al momento de formalizarse.':complementary?'Me dirijo a usted para remitir de manera complementaria las fichas validadas de la Facultad de '+faculty+' que no formaron parte de las remisiones anteriores, relacionadas expresamente en las referencias de este documento.':'Me dirijo a usted para remitir la información del diagnóstico de puestos y funciones del personal administrativo de la Facultad de '+faculty+', registrada mediante el aplicativo institucional y revisada por la Administración de Facultad para su análisis técnico.',{after:60}),
      P('Los anexos contienen la relación del personal y sus registros íntegros de funciones, actividades, productos, frecuencias, volúmenes, periodos de demanda y observaciones, así como las precisiones de las autoridades. Esta información deberá contrastarse con los antecedentes institucionales pertinentes.',{after:60}),
      P('Se incorpora la relación nominal de '+n+' registro(s)'+(complementary?', correspondientes exclusivamente a fichas nuevas aún no remitidas':consolidated?', reunidos para consulta institucional':preview?', todavía sin remisión formal preparada':'' )+', con sus puestos, dependencias y contenido funcional.'),
      ...(complementary?[P('ALCANCE COMPLEMENTARIO: los expedientes incorporados en oficios anteriores no se reproducen como nuevas remisiones. La cobertura total del padrón incluye fichas ya remitidas y fichas de este nuevo envío.',{bold:true,after:110})]:[]),
      ...(consolidated?[P('ADVERTENCIA: el presente consolidado no constituye un nuevo oficio de remisión; la trazabilidad jurídica y documental corresponde a cada remisión formal y a sus anexos originales.',{bold:true,after:120})]:[]),
      ...(preview?[P('ADVERTENCIA: este borrador contiene fichas validadas todavía no vinculadas a una remisión preparada. Descargue el Word de la remisión específica para formalizar el trámite.',{bold:true,after:120})]:[]),
      ...(previous.length?[P('REFERENCIAS DE REMISIONES PREVIAS:',{bold:true,after:80}),...previous.map((r,i)=>P((i+1)+'. '+detail(r.tracking_code)+' · Oficio: '+detail(r.office_number,'PENDIENTE DE IDENTIFICAR')+' · Registros: '+detail(r.items_count)+' · Remisión: '+detail(r.forwarded_at,'SIN FECHA'),{after:50}))]:[]),
      ...(data.partial?[P('REMISIÓN PARCIAL EXCEPCIONAL: La URH autorizó esta remisión sin cobertura completa del padrón. Los trabajadores pendientes no se consideran cumplidos.',{bold:true,after:110}),P('JUSTIFICACIÓN: '+(data.justification||'NO CONSIGNADA'))]:[]),
      ...(data.coverage?[P('CONTROL DE COBERTURA: padrón activo: '+detail(data.coverage.expected)+'; cubiertos: '+detail(data.coverage.completed)+'; sin ficha: '+detail(data.coverage.missing)+'; pendientes: '+detail(data.coverage.pending)+'.')]:[]),
      ...(consolidated?[]:[P('Sin otro particular, hago propicia la ocasión para expresarle mi especial consideración.',{after:30})]),
      ...(consolidated?[]:[P('Atentamente,',{after:30,keep:true})]),
      ...(consolidated?[]:[P('________________________________________',{align:'center',after:10,keep:true})]),
      ...(consolidated?[]:[P('DECANO(A) DE LA FACULTAD',{align:'center',bold:true,after:30})]),
      P(consolidated?'ANEXO I. RELACIÓN DE FICHAS VALIDADAS Y REMITIDAS':complementary?'ANEXO I. FICHAS NUEVAS DE ESTA REMISIÓN COMPLEMENTARIA':preview?'ANEXO I. FICHAS VALIDADAS PENDIENTES DE REMISIÓN':'ANEXO I. RELACIÓN DE FICHAS INCLUIDAS EN ESTA REMISIÓN',{style:'Subhead',after:130,keep:true})
    ];
    const rows=rec.map((r,i)=>[String(i+1),detail(r.name)+(String(r.receipt_code||'').startsWith('ADM-')?' [ADMINISTRADOR DE FACULTAD]':''),detail(r.worker_code),detail(r.job_title)+' / '+detail(r.org_unit)]);
    paras.push(T(['N.°','APELLIDOS Y NOMBRES','CÓDIGO','PUESTO / DEPENDENCIA'],rows,[450,2750,1050,3750]));
    paras.push(P('El anexo que sigue reproduce la información funcional '+(consolidated?'agrupada para consulta':preview?'validada y pendiente de remisión':'incluida en esta remisión')+', conservando su asociación por servidor, función, actividad y producto. Deberá contrastarse con la versión digital registrada.',{after:150}));
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
    paras.push(P(consolidated?'El presente archivo constituye un consolidado interno de consulta, no un oficio ni una nueva remisión. Para acreditar cada envío deben consultarse los documentos originales y sus cargos.':'La presente versión constituye exclusivamente un proyecto para revisión. El oficio definitivo deberá ser contrastado con la relación nominal y los anexos digitales, suscrito por el Decanato y tramitado por los canales institucionales correspondientes. El archivo Word no constituye por sí mismo constancia de recepción formal.',{after:140}));
    
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
  // Oficio individual: manifestaciones del servidor dirigidas al Decanato.
  // No incorpora conformidad administrativa ni verificación de URH.
  const fichaStyles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="115" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:lang w:val="es-PE"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Institution"><w:name w:val="Institution"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="12377B"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subhead"><w:name w:val="Subhead"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="12377B"/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`;
  function fileFromParas(paras,headerLines=[]){
    const hasHeader=Array.isArray(headerLines)&&headerLines.length>0;
    const header=hasHeader?`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${headerLines.map((line,i)=>P(line,{style:i===0?'Institution':'Normal',bold:i===1,align:'center',after:i===2?75:20,line:260})).join('')}</w:hdr>`:'';
    const files={
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'+(hasHeader?'<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>':'')+'</Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml':makeDoc(paras.join(''),hasHeader),
      'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+(hasHeader?'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>':'')+'</Relationships>',
      'word/styles.xml':fichaStyles
    };
    if(hasHeader)files['word/header1.xml']=header;
    return zip(files);
  }
  function buildFicha(data){
    const p=data.profile||{},c=data.content||{},authority=data.role==='authority';
    const facultyDisplay=String(data.faculty||'').replace(/^FACULTAD DE /i,'');
    const institution='FACULTAD DE '+facultyDisplay.toLocaleUpperCase('es-PE');
    const year='“Año de la Esperanza y el Fortalecimiento de la Democracia”';
    const header=['UNIVERSIDAD NACIONAL DE TRUJILLO',institution,year];
    const names=[p.first_names,p.last_names].filter(Boolean).map(String).join(' ').trim()||'___________________________________';
    const q=[];
    if(authority){
      // Informe de autoridades; no se dirige a la propia persona que ostenta el Decanato.
      q.push(P('Trujillo, ____ de ______________ de 2026',{align:'right',after:150}));
      q.push(P('INFORME DE NECESIDADES DE LA UNIDAD',{style:'Subhead',after:125}));
      q.push(P('DECLARANTE: '+names,{after:70}));
      q.push(P('CARGO: '+detail(p.job_title)+'  ·  UNIDAD: '+detail(p.org_unit),{after:145}));
      q.push(P('I. DATOS GENERALES',{style:'Subhead',keep:true,after:80}));
    }else{
      q.push(P('Trujillo, ____ de ______________ de 2026',{align:'right',after:130}));
      q.push(P('OFICIO N.° ________-2026-UNT/'+String(data.facultyCode||'________').toLocaleUpperCase('es-PE'),{bold:true,after:150}));
      q.push(P('SEÑOR(A):',{bold:true,after:30}));
      q.push(P('DECANO(A) DE LA '+institution,{bold:true,after:35}));
      q.push(P('UNIVERSIDAD NACIONAL DE TRUJILLO',{after:35}));
      q.push(P('PRESENTE.-',{bold:true,after:165}));
      q.push(P('ASUNTO: Comunicación de funciones, actividades, indicadores y productos que declaro desempeñar.',{bold:true,after:160}));
      q.push(P('De mi consideración:',{after:110}));
      q.push(P('Tengo el agrado de dirigirme a usted para comunicar la información referida a las funciones y actividades que manifiesto realizar en la '+institution+', así como los productos e indicadores asociados a dichas labores, según lo consignado en el aplicativo institucional de diagnóstico de puestos y funciones.',{left:0,firstLine:450,after:120}));
      q.push(P('A continuación, presento la identificación de mi puesto y el detalle de las labores declaradas, para conocimiento del Decanato y la revisión administrativa que corresponda.',{left:0,firstLine:450,after:175}));
      q.push(P('I. INFORMACIÓN DEL SERVIDOR',{style:'Subhead',keep:true,after:80}));
    }
    q.push(P('Apellidos y nombres: '+names,{left:180,after:55}));
    q.push(P('Código de trabajador: '+detail(p.worker_code)+'  ·  DNI: '+detail(p.dni),{left:180,after:55}));
    q.push(P('Puesto o cargo: '+detail(p.job_title),{left:180,after:55}));
    q.push(P('Unidad de organización: '+detail(p.org_unit),{left:180,after:55}));
    if(authority)q.push(P('Ámbito de responsabilidad: '+detail(p.authority_scope)+'  ·  Escuela o departamento: '+detail(p.authority_unit),{left:180,after:55}));
    q.push(P('Nivel educativo: '+(authority?'SUPERIOR / UNIVERSITARIO':detail(p.education_level))+'  ·  Especialidad: '+detail(p.higher_detail),{left:180,after:55}));
    q.push(P('Grados declarados: '+(Array.isArray(p.academic_grades)&&p.academic_grades.length?p.academic_grades.map(x=>detail(x.level)+' en '+detail(x.name)).join('; '):'No consignados'),{left:180,after:55}));
    q.push(P('Títulos declarados: '+(Array.isArray(p.academic_titles)&&p.academic_titles.length?p.academic_titles.map(x=>detail(x.type)+': '+detail(x.name)).join('; '):'No consignados'),{left:180,after:145}));
    q.push(P(authority?'II. NECESIDADES Y SITUACIÓN DE LA UNIDAD':'II. DETALLE DE FUNCIONES, ACTIVIDADES, INDICADORES Y PRODUCTOS',{style:'Subhead',keep:true,after:100}));
    if(authority){
      const categories=[['needs','Necesidades no atendidas',['Función requerida','Actividades o productos','Frecuencia','Motivo']],['revisions','Actividades o procedimientos por revisar',['Actividad','Situación','Alcance','Propuesta']],['outsourcing','Servicios externos',['Servicio','Entregables','Periodicidad','Justificación']],['difficulties','Dificultades de gestión',['Dificultad','Proceso','Impacto','Mejora']]];
      for(const [key,label,headings] of categories){
        q.push(P(label.toUpperCase(),{style:'Subhead',left:180,after:75,keep:true}));
        const rows=Array.isArray(c.authority?.[key])?c.authority[key]:[];
        if(!rows.length){q.push(P('No se registraron casos en este apartado.',{left:400,after:70}));continue;}
        rows.forEach((arr,i)=>{q.push(P('Registro '+(i+1),{bold:true,left:350,after:35,keep:true}));(arr||[]).forEach((v,j)=>q.push(P((headings[j]||'Detalle')+': '+detail(v),{left:560,after:50})));});
      }
    }else{
      const functions=Array.isArray(c.functions)?c.functions:[];
      if(!functions.length)q.push(P('No se consignaron funciones.',{left:240}));
      functions.forEach((f,i)=>{
        q.push(P((i+1)+'. FUNCIÓN: '+detail(f.description),{style:'Subhead',left:210,after:65,keep:true}));
        if(f.notes)q.push(P('Precisiones: '+detail(f.notes),{left:400,after:60}));
        const acts=Array.isArray(f.activities)?f.activities:[];
        acts.forEach((a,j)=>{
          q.push(P((i+1)+'.'+(j+1)+'. Actividad: '+detail(a.description),{bold:true,left:420,after:50,keep:true}));
          const products=Array.isArray(a.products)?a.products:[];
          products.forEach((v,k)=>{
            q.push(P((i+1)+'.'+(j+1)+'.'+(k+1)+'. Producto o entregable: '+detail(v.name),{bold:true,left:740,after:45,keep:true}));
            q.push(P('Indicador declarado: '+detail(v.indicator,'No consignado'),{left:960,after:40,keep:true}));
            q.push(P('Frecuencia: '+detail(v.frequency,'No consignada')+'  ·  Tipo: '+detail(v.product_type,'No consignado')+'  ·  Unidad de medida: '+detail(v.unit,'No consignada'),{left:960,after:45}));
            q.push(P('Volumen habitual: '+detail(v.normal,'No consignado')+'  ·  Volumen crítico: '+detail(v.peak,'No consignado')+'  ·  Meses de demanda: '+detail(v.months,'No consignados'),{left:960,after:45}));
            q.push(P('Intensidad: '+detail(v.intensity)+'/10  ·  Complejidad: '+detail(v.complexity)+'/10  ·  Prioridad: '+detail(v.priority)+'/10',{left:960,after:45}));
            if(v.origin||v.previous_unit||v.next_unit)q.push(P('Origen: '+detail(v.origin)+'  ·  Unidad anterior: '+detail(v.previous_unit)+'  ·  Unidad posterior: '+detail(v.next_unit),{left:960,after:50}));
            if(v.reason)q.push(P('Motivo de aumento de trabajo: '+detail(v.reason),{left:960,after:50}));
            if(v.notes)q.push(P('Observaciones: '+detail(v.notes),{left:960,after:60}));
          });
        });
      });
    }
    if(c.observations)q.push(P('Observaciones generales: '+detail(c.observations),{left:180,before:80,after:140}));
    if(authority){
      q.push(P('III. DECLARACIÓN',{style:'Subhead',keep:true,after:110}));
      q.push(P('La información precedente corresponde a las necesidades y situaciones comunicadas por la persona declarante.',{left:0,firstLine:450,after:180}));
    }else{
      q.push(P('III. COMUNICACIÓN FINAL',{style:'Subhead',keep:true,after:100}));
      q.push(P('La presente comunicación recoge las labores que declaro desempeñar y se presenta para conocimiento de su despacho, sin que implique, por sí misma, modificación de mi puesto o de las funciones formalmente asignadas.',{left:0,firstLine:450,after:130}));
      q.push(P('Sin otro particular, hago propicia la ocasión para expresarle las muestras de mi especial consideración.',{left:0,firstLine:450,after:160}));
      q.push(P('Atentamente,',{after:200}));
    }
    q.push(P('______________________________________',{align:'center',after:25,keep:true}));
    q.push(P(names,{align:'center',bold:true,after:25,keep:true}));
    q.push(P(authority?'FIRMA DE LA AUTORIDAD DECLARANTE':'FIRMA DEL SERVIDOR(A) DECLARANTE',{align:'center',after:90}));
    return fileFromParas(q,header);
  }
  function buildActaConformidad(data){
    const rows=Array.isArray(data.rows)?data.rows:[];
    const q=[P('UNIVERSIDAD NACIONAL DE TRUJILLO',{style:'Institution',align:'center'}),P('FACULTAD DE '+String(data.faculty||'').replace(/^FACULTAD DE /i,'').toLocaleUpperCase('es-PE'),{align:'center'}),P('ACTA DE CONFORMIDAD DOCUMENTAL',{style:'Institution',align:'center',after:180}),
    P('N.° de acta: ______________________   Fecha: __________________'),P('Administrador de facultad: '+detail(data.administrator,'___________________________________')),
    P('Mediante la presente se deja constancia de la revisión de las fichas impresas de diagnóstico funcional relacionadas a continuación, contrastadas con las actividades y productos declarados. La conformidad se perfecciona con la firma del administrador.'),
    P('RELACIÓN DE FICHAS REVISADAS',{style:'Subhead',after:110})];
    const dataRows=(rows.length?rows:Array.from({length:12},()=>['','',''])).map((r,i)=>[String(i+1),detail(r[0],'_________________'),detail(r[1],'____________'),detail(r[2],'____________________________')]);
    q.push(T(['N.°','CÓDIGO DE FICHA','CÓDIGO DE SERVIDOR','APELLIDOS Y NOMBRES'],dataRows,[500,1600,1550,4350]));
    q.push(P('Observaciones: __________________________________________________________________', {after:160}));
    q.push(P('Los documentos originales firmados se remiten a la URH para su cotejo con los registros digitales. Esta acta no autoriza consultas electrónicas a fichas de otros servidores.',{after:300}));
    q.push(P('_____________________________________________',{align:'center'}));q.push(P('FIRMA Y SELLO DEL ADMINISTRADOR DE FACULTAD',{align:'center',bold:true}));
    q.push(P('Cargo de recepción URH: ___________________________________________'));
    return fileFromParas(q);
  }
  // V19.2.2: oficio formal de información declarada; no certifica funciones
  // ni constituye validación institucional. Se exporta en Word editable Arial 11.
  function buildOficioFacultad(data){
    const records=Array.isArray(data.records)?data.records:[];
    if(!records.length||records.some(r=>r.faculty_checked!==true))throw new Error('Hay fichas pendientes de revisión. Complete la relación antes de emitir el proyecto de oficio.');
    const facultyDisplay=String(data.faculty||'').replace(/^FACULTAD DE /i,'');
    const faculty=facultyDisplay.toLocaleUpperCase('es-PE');
    const administrator=detail(data.administrator,'________________________________________');
    const date=data.date||'____ de ______________ de 2026';
    const officeNumber=data.officeNumber||'________-2026-UNT/________';
    const year='“Año de la Esperanza y el Fortalecimiento de la Democracia”';
    const header=['UNIVERSIDAD NACIONAL DE TRUJILLO','FACULTAD DE '+faculty,year];
    const q=[
      P('Trujillo, '+date,{align:'right',after:135}),
      P('OFICIO N.° '+officeNumber,{bold:true,after:180}),
      P('SEÑOR:',{bold:true,after:35}),
      P('ECON. ALBERTO LUIS CAVA CARHUAYO',{bold:true,after:35}),
      P('DIRECTOR GENERAL DE ADMINISTRACIÓN',{bold:true,after:25}),
      P('UNIVERSIDAD NACIONAL DE TRUJILLO',{after:40}),
      P('PRESENTE.-',{bold:true,after:210}),
      P('ASUNTO: Información sobre las funciones, actividades, indicadores y productos declarados por el personal administrativo de la Facultad de '+facultyDisplay+'.',{bold:true,after:150}),
      P('De mi consideración:',{after:135}),
      P('Es grato dirigirme a usted para poner en conocimiento de la Dirección General de Administración la información funcional declarada por el personal administrativo de la Facultad de '+facultyDisplay+', recopilada mediante el aplicativo institucional de diagnóstico de puestos y funciones de la Universidad Nacional de Trujillo.',{after:125,firstLine:480}),
      P('La información adjunta describe las labores que cada servidor manifiesta realizar, organizadas por funciones, actividades, indicadores y productos o entregables. La Administración de Facultad ha efectuado una revisión de la información presentada, con las precisiones consignadas en los registros correspondientes.',{after:125,firstLine:480}),
      P('Es pertinente señalar que esta comunicación no constituye, por sí misma, certificación de funciones, modificación del puesto o reconocimiento de atribuciones. Corresponderá a las unidades competentes evaluar y contrastar la información con los documentos de gestión, antecedentes laborales y demás elementos que resulten aplicables.',{after:155,firstLine:480}),
      P('I. RELACIÓN DEL PERSONAL QUE DECLARÓ INFORMACIÓN FUNCIONAL',{style:'Subhead',keep:true,after:90}),
      P((records.length===1?'Se relaciona una ficha del personal cuyo registro ha sido revisado por la Administración de Facultad.':'Se relacionan '+records.length+' fichas del personal cuyos registros han sido revisados por la Administración de Facultad.')+' Los datos incluidos a continuación corresponden a las declaraciones recibidas.',{after:95,firstLine:480})
    ];
    q.push(T(['N.°','CÓDIGO DE RECEPCIÓN','APELLIDOS Y NOMBRES','PUESTO'],records.map((r,i)=>[String(i+1),detail(r.receipt_code),detail(r.owner_name),detail(r.job_title)]),[540,1930,3260,2270]));
    q.push(P('II. DETALLE DE FUNCIONES, ACTIVIDADES, INDICADORES Y PRODUCTOS INFORMADOS',{style:'Subhead',before:180,after:115,keep:true}));
    records.forEach((r,i)=>{
      const c=r.content||{};
      q.push(P((i+1)+'. SERVIDOR(A): '+detail(r.owner_name),{style:'Subhead',bold:true,left:160,after:65,keep:true}));
      q.push(P('Código de trabajador: '+detail(r.worker_code)+'  |  Código de recepción: '+detail(r.receipt_code)+'  |  Versión de ficha: '+detail(r.revision_no, '1'),{left:340,after:55,keep:true}));
      q.push(P('Puesto declarado: '+detail(r.job_title)+'  |  Unidad: '+detail(r.org_unit),{left:340,after:70,keep:true}));
      const funcs=Array.isArray(c.functions)?c.functions:[];
      if(!funcs.length)q.push(P('No se consignaron funciones en la declaración.',{left:540,after:90}));
      funcs.forEach((f,fi)=>{
        const fNumber=(i+1)+'.'+(fi+1);
        q.push(P(fNumber+'. FUNCIÓN: '+detail(f.description),{bold:true,left:400,after:75,keep:true}));
        if(f.notes)q.push(P('Precisión del declarante: '+detail(f.notes),{left:620,after:55}));
        const acts=Array.isArray(f.activities)?f.activities:[];
        acts.forEach((a,ai)=>{
          const aNumber=fNumber+'.'+(ai+1);
          q.push(P(aNumber+'. Actividad: '+detail(a.description),{left:700,after:60,keep:true}));
          const prods=Array.isArray(a.products)?a.products:[];
          prods.forEach((v,pi)=>{
            const num=aNumber+'.'+(pi+1);
            q.push(P(num+'. Producto o entregable: '+detail(v.name),{bold:true,left:990,after:45,keep:true}));
            q.push(P('Indicador declarado: '+detail(v.indicator,'No consignado'),{left:1230,after:45,keep:true}));
            q.push(P('Frecuencia: '+detail(v.frequency,'No consignada')+'  |  Unidad de medida: '+detail(v.unit,'No consignada')+'  |  Volumen habitual: '+detail(v.normal,'No consignado')+'  |  Volumen crítico: '+detail(v.peak,'No consignado'),{left:1230,after:60}));
            if(v.notes)q.push(P('Observaciones: '+detail(v.notes),{left:1230,after:65}));
          });
        });
      });
      if(r.faculty_note)q.push(P('Precisiones registradas durante la revisión: '+detail(r.faculty_note),{left:340,after:90}));
      if(c.observations)q.push(P('Observaciones generales del declarante: '+detail(c.observations),{left:340,after:90}));
      q.push(P(' ',{after:35}));
    });
    q.push(P('III. OBSERVACIONES PARA LA EVALUACIÓN INSTITUCIONAL',{style:'Subhead',before:95,after:85,keep:true}));
    q.push(P('La información relacionada permite identificar las funciones, actividades y productos que el personal refiere desarrollar. Se remite para el análisis que corresponda, sin atribuir carácter de conformidad definitiva a las declaraciones consignadas.',{firstLine:480,after:110}));
    q.push(P('Sin otro particular, hago propicia la ocasión para expresarle las muestras de mi especial consideración y estima.',{firstLine:480,after:165}));
    q.push(P('Atentamente,',{after:210}));
    q.push(P('REVISADO POR EL ADMINISTRADOR DE FACULTAD',{bold:true,after:70,keep:true}));
    q.push(P('Nombres y apellidos: '+administrator,{left:390,after:55}));
    q.push(P('Firma y fecha: ______________________________________________',{left:390,after:260}));
    q.push(P('____________________________________________',{align:'center',after:30,keep:true}));
    q.push(P('FIRMA Y SELLO DEL DECANO(A)',{bold:true,align:'center',after:45}));
    q.push(P('FACULTAD DE '+faculty,{align:'center',after:220}));
    q.push(P('EXPEDIENTE SGDUNT N.°: ______________________________________',{after:55}));
    q.push(P('REGISTRO SGDUNT N.°: _________________________________________',{after:55}));
    return fileFromParas(q,header);
  }
  // Alias de compatibilidad con llamadas de versiones anteriores.
  const buildRevisionFacultad=buildOficioFacultad;
  return {buildOffice,buildFicha,buildActaConformidad,buildRevisionFacultad,buildOficioFacultad,pack:zip};
})();
