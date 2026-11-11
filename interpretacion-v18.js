/*
 * UNT · Asistente funcional contextual V18 (2026)
 * Motor local basado en reglas explicables; NO es un modelo de lenguaje ni
 * acredita competencias. No utiliza red, APIs ni almacenamiento de descripciones.
 * Corrige: segmentación por acciones/sujetos, negaciones parciales, funciones
 * independientes, atribución de terceros, preguntas y trazabilidad por cláusula.
 */
(function(root){
 'use strict';
 const prior=root.UNT_LOCAL_ASSISTANT;
 if(!prior||!prior.generate||!Array.isArray(prior.knowledge))return;
 const VERSION='4.1.0';
 const P=x=>String(x??'').replace(/\s+/g,' ').trim();
 const N=x=>P(x).toLocaleLowerCase('es-PE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\bsgd\s*unt\b/g,'sgdunt');
 const sentence=x=>{x=P(x);return x?x[0].toLocaleUpperCase('es-PE')+x.slice(1):x};
 const finish=x=>{x=sentence(P(x).replace(/\s+([,.!?;])/g,'$1'));return x?(/[.!?]$/.test(x)?x:x+'.'):''};
 const uniq=a=>Array.from(new Set(a.filter(Boolean)));
 const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const term=(s,w)=>{w=N(w);if(!w)return false;return w.includes(' ')?s.includes(w):new RegExp('(?:^|[^a-zñ])'+esc(w)+'[a-zñ]*','i').test(s)};
 const typos={
   recivo:'recibo',resivo:'recibo',recivir:'recibir',reviso:'reviso',rejistro:'registro',rejistrar:'registrar',
   solisitud:'solicitud',solisitudes:'solicitudes',solcitudes:'solicitudes',expendiente:'expediente',
   expendientes:'expedientes',docuemnto:'documento',docuemntos:'documentos',documentso:'documentos',
   derivasion:'derivacion',tramitasion:'tramitacion',archibo:'archivo',carpetaas:'carpetas',
   matricual:'matricula',matricuala:'matricula',matricuals:'matriculas',certifcados:'certificados',
   asisitencia:'asistencia',asisitencias:'asistencias',progamacion:'programacion',
   imformes:'informes',informess:'informes',asisetncia:'asistencia',coordinacines:'coordinaciones',
   conrtatos:'contratos',papeleo:'documentacion',papeles:'documentos',compu:'computadora',compus:'computadoras'
 };
 function normalize(x){return N(x).replace(/\b[a-zñ]+\b/g,m=>typos[m]||m)}
 const domains=prior.knowledge.map(d=>({...d}));
 const extras=[
  {id:'turnos_personal',label:'Programación de turnos de personal',anchors:['rol de turnos','roles de turno','turnos del personal','turnos de personal','programacion de turnos','cuadro de turnos','cuadro de servicios'],terms:['personal de servicio','personal de vigilancia','turno del personal'],obj:'la programación y los registros de turnos del personal de servicio',goal:'conforme a las necesidades operativas de la unidad',verb:'Organizar'},
  {id:'asistencia_personal',label:'Control de asistencia de personal',anchors:['control de asistencia del personal','asistencia del personal administrativo','registro de asistencia del personal','control de asistencia de servidores','marcaciones del personal','asistencia de trabajadores','asistencia del personal'],terms:['marcaciones','tardanzas','permisos del personal','registro de asistencia'],obj:'los registros de asistencia del personal administrativo',goal:'conforme a los procedimientos de control establecidos',verb:'Controlar'},
  {id:'reservas_ambientes',label:'Reserva y programación de ambientes',anchors:['reserva de aulas','reserva de ambientes','agenda de ambientes','reservas de salas'],terms:['disponibilidad de aula','ambientes reservados'],obj:'la programación y las reservas de ambientes institucionales',goal:'para facilitar su disponibilidad y utilización',verb:'Organizar'}
 ];
 for(const d of extras) domains.unshift({...d,typical:[]});
 // Términos cotidianos frecuentes en declaraciones administrativas de las facultades.
 const doc=domains.find(x=>x.id==='documental');
 if(doc)doc.anchors.push('recibo solicitudes','registro solicitudes','recibo documentos','registro documentos','solicitudes que llegan','documentos recibidos','registro de solicitudes');
 const cleanup=domains.find(x=>x.id==='limpieza');
 if(cleanup)cleanup.anchors.push('limpio oficinas','limpio las oficinas','limpieza de oficinas','aseo de oficinas');
 const patrimonio=domains.find(x=>x.id==='patrimonio');
 if(patrimonio)patrimonio.anchors.push('inventario bienes','inventario los bienes','registro bienes patrimoniales');
 const adminPersonal=domains.find(x=>x.id==='personal');
 if(adminPersonal)adminPersonal.anchors.push('reviso contratos','reviso los contratos','contratos del personal','contratos de personal');
 const personale=domains.find(x=>x.id==='personal');if(personale)personale.anchors.push('contratos de personal','contratos del personal','vinculacion del personal');
 const jardines=domains.find(x=>x.id==='areas_verdes');if(jardines)jardines.anchors.push('jardines de la facultad','podo los jardines','riego los jardines');
 const equipos=domains.find(x=>x.id==='audiovisuales');if(equipos)equipos.anchors.push('prestamos de proyectores','prestamos de equipos','proyectores multimedia');
 const verbs=[
  ['recibir','Recibir','recib(?:o|ir|e|imos|en|iendo)|recepcion(?:o|ar|a|amos)|me llegan|me entregan|recepcion de'],
  ['revisar','Revisar','revis(?:o|ar|a|amos|an)|verific(?:o|ar|a|amos|an)|cotej(?:o|ar|a)|comprueb(?:o|a)|cheque(?:o|ar)|revision de'],
  ['registrar','Registrar','registr(?:o|ar|a|amos|an)|anot(?:o|ar|a)|digit(?:o|ar|a)|ingres(?:o|ar|a)|cargo en el sistema|subo al sistema|registro de'],
  ['derivar','Derivar','deriv(?:o|ar|a|amos|an)|remit(?:o|ir|e|imos)|envi(?:o|ar|a)|paso al area|derivacion de'],
  ['archivar','Archivar','archiv(?:o|ar|a|amos)|custodi(?:o|ar|a)|foli(?:o|ar|a)|clasific(?:o|ar|a)|archivo de'],
  ['digitalizar','Digitalizar','digitaliz(?:o|ar|a)|escane(?:o|ar|a)|escan(?:eo|ear|earlo)'],
  ['redactar','Elaborar','redact(?:o|ar|a)|elabor(?:o|ar|a)|prepar(?:o|ar|a)|confeccion(?:o|ar|a)|elaboracion de'],
  ['organizar','Organizar','organiz(?:o|ar|a)|orden(?:o|ar|a)|organizacion de'],
  ['atender','Atender','atiend(?:o|e|en)|atend(?:er|emos)|orient(?:o|ar|a)|absuelv(?:o|e)'],
  ['seguir','Realizar seguimiento de','seguimiento de|monitore(?:o|ar|a)|hago seguimiento|rastre(?:o|ar)|supervis(?:o|ar|a)'],
  ['coordinar','Coordinar','coordin(?:o|ar|a)|convoc(?:o|ar|a)'],
  ['programar','Programar','program(?:o|ar|a)|calendariz(?:o|ar|a)|agend(?:o|ar|a)|organizo turnos|rol de turnos|cuadro de turnos'],
  ['actualizar','Actualizar','actualiz(?:o|ar|a)|corrij(?:o|e)|subsan(?:o|ar)|rectific(?:o|ar|a)'],
  ['consolidar','Consolidar','consolid(?:o|ar|a)|recopil(?:o|ar|a)|sistematiz(?:o|ar|a)|tabul(?:o|ar|a)'],
  ['reportar','Reportar','report(?:o|ar|a)|informo avances|rindo cuentas'],
  ['tramitar','Tramitar','tramit(?:o|ar|a)|gestion(?:o|ar|a)|doy curso'],
  ['controlar','Controlar','control(?:o|ar|a)|fiscaliz(?:o|ar|a)|control de asistencia|controlo la asistencia'],
  ['entregar','Entregar','entreg(?:o|ar|a)|distribuy(?:o|e)|repart(?:o|ir|e)'],
  ['pagar','Efectuar pagos de','efectuo pagos|realizo pagos|pago facturas|giro pagos|pago a'],
  ['aprobar','Aprobar','aprueb(?:o|a)|aprob(?:ar|amos)|autoriz(?:o|ar|a)'],
  ['firmar','Suscribir','firm(?:o|ar|a)|suscrib(?:o|ir|e)|rubric(?:o|ar|a)'],
  ['evaluar','Evaluar','evalu(?:o|ar|a)|calific(?:o|ar|a)'],
  ['regar','Regar','rieg(?:o|a)|reg(?:ar|amos)|pod(?:o|ar|a)|deshierb(?:o|ar|a)'],
  ['limpiar','Limpiar','limpi(?:o|ar|a)|barr(?:o|er|e)|trape(?:o|ar|a)|desinfect(?:o|ar|a)'],
  ['reparar','Reparar','repar(?:o|ar|a)|arregl(?:o|ar|a)|mantengo equipos|soluciono averias'],
  ['trasladar','Trasladar','conduzco|transport(?:o|ar|a)|traslad(?:o|ar|a)|manejo vehiculos'],
  ['instalar','Instalar','instal(?:o|ar|a)|configur(?:o|ar|a)'],
  ['soportar','Atender','soporte tecnico|resuelvo fallas|atiendo incidencias|reinstal(?:o|ar)'],
  ['inventariar','Inventariar','inventari(?:o|ar|a)|cuento bienes|codific(?:o|ar|a)'],
  ['analizar','Analizar','analiz(?:o|ar|a)|estudio datos|interpreto resultados'],
  ['capacitar','Capacitar','capacit(?:o|ar|a)|instruy(?:o|e)|dicto talleres'],
  ['diseñar','Formular','disen(?:o|ar|a)|formul(?:o|ar|a)|propongo instrumentos']
 ].map(([id,verb,pattern])=>({id,verb,pattern,rx:new RegExp('(?:^|[^a-zñ])(?:'+pattern+')(?![a-zñ])','i')}));
 const sensitive=new Set(['aprobar','firmar','pagar','evaluar']);
 const actionStarter='recibo|recepciono|reviso|verifico|registro|derivo|archivo|digitalizo|escaneo|elaboro|redacto|preparo|organizo|ordeno|atiendo|oriento|coordino|programo|actualizo|consolido|reporto|tramito|gestiono|controlo|entrego|apruebo|firmo|evaluo|riego|podo|limpio|reparo|instalo|configuro|inventario|analizo|capacito|formulo|hago seguimiento|me encargo de|soy responsable de|apoyo|ayudo|colaboro|controlar|registrar|programar|organizar|derivar|revisar|recibir|elaborar|coordinar|archivar|limpiar|atender';
 const subjectStarter='(?:yo|nosotros|el jefe|la jefa|mi jefe|mi jefa|el decano|la decana|el director|la directora|el rector|la rectora|el responsable|la responsable|el coordinador|la coordinadora|el profesor|la profesora|otra persona|otros servidores|ellos|ellas|ella|el|la)';
 const splitRegular=new RegExp('\\s+y\\s+(?=(?:'+subjectStarter+')\\s+(?:'+actionStarter+'|firma|aprueba|autoriza|paga|revisa|registra|evalua)|(?:yo\\s+)?(?:'+actionStarter+')\\b|de\\s+(?:'+actionStarter+')\\b)','gi');
 const splitPronoun=new RegExp('\\s*,?\\s+(?:y\\s+)?(?=(?:lo|la|los|las)\\s+(?:'+actionStarter+')\\b)','gi');
 const splitContrast=/\s*(?:,?\s*\b(?:pero|sin embargo|mientras que|en cambio|aunque)\b\s*|\s*;\s*|\s*\n+\s*|(?<=[.!?])\s+)\s*/gi;
 function segments(text){
   // Conserva el texto original para complementos y muestra fragmentos en el diagnóstico.
   let t=P(String(text).replace(/\r/g,'\n'));
   t=t.replace(/\s+\by\s+de\s+(?=(?:registrar|controlar|revisar|recibir|organizar|archivar|tramitar|elaborar|preparar|atender|programar|derivar|limpiar|evaluar|firmar|aprobar)\b)/gi,'; de ');
   t=t.replace(new RegExp(',\\s*(?=(?:yo\\s+)?(?:'+actionStarter+')\\b)','gi'),'; ');
   t=t.replace(splitRegular,'; ').replace(splitPronoun,'; ');
   return t.split(splitContrast).flatMap(x=>x.split(';')).map(P).filter(Boolean).slice(0,65);
 }
 const otherSubject=/^(?:(?:y\s+)?(?:el|la|mi|los|las|un|una)\s+)?(?:jefe|jefa|decano|decana|rector|rectora|director|directora|profesor|profesora|supervisor|supervisora|autoridad|coordinador|coordinadora|responsable|administrador|administradora|otros servidores|otra persona)\s+(?:de\s+\w+\s+)?(?:firma|aprueba|autoriza|paga|revisa|registra|remite|deriva|evalua|valida|suscribe|resuelve|lo hace|se encarga)\b|^(?:ellos|ellas|ella)\s+(?:firm|aprob|autoriz|revis|registr|remit)/i;
 const negation=/\b(?:no\s+(?:(?:me|nos|se|lo|la|los|las)\s+)?(?:hago|realiz\w*|registr\w*|revis\w*|aprueb\w*|aprob\w*|autoriz\w*|firm\w*|pag\w*|evalu\w*|deriv\w*|archiv\w*|entreg\w*|gestion\w*|coordin\w*|supervis\w*|ejecut\w*|prepar\w*|elabor\w*|tramit\w*|controlo|me\s+encargo|corresponde|soy\s+responsable)|nunca\s+|tampoco\s+|sin\s+intervenir|eso\s+no\s+me\s+corresponde)\b/i;
 const support=/\b(?:solo apoyo|apoyo a|apoyo en|ayudo a|ayudo en|colaboro con|brindo apoyo|presto apoyo|por indicacion de|bajo indicaciones|en apoyo de|asisto a)\b/;
 const firstClaim=/\b(?:yo\s+(?:apruebo|firmo|autorizo|pago|evaluo)|me\s+encargo\s+de|soy\s+responsable\s+de|tengo\s+a\s+mi\s+cargo|ejecuto\s+directamente)\b/;
 function role(t){return support.test(t)?'apoyo':firstClaim.test(t)?'directo':'no_precisado'}
 function acts(t){const a=verbs.filter(v=>v.rx.test(t) && !(v.id==='programar' && /^(?:organizo|organizar|organiza|organizacion)\b/.test(t) && !/\bprogram|\bcalendariz/.test(t)));
   // No confundir reportes, informes o sustantivos de productos con la acción de reportar.
   return a.filter(v=>!(v.id==='reportar'&&a.some(x=>x.id==='redactar')&&!/\breporto\b/.test(t)));
 }
 const numActions=x=>x.length;
 function matches(s){const n=normalize(s);let found=[];
   for(const d of domains){let score=0,h=[];for(const k of d.anchors||[])if(term(n,k)){score+=8;h.push(k)}
     for(const k of d.terms||[])if(term(n,k)){score+=1.9;h.push(k)}
     if(d.id==='documental' && !h.some(k=>d.anchors?.includes(k)))score*=.68;
     if(d.id==='transporte' && /document|expedient|deriv/.test(n) && !/vehicul|conduc|chofer/.test(n))score*=.10;
     if(d.id==='asistencia_personal'&&!/(?:personal|trabajador|servidor|marcaciones)/.test(n))score=0;
     if(d.id==='turnos_personal'&&!/(?:personal|servicio|vigilancia)/.test(n))score=0;
     if(d.id==='matricula'&&!/matricul/.test(n))score*=.20;
     if(d.id==='asistencia' && /personal administrativo|marcaciones del personal|turnos del personal/.test(n))score*=.15;
     if(score>=1.7)found.push({...d,score:Math.round(score*10)/10,hits:h});
   }
   return found.sort((a,b)=>b.score-a.score||b.hits.length-a.hits.length);
 }
 function parse(s,context=''){
   const pieces=segments(s),list=[];let lastDomain=null;
   for(const piece of pieces){const t=normalize(piece);
     const excluded=otherSubject.test(t)?'Responsabilidad atribuida a otra persona':negation.test(t)&&!/\bno solo\b/.test(t)?'Acción negada por el servidor':null;
     const aa=acts(t),ds=matches(t);let ownDomain=ds[0]&&ds[0].score>=1.7?ds[0]:null;
     if(ownDomain?.id==='asistencia' && /personal administrativo|personal de servicio|trabajadores|servidores/.test(t))ownDomain=domains.find(x=>x.id==='asistencia_personal')||ownDomain;
     let d=ownDomain;
     if(!d&&aa.length && lastDomain)d=lastDomain;
     if(ownDomain && !excluded)lastDomain=ownDomain;
     // El contexto previo ayuda con pronombres; no asigna procesos nuevos sin evidencia.
     if(!d&&aa.length&&context)d=matches(context)[0]||null;
     list.push({fragmento:piece,normalized:t,excluded,domain:d,domains:ds,actions:aa,role:role(t)});
   }
   return list;
 }
 function group(s,context=''){
   const rows=parse(s,context),map=new Map(),recognized=[];
   for(const r of rows){if(r.excluded)continue;
     const key=r.domain?.id||'sin_dominio';
     if(!r.actions.length&&!r.domain)continue;
     const canonicalKey=key==='asistencia' && /personal administrativo|trabajador|servidor|tardanzas/.test(normalize(s))?'asistencia_personal':key;
     if(!map.has(canonicalKey))map.set(canonicalKey,{domain:canonicalKey==='asistencia_personal'?domains.find(x=>x.id==='asistencia_personal'):r.domain,rows:[],actions:[],role:'no_precisado',score:0});
     const g=map.get(canonicalKey);g.rows.push(r);g.score+=r.domain?.score||0;
     if(r.role==='apoyo')g.role='apoyo';else if(r.role==='directo'&&g.role!=='apoyo')g.role='directo';
     for(const a of r.actions){if(sensitive.has(a.id)&&r.role!=='directo')continue;
       if(!g.actions.some(x=>x.id===a.id&&normalize(x.source)===normalize(r.fragmento)))g.actions.push({...a,source:r.fragmento,role:r.role});
       recognized.push(a.id);
     }
   }
   const groups=[...map.values()].filter(g=>g.domain||g.actions.length).sort((a,b)=>b.score-a.score||b.actions.length-a.actions.length);
   return {rows,groups,recognized:uniq(recognized),excluded:rows.filter(r=>r.excluded)};
 }
 const objectFor={
  documental:{recibir:'la documentación presentada',revisar:'los requisitos de la documentación recibida',registrar:'los documentos en el SGDUNT',derivar:'los documentos a las unidades competentes',archivar:'los expedientes y documentos',seguir:'los expedientes en trámite',digitalizar:'los documentos recibidos',redactar:'los oficios y documentos administrativos'},
  matricula:{registrar:'las matrículas de los estudiantes',revisar:'los requisitos de matrícula',recibir:'las solicitudes de matrícula',actualizar:'los registros de matrícula'},
  asistencia_personal:{controlar:'la asistencia del personal administrativo',registrar:'los registros de asistencia del personal administrativo',revisar:'las marcaciones del personal administrativo'},
  turnos_personal:{organizar:'el rol de turnos del personal de servicio',programar:'el rol de turnos del personal de servicio',actualizar:'el cuadro de turnos del personal de servicio'},
  grados:{revisar:'los expedientes de grados y títulos',registrar:'los expedientes de grados y títulos'},
  personal:{revisar:'la documentación administrativa del personal',registrar:'los movimientos y registros de personal'},
  archivo:{archivar:'los expedientes bajo custodia',revisar:'la organización de los expedientes'},
  areas_verdes:{regar:'los jardines y áreas verdes asignadas',limpiar:'las áreas verdes asignadas'},
  biblioteca:{registrar:'los préstamos y devoluciones de material bibliográfico'},
  tecnologia:{soportar:'las incidencias de soporte técnico reportadas',instalar:'los equipos informáticos asignados'},
  patrimonio:{inventariar:'los bienes patrimoniales asignados'},
  secretaria:{programar:'la agenda de actividades del despacho',coordinar:'las actividades administrativas del despacho'}
 };
 const generic={recibir:'los documentos o solicitudes presentados',revisar:'los requisitos de la documentación recibida',registrar:'la información del procedimiento',derivar:'los documentos a la unidad competente',archivar:'los documentos bajo custodia',digitalizar:'los documentos asignados',redactar:'los documentos administrativos requeridos',organizar:'las actividades o registros asignados',atender:'las consultas y solicitudes de los usuarios',seguir:'los trámites pendientes',coordinar:'las actividades administrativas asignadas',programar:'las actividades requeridas',actualizar:'los registros correspondientes',consolidar:'la información recopilada',reportar:'los resultados de las labores realizadas',tramitar:'las solicitudes presentadas',controlar:'los registros asignados',entregar:'los materiales o documentos solicitados',regar:'los jardines asignados',limpiar:'los ambientes asignados',reparar:'los equipos e instalaciones asignados',trasladar:'las personas o materiales asignados',instalar:'los equipos asignados',soportar:'las incidencias técnicas reportadas',inventariar:'los bienes asignados',analizar:'la información recopilada',capacitar:'al personal participante',diseñar:'los instrumentos asignados'};
 const productFor={
   recibir:'Documentación recibida',revisar:'Documentación revisada',registrar:'Registros actualizados',derivar:'Documentos derivados',archivar:'Documentos archivados',digitalizar:'Documentos digitalizados',redactar:'Documentos elaborados',organizar:'Programación o registros organizados',atender:'Solicitudes o consultas atendidas',seguir:'Registro de seguimiento actualizado',coordinar:'Coordinaciones realizadas',programar:'Programación registrada',actualizar:'Registros actualizados',consolidar:'Información consolidada',reportar:'Reportes elaborados',tramitar:'Solicitudes tramitadas',controlar:'Registros de control actualizados',entregar:'Materiales o documentos entregados',regar:'Áreas verdes atendidas',limpiar:'Ambientes atendidos',reparar:'Servicios de mantenimiento realizados',trasladar:'Traslados efectuados',instalar:'Equipos instalados',soportar:'Incidencias atendidas',inventariar:'Inventarios actualizados',analizar:'Análisis elaborados',capacitar:'Sesiones de capacitación realizadas',diseñar:'Instrumentos formulados',aprobar:'Trámites aprobados',firmar:'Documentos suscritos',evaluar:'Evaluaciones realizadas',pagar:'Pagos efectuados'
 };
 const productSpecific={
   matricula:{registrar:'Matrículas registradas',actualizar:'Registros de matrícula actualizados'},
   asistencia_personal:{controlar:'Registros de control de asistencia actualizados',registrar:'Registros de asistencia actualizados'},
   turnos_personal:{programar:'Rol de turnos del personal organizado',organizar:'Rol de turnos del personal organizado',actualizar:'Cuadro de turnos actualizado'},
   documental:{registrar:'Documentos registrados en el SGDUNT',derivar:'Documentos derivados a las unidades competentes',seguir:'Seguimiento de expedientes registrado'},
   grados:{revisar:'Expedientes de grados y títulos revisados'},
   areas_verdes:{regar:'Áreas verdes atendidas'},
   patrimonio:{inventariar:'Inventario patrimonial actualizado'},
   archivo:{archivar:'Expedientes organizados y archivados'}
 };
 function activityObject(a,d,source){
   const t=normalize(source);let obj=objectFor[d?.id]?.[a.id]||generic[a.id]||'';
   if(d?.id==='documental'&&a.id==='registrar'){
      const kind=/\bofici/.test(t)?'los oficios':/\bsolicitud/.test(t)?'las solicitudes':/\bexpedient/.test(t)?'los expedientes':'los documentos';
      obj=kind+(/sgdunt/.test(t)?' en el SGDUNT':' en el registro institucional correspondiente');
   }
   if(a.id==='redactar'){
      if(/\bofici/.test(t))obj='los oficios administrativos';
      else if(/\binform/.test(t))obj='los informes administrativos';
      else if(/\bacta/.test(t))obj='las actas administrativas';
   }
   // Cuando el usuario explica el objeto concreto, preferirlo al comodín genérico.
   if(!sensitive.has(a.id) && (!objectFor[d?.id]?.[a.id]||d?.id==='personal')){
      const w=normalize(source);let m=w.match(/\b(?:recibo|reviso|registro|derivo|archivo|digitalizo|elaboro|organizo|atiendo|coordino|programo|actualizo|consolido|tramito|controlo|entrego|limpio|instalo|inventario)\s+((?:(?:el|la|los|las|un|una)\s+)?(?:contratos|expedientes|solicitudes|documentos|oficios|archivos|equipos|informes|registros|horarios)[^,;.]{0,65})/);
      if(m&&!/\b(?:pero|mientras|aunque|el jefe|la jefa|el director|la directora|no\s+)\b/.test(m[1]))obj=m[1];
   }
   return obj;
 }
 function activityText(a,d){let verb=a.verb,obj=activityObject(a,d,a.source);
   if(!obj && sensitive.has(a.id))return null;
   if(a.id==='seguir'||a.id==='pagar')obj=obj.replace(/^(el|la|los|las)\s+/,'');
   return finish(verb+' '+obj);
 }
 function fnText(g){const d=g.domain; if(!d)return null;const ids=uniq(g.actions.map(a=>a.id));
   const aid=(x)=>ids.includes(x);let verb=P(d.verb||'Organizar').toLocaleLowerCase('es-PE'),obj=P(d.obj||'').toLocaleLowerCase('es-PE');let goal=P(d.goal||'').toLocaleLowerCase('es-PE');
   if(d.id==='documental'&&['recibir','registrar','derivar'].filter(aid).length>=2){
      const labels=[aid('recibir')?'la recepción':null,aid('registrar')?'el registro':null,aid('derivar')?'la derivación':null].filter(Boolean);
      verb='Gestionar';obj=labels.length===2?labels.join(' y ')+' de documentos':labels.slice(0,-1).join(', ')+' y '+labels.at(-1)+' de documentos';
      if(g.rows.some(r=>/sgdunt/.test(r.normalized)))obj+=' en el SGDUNT';goal='para facilitar su trazabilidad y tramitación oportuna';
   }
   if(d.id==='matricula'&&aid('registrar')){verb='Registrar';obj='la información de matrícula de los estudiantes';goal='conforme a los procedimientos académicos correspondientes';}
   if(d.id==='asistencia_personal'&&aid('controlar')){verb='Controlar';obj='los registros de asistencia del personal administrativo';goal='conforme al procedimiento institucional aplicable';}
   if(d.id==='turnos_personal'){verb='Organizar';obj='la programación de turnos del personal de servicio';goal='según las necesidades operativas de la unidad';}
   if(d.id==='patrimonio'&&aid('inventariar')){verb='Realizar';obj='el inventario de bienes patrimoniales asignados';goal='para contribuir a su identificación y trazabilidad';}
   if(d.id==='personal'&&aid('revisar')){verb='Revisar';obj='la documentación contractual del personal';goal='conforme a los procedimientos administrativos aplicables';}
   if(g.role==='apoyo'){verb='Apoyar en';obj='la '+(g.actions[0]?.id==='revisar'?'revisión de ':g.actions[0]?.id==='registrar'?'actualización de ':'gestión de ')+obj.replace(/^(?:los|las|el|la)\s+/,'los ');} 
   else if(/^(?:apoyar|brindar apoyo)$/i.test(verb)){verb=g.actions.length===1?(g.actions[0]?.verb||'Gestionar'):'Gestionar';}
   if(!obj)return null;
   if(!/^\b(?:para|conforme|segun|mediante|de acuerdo|a fin de)\b/.test(N(goal)))goal='para contribuir al desarrollo de las actividades de la unidad';
   return finish(`${verb} ${obj} ${goal.toLocaleLowerCase('es-PE')}`);
 }
 function question(kind,c,extra,fn){
   if(kind==='function'){
     if(c.excluded.length && !c.groups.length)return 'Ha señalado tareas que no realiza o que corresponden a otra persona. ¿Qué acciones realiza usted directamente?';
     if(!c.groups.some(g=>g.domain))return '¿A qué procedimiento o servicio corresponde su trabajo y qué documentos, registros o resultados obtiene?';
     if(c.groups.some(g=>!g.actions.length))return '¿Qué acciones concretas realiza dentro del proceso mencionado?';
     return '¿Qué resultado o servicio obtiene al realizar esas actividades?';
   }
   if(kind==='activity')return '¿Qué acciones realiza usted personalmente para cumplir esta función (por ejemplo, qué revisa, registra, coordina o entrega)?';
   if(kind==='product')return 'Al finalizar la actividad, ¿qué documento, registro, servicio realizado u otro resultado puede verificarse?';
   return '';
 }
 function diagnosis(c){return {
   motor:'interpretacion-funcional-local',version:VERSION,interpretacion:'reglas-contextuales-no-generativas',
   procesos:c.groups.slice(0,8).map((g,i)=>({nombre:g.domain?.label||'Proceso no identificado',prioridad:i+1,acciones:g.actions.map(a=>a.id),fragmentos:g.rows.map(x=>x.fragmento).slice(0,5),nivelResponsabilidad:g.role})),
   accionesDeclaradas:c.recognized,fragmentosExcluidos:c.excluded.slice(0,10).map(x=>({fragmento:x.fragmento,motivo:x.excluded})),
   nivelResponsabilidad:c.groups.some(g=>g.role==='apoyo')?'apoyo':c.groups.some(g=>g.role==='directo')?'directo':'no_precisado',
   certeza:c.groups.some(g=>g.domain?.score>=8)?'Orientativa con anclaje contextual':'Requiere confirmación',
   advertencia:'Los resultados se basan en reglas locales y deben ser verificados por el servidor y la URH.'
 }}
 function generate(req){req=req||{};
   const target=req.objetivoDelCampo||'function',extra=[req.descripcion,req.detalleNuevo,...(req.respuestas||[]).map(x=>typeof x==='string'?x:x?.respuesta)].filter(Boolean).join('. ');
   const fn=P(req.contextoFuncion),ac=P(req.contextoActividad),full=extra||ac||fn;
   const c=group(target==='function'?full:extra,fn),diag=diagnosis(c);
   const result=(propuestas=[],preguntas=[],alertas=[])=>({propuestas,preguntas,alertas,diagnostico:diag});
   if(target==='function'){
     if(P(full).length<12)return result([],['Describa qué acciones realiza, sobre qué documentos, personas o servicios y con qué finalidad.'],[]);
     const groups=c.groups.filter(g=>g.domain && g.actions.length>0);
     const proposals=uniq(groups.map(fnText).filter(Boolean)).slice(0,8).map(funcion=>({funcion,actividades:[]}));
     const alerts=[];
     if(c.excluded.length)alerts.push('Se excluyeron las acciones negadas o atribuidas expresamente a otras personas.');
     if(groups.length>1)alerts.push(`Se identificaron ${groups.length} procesos diferentes; verifique si corresponden a funciones independientes.`);
     if(groups.length>8)alerts.push('Se detectaron más de ocho procesos. Describa los adicionales en una nueva consulta para no omitir responsabilidades.');
     if(groups.some(g=>g.role==='apoyo'))alerts.push('Se conserva el carácter de apoyo declarado, sin atribuir facultades decisorias.');
     if(c.groups.some(g=>!g.domain))alerts.push('Hay acciones cuyo proceso no pudo identificarse; precise su ámbito para incorporarlas.');
     if(c.groups.some(g=>!g.domain))return result(proposals,[question(target,c,extra,fn)],alerts);
     if(!proposals.length)return result([],[question(target,c,extra,fn)],alerts);
     return result(proposals,[],alerts);
   }
   if(target==='activity'){
     if(!fn)return result([],['Registre primero la función a la que corresponden estas actividades.'],[]);
     if(!P(extra))return result([],[question(target,c,extra,fn)],[]);
     const fds=matches(fn),main=fds[0]||null;
     let output=[];
     for(const g of c.groups){const d=g.domain||main;
       // No trasplantar actividades de un proceso claramente diferente a esta función.
       if(main&&g.domain&&g.domain.id!==main.id&&g.domain.score>=4){continue}
       for(const a of g.actions){const txt=activityText(a,d);if(txt)output.push(txt)}
     }
     const priorActs=Array.isArray(req.borradorActual?.actividades)?req.borradorActual.actividades.map(x=>x?.actividad).filter(Boolean):[];
     const list=uniq([...priorActs,...output]).slice(0,22);
     const warnings=[];
     if(c.excluded.length)warnings.push('Se omitieron acciones negadas y acciones atribuidas a otras personas.');
     if(c.groups.length>1)warnings.push('Se identificaron procesos distintos; incorpore solamente las actividades de la función indicada.');
     if(!output.length&&!priorActs.length)return result([],[question(target,c,extra,fn)],warnings);
     return result([{funcion:fn,actividades:list.map(actividad=>({actividad,productos:[]}))}],[],warnings);
   }
   if(target==='product'){
     if(!ac)return result([],['Registre primero la actividad correspondiente.'],[]);
     const desc=normalize(ac),matched=acts(desc);
     const d=matches(fn+' '+ac)[0]||null;
     let items=[];
     // Evitar confundir la aprobación por otra persona con un resultado propio.
     for(const a of matched){if(sensitive.has(a.id)&&!/\b(?:yo|personalmente|a mi cargo|soy responsable de)\b/.test(desc))continue;
        let p=productSpecific[d?.id]?.[a.id]||productFor[a.id];
        if(d?.id==='documental'&&a.id==='registrar'&&!/sgdunt/.test(desc+' '+normalize(fn)))p='Documentos registrados en el sistema institucional correspondiente';
        if(a.id==='redactar'){
          if(/\bofici/.test(desc))p='Oficios elaborados';else if(/\binform/.test(desc))p='Informes elaborados';else if(/\bacta/.test(desc))p='Actas elaboradas';
        }
        if(p)items.push(finish(p));
     }
     if(!matched.length){
       const nouns=[[/registro de|registros de/,'registrar'],[/programacion de|rol de turnos/,'programar'],[/derivacion de/,'derivar'],[/elaboracion de/,'redactar'],[/recepcion de/,'recibir'],[/seguimiento de/,'seguir'],[/limpieza de/,'limpiar'],[/mantenimiento de/,'reparar']];
       for(const [rx,id] of nouns){if(rx.test(desc)){let p=productSpecific[d?.id]?.[id]||productFor[id];if(p)items.push(finish(p));break}}
     }
     const explicit=extra.match(/(?:producto|resultado|entregable|queda|genero|obtengo|se obtiene)\s*(?:es|son|un|una|los|las|como|:)?\s*([^.!?\n]{8,100})/i);
     if(explicit){const value=P(explicit[1]);if(!/(?:\b(?:no|nunca|tampoco)\b|\bel jefe\b)/i.test(value))items.unshift(finish(value))}
     const priorProducts=req.borradorActual?.actividades?.[0]?.productos||[];
     const products=uniq([...priorProducts.map(P),...items]).slice(0,7);
     if(!products.length)return result([],[question(target,c,extra,fn)],['No se inventan entregables sin elementos que permitan identificarlos.']);
     return result([{funcion:fn,actividades:[{actividad:ac,productos:products}]}],[],['Confirme que los productos propuestos existan realmente y puedan evidenciarse.']);
   }
   return prior.generate(req);
 }
 root.UNT_LOCAL_ASSISTANT=Object.freeze({generate,diagnosticar:txt=>diagnosis(group(txt)),advice:prior.advice,version:VERSION,type:'motor-local-contextual',catalogo:domains.length});
})(window);
