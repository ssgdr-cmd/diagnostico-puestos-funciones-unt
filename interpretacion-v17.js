/*
 * UNT - Asistente de Interpretación Contextual V17 (2026)
 * 100 % local: sin red, sin API, sin dependencias, sin modelos descargados.
 * Capas: catalogo multidominio, segmentación discursiva, extracción basada
 * en declaraciones, controles de negación/autoría, trazabilidad y aclaraciones.
 * No verifica competencias ni reemplaza la conformidad del servidor.
 */
(function(root){
 'use strict';
 const base=root.UNT_LOCAL_ASSISTANT;
 if(!base || !base.knowledge) return;
 const VERSION='3.0.0';
 const plain=v=>String(v??'').trim().replace(/\s+/g,' ');
 const norm=v=>plain(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\bsgd\s*unt\b/g,'sgdunt');
 const punct=s=>/[.!?]$/.test(s)?s:s+'.';
 const sentence=s=>{s=plain(s);return s?s[0].toLocaleUpperCase('es-PE')+s.slice(1):s};
 const out=s=>punct(sentence(plain(s).replace(/\s+([,.;])/g,'$1')));
 const unique=arr=>[...new Set(arr.filter(Boolean))];
 const isToken=(t,k)=>{let x=norm(k);if(!x)return false;
   // Terminos de raiz del vocabulario V16: limite al inicio de la palabra; frases literales.
   if(x.includes(' '))return t.includes(x);
   return new RegExp('(?:^|[^a-zñ])'+x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[a-zñ]*','i').test(t);
 };
 const includesAny=(t,list)=>list.some(k=>isToken(t,k));
 const EXTRA=[
 ['secretaria_escuela','Secretaría de Escuela Profesional','direccion de escuela|secretaria de escuela|escuela profesional','director de escuela|reunion de escuela|tramites de escuela','la documentación y las coordinaciones administrativas de la escuela profesional','para contribuir a la atención de sus procesos','Organizar'],
 ['departamento','Departamento académico','departamento academico|director de departamento|carga lectiva','distribucion docente|horas lectivas|docentes contratados','la información y las coordinaciones administrativas del departamento académico','para facilitar el desarrollo de las actividades programadas','Organizar'],
 ['practicas','Prácticas preprofesionales','practicas preprofesionales|practicas profesionales|carta de presentacion para practicas','centro de practicas|convenio de practicas|informe de practicas','las solicitudes y registros de prácticas preprofesionales','para facilitar su tramitación y seguimiento','Tramitar'],
 ['internado','Internado y prácticas clínicas','internado|rotacion clinica|sede hospitalaria|campos clinicos','practicas clinicas|plaza de internado','la documentación administrativa de las actividades clínicas formativas','para apoyar su organización y seguimiento','Organizar'],
 ['clinica','Servicios clínicos y asistenciales','clinica odontologica|atencion clinica|triaje|consultorio universitario','paciente|historia clinica|turno asistencial','los registros y la atención administrativa de los servicios clínicos','para contribuir a su continuidad y trazabilidad','Atender'],
 ['agro','Producción agrícola y viveros','vivero|invernadero|campo experimental|parcela experimental','cultivo|siembra|cosecha|abono organico','las actividades agrícolas de los espacios asignados','para contribuir a su conservación y operación','Realizar'],
 ['animal','Atención y cuidado de animales','granjas experimentales|bioterio|clinica veterinaria|cuidado animal','alimentacion de animales|vacunacion animal|sanidad animal','las actividades de atención y cuidado de animales a cargo','para mantener condiciones adecuadas de manejo','Realizar'],
 ['comunicaciones','Comunicaciones institucionales','nota de prensa|redes sociales institucionales|pagina web institucional|boletin institucional','fotografia institucional|comunicado|publicacion institucional','los contenidos y las comunicaciones institucionales asignadas','para facilitar su difusión oportuna','Elaborar'],
 ['tramite_virtual','Mesa de partes virtual','mesa de partes virtual|plataforma virtual de tramites|tramites en linea','documentos electronicos|recepcion virtual','la recepción y el registro de documentación electrónica','para contribuir a su tramitación y trazabilidad','Gestionar'],
 ['admisión','Admisión universitaria','examen de admision|proceso de admision|postulante|prospecto de admision','inscripcion de postulantes|vacantes de admision','las solicitudes y registros del proceso de admisión','para contribuir a su organización y atención','Tramitar'],
 ['egresados','Seguimiento al egresado','seguimiento al egresado|bolsa de trabajo|insercion laboral de egresados','egresados|empleabilidad|observatorio laboral','la información y los registros de egresados','para facilitar su seguimiento institucional','Organizar'],
 ['gestion_riesgos','Gestión del riesgo y emergencias','defensa civil|simulacro|plan de contingencia|gestion del riesgo','emergencia|evacuacion|brigada','las actividades administrativas de prevención y respuesta ante emergencias','para contribuir a la preparación institucional','Apoyar'],
 ['infraobras','Obras e inversiones','invierte pe|expediente tecnico de obra|proyecto de inversion|obra universitaria','presupuesto de obra|valorizacion de obra|inversion publica','la información y documentación de obras e inversiones','para contribuir a su seguimiento administrativo','Organizar'],
 ['compras_menores','Compras menores y cotizaciones','cotizaciones de proveedores|indagacion de mercado|cuadro comparativo','proveedores|cotizacion|orden de compra','las solicitudes y cotizaciones de bienes y servicios','para contribuir a la atención de requerimientos','Tramitar'],
 ['audiovisuales','Equipos audiovisuales y préstamo','prestamo de proyectores|equipos audiovisuales|proyector multimedia|prestamo de equipos|reserva de proyectores','proyector|parlantes|microfonos|equipo multimedia','los equipos audiovisuales de uso académico','para facilitar su disponibilidad y utilización','Organizar'],
 ['idiomas','Centro de idiomas','centro de idiomas|evaluacion de suficiencia de idiomas|constancia de idiomas','inscripcion de cursos de idiomas|nivel de idiomas','los trámites y registros administrativos del centro de idiomas','para facilitar la atención de los usuarios','Organizar']
 ];
 const knowledge=base.knowledge.domains.map(d=>({...d}));
 EXTRA.forEach(d=>knowledge.push({id:d[0],label:d[1],anchors:d[2].split('|'),terms:d[3].split('|'),obj:d[4],goal:d[5],verb:d[6],typical:[]}));
 knowledge.find(d=>d.id==='tecnologia').anchors.push('soporte informatico','incidencias informaticas');
 // Especializaciones para normalizar lenguaje coloquial, sin alterar entidades propias.
 const ALIASES=[
  [/\bpapeles\b/g,'documentos'],[/\bcompu(s)?\b/g,'computadoras'],
  [/\bchamba\b/g,'trabajo'],[/\btramite(s)?\b/g,'trámites'],
  [/\bexpediente(s)?\b/g,'expedientes'],[/\bsgr?d\s*unt\b/g,'sgdunt'],
  [/\bfotocopio\b/g,'fotocopio'],[/\bdocuemntos?\b/g,'documentos'],
  [/\bmatricual\b/g,'matrícula'],[/\bcertifcados\b/g,'certificados']
 ];
 function clean(v){let s=norm(v);for(const [re,replace] of ALIASES)s=s.replace(re,replace);return s}
 // Combinaciones comunes que deben conservar su objeto, aunque se separen las acciones.
 const ACTION_VERBS=[
  ['recibir','recib|recepcion|acog|me entregan|me llegan|ingresan solicitudes|me presentan','Recibir'],
  ['revisar','revis|verific|cotej|comprueb|chequ|comprob|examin|inspeccion','Verificar'],
  ['registrar','registr|anot|digit|ingres|cargo en el sistema|subo al sistema|asent','Registrar'],
  ['derivar','deriv|remit|envi|transmit|paso al area|canaliz','Derivar'],
  ['archivar','archiv|custodi|ordeno documentos|foli|clasific','Organizar'],
  ['digitalizar','digitaliz|escane|escan','Digitalizar'],
  ['redactar','elabor|redact|preparo oficios|preparo informes|preparar documentos|escrib|confeccion','Elaborar'],
  ['organizar','organizo|organizar|organizamos|ordeno actividades','Organizar'],
  ['atender','atiend|atend|orient|resuelvo consultas|absuelvo consultas','Atender'],
  ['seguir','seguimiento|monitore|hago seguimiento|rastre|supervis','Realizar seguimiento de'],
  ['coordinar','coordin|convoc|me reuno|organizo reuniones','Coordinar'],
  ['programar','programo|programar|programacion de clases|calendariz|agendar|agendo|planifico fechas','Programar'],
  ['actualizar','actualiz|modific|corrij|subsan|rectific','Actualizar'],
  ['consolidar','consolid|recopil|sistematiz|tabul|proceso datos|integro informacion','Consolidar'],
  ['reportar','report|informo avances|rindo cuentas','Reportar'],
  ['tramitar','tramit|gestion|doy curso','Tramitar'],
  ['controlar','controlo|controlar|verifico cumplimiento|fiscaliz','Controlar'],
  ['entregar','entreg|distribuy|repart|despach','Entregar'],
  ['pagar','efectuo pagos|realizo pagos|pago facturas|giro pagos|pago a','Efectuar'],
  ['aprobar','aprueb|aprob|autoriz','Aprobar'],
  ['firmar','firmo|firmar|suscrib|rubric','Suscribir'],
  ['evaluar','evaluo|evaluar|califico desempeno','Evaluar'],
  ['regar','riego|regar|podar|podo|deshierb|abono plantas|conservar jardines|conservar los jardines|conservar las areas verdes|conservar areas verdes','Conservar'],
  ['limpiar','limpi|barr|trape|desinfect|aseo los','Limpiar'],
  ['reparar','repar|mantengo equipos|arreglo equipos|soluciono averias','Realizar mantenimiento de'],
  ['trasladar','conduz|manejo vehiculos|transport|traslado personas|traslado materiales','Realizar traslados de'],
  ['instalar','instal|configur|habilito equipos','Instalar'],
  ['soportar','soporte tecnico|atiendo incidencias|resuelvo fallas|reinstal','Atender'],
  ['inventariar','inventari|hago inventario|cuento bienes|codifico bienes','Inventariar'],
  ['analizar','analiz|estudio datos|interpreto resultados','Analizar'],
  ['capacitar','capacit|enseno|instruy|dicto talleres','Capacitar'],
  ['diseñar','disen|formul|propongo instrumentos','Formular']
 ].map(([id,forms,verb])=>({id,forms:forms.split('|'),verb}));
 const SENSITIVE=new Set(['pagar','aprobar','firmar','evaluar']);
 const CLAIM=/\b(soy responsable|a mi cargo|me encargo|ejecuto directamente|realizo personalmente|yo (?:apruebo|firmo|pago|evaluo))\b/;
 const SUPP=/\b(solo (?:apoyo|ayudo|colaboro)|brindo apoyo|presto apoyo|apoyo en|apoyo a|ayudo a|colaboro con|en apoyo de|asisto a|por indicacion de|por encargo de|bajo indicaciones)\b/;
 const NOT_MY=/\b(el|la|mi|mis|los|las|un|una)\s+(?:decano|rector|jefe|jefa|director|directora|supervisor|coordinador|coordinadora|profesor|profesora|responsable|autoridad|otros?\s+servidores?)\s+(?:es |son |lo |la |los |las |se )?(?:encarg|firm|aprob|autoriz|pag|evalu|remit|revis|registr|deriv|resolv|valid)/;
 const NEG=/\b(?:no\s+(?:(?:me|nos|se|lo|la|los|las)\s+)?(?:encarg\w*|hago|realiz\w*|tramit\w*|revis\w*|registr\w*|aprueb\w*|aprob\w*|autoriz\w*|firm\w*|pag\w*|evalu\w*|deriv\w*|archiv\w*|entreg\w*|gestion\w*|coord\w*|supervis\w*|correspond\w*|particip\w*|asum\w*|manejo|condu\w*|emit\w*|ejecut\w*|prepar\w*|elabor\w*)|nunca|tampoco|no tengo a cargo|sin intervenir|eso no me corresponde|solo lo hace otra|lo realiza otra)\b/;
 const RELATED=[['documental','archivo','tramites','tramite_virtual','secretaria'],['asistencia','personal','rendimiento'],['audiovisuales','laboratorios','tecnologia']];
 const VERBS=ACTION_VERBS.flatMap(x=>x.forms).filter(x=>x.length>4&&!x.includes(' '));
 const splitRX=/\s*(?:\bpero\b\s*(?=no\b|solo\b)|\s+y\s+(?=no\b)|[;\n]+|[.!?]+\s+|,\s*(?=(?:y\s+)?(?:yo\s+)?(?:lo\s+|los\s+|las\s+)?(?:recibo|reviso|registro|derivo|tramito|elaboro|coordino|organizo|actualizo|digitalizo|no |solo |apruebo|firma|firmo|apoyo|atiendo|verifico|presento))|\s+(?:tambien|ademas|asimismo|despues|luego|posteriormente|por otro lado)\s+(?=(?:yo\s+)?\w+))\s*/i;
 function clauses(s){const parts=String(s||'').replace(/\r/g,'\n').split(splitRX).map(plain).filter(Boolean);return parts.slice(0,45)}
 function isNegative(t){return !/\bno solo\b/.test(t) && NEG.test(t)}
 function outsider(t){return NOT_MY.test(t) && !/\b(?:yo|nosotros|tambien)\s+(?:apoyo|elaboro|recibo|reviso|registro|derivo)\b/.test(t)}
 function detectRole(t){if(SUPP.test(t))return 'apoyo';if(CLAIM.test(t))return 'directo';return 'no_precisado'}
 function domainMatches(text){const t=clean(text);return knowledge.map(d=>{
  let hits=[],score=0;
  for(let k of d.anchors){if(isToken(t,k)){score+=7;hits.push(k)}}
  for(let k of d.terms){if(isToken(t,k)){score+=1.7;hits.push(k)}}
  if(d.id==='documental' && !d.anchors.some(x=>isToken(t,x)))score*=.72;
  if(d.id==='estadistica' && !d.anchors.some(x=>isToken(t,x)))score*=.62;
  if(d.id==='atencion' && !d.anchors.some(x=>isToken(t,x)))score*=.65;
  if(d.id==='personal' && isToken(t,'traslado de personal') && !isToken(t,'documentos'))score+=4;
  if(d.id==='transporte' && isToken(t,'traslado de personal') && !isToken(t,'vehiculo'))score*=.35;
  // Desambiguaciones que evitan dominios fuera de contexto.
  if(d.id==='transporte' && /\bderiv|expedient|document/.test(t) && !/vehicul|conduc|chofer|movilidad institucional/.test(t))score*=.12;
  if(d.id==='documental' && /\blaboratorio|\bnota[s]? academic|\binventario de bienes/.test(t) && !/\boficio|sgdunt|mesa de partes/.test(t))score*=.40;
  return {...d,score:Math.round(score*10)/10,hits};
 }).filter(d=>d.score>=1.65).sort((a,b)=>b.score-a.score||b.hits.length-a.hits.length)}
 function actionMatches(t){const found=[];for(const a of ACTION_VERBS){const hits=a.forms.filter(x=>isToken(t,x));if(hits.length)found.push({...a,hit:hits[0]})}
  if(found.some(x=>x.id==='redactar'))return found.filter(x=>x.id!=='reportar'||isToken(t,'reporto'));
  return found;
 }
 function evidence(s){const listed=[];let lastScope=null;
  for(let clause of clauses(s)){let t=clean(clause);
   if(!t||isNegative(t)){listed.push({clause,excluded:true,reason:'negada'});continue}
   if(outsider(t)){listed.push({clause,excluded:true,reason:'responsabilidad de otra persona'});continue}
   let ds=domainMatches(clause);
   let a=actionMatches(t);
   const strongest=ds[0]||lastScope;
   if(ds[0] && ds[0].score>=3.3)lastScope=ds[0];
   const role=detectRole(t);
   if(a.length || strongest)listed.push({clause,normalized:t,excluded:false,actions:a,domain:strongest,domains:ds,role});
  }
  return listed;
 }
 function combineEvidence(text,fn=''){
  const rows=evidence(text);const context=domainMatches(fn);
  const groups=new Map();const recognized=[];
  for(let e of rows.filter(x=>!x.excluded)){
   let d=e.domain || context[0];
   if(!d && !e.actions.length)continue;
   let key=d?.id||'otro';let g=groups.get(key);
   if(!g){g={domain:d,actions:[],chunks:[],role:'no_precisado',hitScore:0};groups.set(key,g)}
   g.chunks.push(e.clause);g.hitScore+=Math.max(0,e.domains[0]?.score||0);
   if(e.role==='apoyo')g.role='apoyo';else if(e.role==='directo'&&g.role!=='apoyo')g.role='directo';
   for(let a of e.actions){if(SENSITIVE.has(a.id) && g.role!=='directo' && e.role!=='directo')continue;
     if(!g.actions.some(x=>x.id===a.id))g.actions.push({...a,source:e.clause});recognized.push(a.id)}
  }
  const totalPositive=rows.filter(r=>!r.excluded).length;
  return {rows,groups:[...groups.values()].sort((a,b)=>b.hitScore-a.hitScore||b.actions.length-a.actions.length),
    recognized:unique(recognized),excluded:rows.filter(r=>r.excluded),totalPositive};
 }
 // Los sustantivos y los resultados siempre se vinculan al dominio interpretado,
 // pero no se inventan aprobaciones, constancias o firmas no mencionadas.
 const SPECIFIC={
  audiovisuales:{organizar:'los préstamos y reservas de equipos audiovisuales',entregar:'los equipos audiovisuales solicitados',registrar:'los préstamos de equipos audiovisuales',coordinar:'las solicitudes de préstamo de equipos audiovisuales'},
  documental:{organizar:'la documentación administrativa asignada',recibir:'los documentos y solicitudes presentados',revisar:'los requisitos de la documentación recibida',registrar:'los documentos en el SGDUNT',derivar:'los documentos a las unidades competentes',archivar:'los expedientes administrativos',digitalizar:'la documentación recibida',seguir:'los expedientes en trámite',redactar:'los oficios y documentos administrativos'},
  tramite_virtual:{recibir:'los documentos electrónicos recibidos',registrar:'los documentos en la plataforma virtual',derivar:'los documentos electrónicos al área competente'},
  matricula:{recibir:'las solicitudes de matrícula',revisar:'los requisitos de matrícula',registrar:'la información de matrícula de los estudiantes',actualizar:'los datos de matrícula de los estudiantes'},
  grados:{revisar:'los expedientes de grados y títulos',registrar:'los trámites de grados y títulos',derivar:'los expedientes de grados y títulos',archivar:'la documentación de grados y títulos'},
  horarios:{programar:'los horarios y ambientes académicos',actualizar:'la programación de aulas y horarios'},
  personal:{registrar:'los movimientos y registros de personal',actualizar:'los datos administrativos de los servidores',revisar:'la documentación administrativa de personal'},
  rendimiento:{registrar:'las metas e indicadores de rendimiento',seguir:'el avance de las metas e indicadores',consolidar:'las evidencias de seguimiento de metas'},
  asistencia:{registrar:'la información de asistencia y permanencia del personal',revisar:'las incidencias de asistencia del personal'},
  abastecimiento:{revisar:'los requerimientos de bienes y servicios',registrar:'los requerimientos de contratación',tramitar:'las órdenes y solicitudes de abastecimiento'},
  estadistica:{consolidar:'la información estadística requerida',redactar:'los informes y reportes estadísticos',actualizar:'los indicadores de gestión'},
  tecnologia:{revisar:'las incidencias informáticas comunicadas',registrar:'los requerimientos de soporte informático',soportar:'las incidencias de soporte técnico',atender:'las incidencias técnicas reportadas',instalar:'los equipos y sistemas asignados'},
  archivo:{archivar:'los expedientes bajo custodia',revisar:'la clasificación y ubicación de los expedientes',entregar:'los documentos solicitados por las unidades competentes'},
  secretaria:{coordinar:'la agenda del despacho',programar:'las reuniones y actividades del despacho',redactar:'los documentos administrativos del despacho'},
  areas_verdes:{regar:'los jardines y áreas verdes asignadas',limpiar:'las áreas verdes asignadas'},
  limpieza:{limpiar:'los ambientes asignados'},
  mantenimiento:{reparar:'las instalaciones y equipos asignados'},
  transporte:{trasladar:'las personas o materiales en los vehículos institucionales asignados'},
  biblioteca:{registrar:'los préstamos y devoluciones de material bibliográfico'},
  patrimonio:{inventariar:'los bienes patrimoniales asignados',registrar:'los bienes patrimoniales en el inventario'},
  admisión:{registrar:'las solicitudes y registros de postulantes',revisar:'los requisitos de inscripción de postulantes'}
 };
 const GENERIC_OBJ={
  organizar:'los registros y requerimientos administrativos asignados',recibir:'la documentación o solicitudes recibidas',revisar:'la documentación y los requisitos del procedimiento',registrar:'la información del procedimiento asignado',derivar:'la documentación a la unidad competente',archivar:'los documentos bajo custodia',digitalizar:'los documentos asignados',redactar:'los documentos administrativos requeridos',atender:'las consultas y solicitudes de los usuarios',seguir:'los trámites o acciones pendientes',coordinar:'las actividades y requerimientos asignados',programar:'las actividades o fechas requeridas',actualizar:'los registros y datos del procedimiento',consolidar:'la información recopilada',reportar:'los resultados de las labores realizadas',tramitar:'las solicitudes del procedimiento asignado',entregar:'los documentos o materiales asignados',regar:'los jardines y áreas verdes asignadas',limpiar:'los espacios asignados',reparar:'los equipos e instalaciones asignados',trasladar:'las personas o materiales asignados',instalar:'los equipos y sistemas asignados',soportar:'los requerimientos de soporte reportados',inventariar:'los bienes a cargo',analizar:'la información recopilada',capacitar:'a los participantes en las materias asignadas',diseñar:'las propuestas o instrumentos asignados',controlar:'los registros y actividades bajo control',pagar:'los pagos expresamente autorizados',aprobar:'los trámites de su competencia',firmar:'los documentos de su competencia',evaluar:'los resultados de competencia asignada'
 };
 function specificObject(d,a,scope=''){
  let t=clean(scope),object=SPECIFIC[d?.id]?.[a.id]||GENERIC_OBJ[a.id]||'las actividades asignadas';
  if(d?.id==='documental' && a.id==='registrar' && !/sgdunt/.test(t))object='los documentos en el registro institucional correspondiente';
  if(a.id==='redactar'){
    if(isToken(t,'informe') && !isToken(t,'oficio'))object='los informes administrativos asignados';
    if(isToken(t,'oficio') && !isToken(t,'informe'))object='los oficios administrativos asignados';
    if(isToken(t,'acta') && !isToken(t,'informe') && !isToken(t,'oficio'))object='las actas de las reuniones asignadas';
  }
  return object;
 }
 const PRODUCT_GENERAL={
  organizar:'Solicitudes o recursos organizados',recibir:'Documentación recibida',revisar:'Expedientes o solicitudes revisados',registrar:'Registros administrativos actualizados',derivar:'Documentos derivados',digitalizar:'Documentos digitalizados',archivar:'Expedientes organizados o archivados',redactar:'Documentos elaborados',atender:'Consultas o solicitudes atendidas',seguir:'Registro de seguimiento actualizado',coordinar:'Coordinaciones administrativas realizadas',programar:'Programación de actividades actualizada',actualizar:'Registros actualizados',consolidar:'Información consolidada',reportar:'Reportes elaborados',tramitar:'Solicitudes tramitadas',entregar:'Materiales o documentos entregados',regar:'Áreas verdes atendidas',limpiar:'Ambientes atendidos',reparar:'Servicios de mantenimiento realizados',trasladar:'Traslados realizados',instalar:'Equipos o sistemas habilitados',soportar:'Incidencias de soporte atendidas',inventariar:'Registros de inventario actualizados',analizar:'Análisis elaborados',capacitar:'Sesiones de capacitación realizadas',diseñar:'Propuestas elaboradas',controlar:'Registros de control actualizados',pagar:'Pagos procesados',aprobar:'Trámites aprobados',firmar:'Documentos suscritos',evaluar:'Evaluaciones realizadas'
 };
 const PRODUCT_SPEC={
  audiovisuales:{organizar:'Préstamos o reservas de equipos audiovisuales organizados'},
  documental:{registrar:'Documentos registrados en el SGDUNT',derivar:'Documentos derivados a las unidades competentes',revisar:'Documentación revisada',organizar:'Solicitudes o recursos organizados',recibir:'Documentación recibida'},
  matricula:{registrar:'Registros de matrícula actualizados',actualizar:'Datos de matrícula actualizados',revisar:'Solicitudes de matrícula revisadas'},
  grados:{revisar:'Expedientes de grados y títulos revisados',derivar:'Expedientes de grados y títulos derivados'},
  rendimiento:{seguir:'Registros de seguimiento de metas actualizados',consolidar:'Evidencias de cumplimiento organizadas'},
  personal:{registrar:'Registros administrativos de personal actualizados'},
  secretaria:{programar:'Agenda del despacho actualizada'},
  tecnologia:{soportar:'Incidencias técnicas atendidas',instalar:'Equipos y sistemas habilitados'},
  areas_verdes:{regar:'Áreas verdes atendidas'},
  limpieza:{limpiar:'Ambientes limpios o desinfectados'},
  archivo:{archivar:'Expedientes clasificados y organizados'},
  transporte:{trasladar:'Servicios de traslado realizados'},
  patrimonio:{inventariar:'Inventario patrimonial actualizado'},
  biblioteca:{registrar:'Préstamos y devoluciones registrados'}
 };
 const isWeak=s=>/^las actividades relacionadas con\b|^realizar tareas\b|^hacer\b/i.test(s);
 function functionText(g){const d=g.domain;if(!d)return null;
  const role=g.role==='apoyo';let verb=role?'Apoyar':sentence((d.verb||'Gestionar').toLowerCase());
  let object=d.obj.toLowerCase(),goal=d.goal;
  if(d.id==='matricula')goal='para contribuir a la atención oportuna de los procedimientos académicos';
  if(d.id==='clinica'){object='los registros administrativos de la atención clínica';verb='Organizar';}
  if(verb==='Registrar'&&/^los registros/.test(object)){verb='Mantener actualizados';}
  // Conservar la arquitectura: verbo + objeto + atributo. Evitar dobles sustantivos.
  if(role){verb='Brindar apoyo en';if(/^los |^las |^el |^la /i.test(object))object='la gestión de '+object;}
  const t=clean(g.chunks.join(' '));
  if(['Apoyar','Brindar apoyo'].includes(verb) && !role){verb='Gestionar';object='la documentación y los trámites relacionados con '+object.replace(/^las solicitudes y registros del /,'el ');}
  if(d.id==='documental'&&/sgdunt/.test(t)&&['recibir','registrar','derivar'].filter(x=>g.actions.some(a=>a.id===x)).length>=2){
   verb=role?'Apoyar':'Gestionar';object=role?'la recepción, el registro y la derivación de documentos en el SGDUNT':'la recepción, el registro y la derivación de documentos en el SGDUNT';
  }
  if(d.id==='estadistica'&&g.actions.some(x=>x.id==='consolidar')&&/reporte|informe/.test(t)){verb=role?'Apoyar':'Consolidar';object='la información y los reportes administrativos';}
  if(d.id==='areas_verdes'&&g.actions.some(x=>x.id==='regar')){verb=role?'Apoyar':'Realizar';object=role?'las labores de mantenimiento de áreas verdes':'el mantenimiento de los jardines y áreas verdes asignados';}
  if(d.id==='secretaria'&&g.actions.some(x=>x.id==='programar')){verb=role?'Apoyar':'Organizar';object='las agendas y coordinaciones administrativas del despacho';}
  if(role && /^(gestionar|apoyar|brindar apoyo)/i.test(verb)&&/^(la gestión|el apoyo)/i.test(object))object=object.replace(/^la gestión de la gestión de\s*/,'la gestión de ');
  return out(`${verb} ${object} ${goal.toLocaleLowerCase('es-PE')}`);
 }
 function directComplement(a,source){
  const text=plain(source);
  const simplified=clean(source);
  // Extrae complementos declarados explícitamente. Nunca crea un objeto no mencionado.
  // Se evita reutilizar textos que contienen negaciones, referencias a terceros o frases vagas.
  if(isNegative(simplified)||outsider(simplified))return null;
  const words=(a.forms||[]).filter(x=>!x.includes(' ')).sort((x,y)=>y.length-x.length);
  for(const root of words){
    const match=new RegExp('\\b('+root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[a-zñ]*)\\b','i').exec(simplified);
    if(!match)continue;
    let rest=text.slice(match.index+match[0].length).trim();
    if(!rest)continue;
    rest=rest.replace(/^[,:;\s]+/,'').replace(/\s+(?:pero|aunque|sin embargo)\s+.*$/i,'');
    rest=rest.replace(/\s+y\s+(?=(?:lo\s+|la\s+|los\s+|las\s+)?(?:recibo|reviso|registro|derivo|envio|elaboro|coordino|instalo|configuro|digitalizo|archivo|actualizo|corrijo|entrego|consolido|reporto|firmo|apruebo|resuelvo|superviso|pago|conduzco)\b).*$/i,'');
    rest=rest.replace(/\s*,\s*(?=(?:lo\s+|la\s+|los\s+|las\s+)?(?:recibo|reviso|registro|derivo|envio|elaboro|coordino|instalo|configuro|digitalizo|archivo|actualizo|entrego|consolido|reporto|firmo|apruebo)\b).*$/i,'');
    rest=plain(rest).replace(/[,;.!?]+$/,'');
    if(!/^(?:un|una|el|la|los|las|a|con|de|en|por|para|sobre|mediante)\b/i.test(rest)){
      if(/^[a-záéíóúñ]/i.test(rest) && rest.length>=10)rest=rest;
    }
    if(rest.length<15||rest.length>135||/^(?:y|de|del|la información|para su|lo que|de todo|mi trabajo|cosas|muchas actividades)\b/i.test(rest))continue;
    if(/(?:\b(?:porque|ya que|cuando)\b)/i.test(rest))continue;
    return rest;
  }
  return null;
 }
 function activityText(a,d,scope){let action=a.verb||'Realizar';let object=specificObject(d,a,scope);
  const exact=directComplement(a,a.source||scope);
  if(exact && !['pagar','aprobar','firmar','evaluar'].includes(a.id)) object=exact;
  if(a.id==='seguir')action='Realizar el seguimiento de';
  if(a.id==='registrar' && /^los registros/i.test(object)){action='Mantener actualizados';object=object.replace(/^los registros/i,'los registros');}
  if(a.id==='trasladar')action='Realizar el traslado de';
  if(a.id==='reparar')action='Realizar el mantenimiento de';
  if(action==='Atender'&&/^a los/.test(object))action='Orientar';
  if(/^(realizar el seguimiento de|realizar el traslado de|realizar el mantenimiento de)$/.test(action.toLowerCase()) && /^el |^la /.test(object))object=object.replace(/^(el|la)\s+/,'');
  return out(`${action} ${object}`);
 }
 function productText(a,d,scope){const t=clean(scope);
   if(a.id==='redactar'){
     if(isToken(t,'informe')&&!isToken(t,'oficio'))return 'Informes elaborados';
     if(isToken(t,'oficio')&&!isToken(t,'informe'))return 'Oficios elaborados';
     if(isToken(t,'acta')&&!isToken(t,'informe'))return 'Actas elaboradas';
     if(isToken(t,'memorando'))return 'Memorandos elaborados';
   }
   if(a.id==='registrar'&&d?.id==='documental'&&!isToken(t,'sgdunt'))return 'Documentos registrados en el sistema institucional correspondiente';
   return PRODUCT_SPEC[d?.id]?.[a.id]||PRODUCT_GENERAL[a.id]||null;
 }
 function notInventedText(g){const s=plain(g.chunks.join(' '));const part=s.match(/(?:me encargo de|soy responsable de|consiste en|apoyo en|apoyo a)\s+(.{14,140})/i);
  if(!part)return null;
  let obj=part[1].replace(/\s+(?:pero|aunque|sin embargo).*$/i,'').replace(/[;.!?].*$/,'');
  if(/\b(no hago|no realizo|no apruebo|no firmo)/i.test(obj))return null;
  const role=g.role==='apoyo'?'Apoyar':'Desarrollar';
  return out(`${role} las labores relacionadas con ${obj} conforme a las responsabilidades efectivamente asignadas`)
 }
 function explain(c){const total=c.groups.length,excluded=c.excluded.map(x=>({fragmento:x.clause,motivo:x.reason}));
  return {motor:'interpretacion-contextual-local',version:VERSION,procesos:c.groups.map((g,i)=>({nombre:g.domain?.label||'Otro proceso',prioridad:i+1,acciones:g.actions.map(x=>x.id),fragmentos:g.chunks.slice(0,4),nivelResponsabilidad:g.role})).slice(0,6),
    accionesDeclaradas:c.recognized,fragmentosExcluidos:excluded.slice(0,8),nivelResponsabilidad:c.groups.some(g=>g.role==='apoyo')?'apoyo':c.groups.some(g=>g.role==='directo')?'directo':'no_precisado',
    interpretacion:'reglas-y-contexto', certeza:total===0?'Insuficiente':c.groups[0]?.domain?.score>=10?'Media-alta (basada en coincidencias)':'Orientativa',
    advertencia:'Estas son interpretaciones orientativas, no verificaciones de responsabilidades reales.'};
 }
 function dynamicQuestion(target,c,details){
  if(target==='function'){
   if(c.groups.length===0)return '¿A qué proceso, servicio o trámite corresponde su trabajo y qué resultado obtiene?';
   if(c.groups[0]?.role==='no_precisado' && c.groups[0]?.actions.some(a=>SENSITIVE.has(a.id)))return '¿Usted tiene formalmente a cargo esa decisión o únicamente prepara la información para quien autoriza o firma?';
   if(c.groups[0]?.actions.length===0)return '¿Qué acciones concretas realiza dentro de este proceso?';
  }
  if(target==='activity')return c.groups.length?'¿Qué hace usted directamente, paso a paso, para cumplir esta función?':'¿Qué acciones concretas realiza y sobre qué documentos, servicios o personas?';
  if(target==='product')return '¿Qué documento, registro actualizado o servicio efectivamente realizado queda como resultado de esa actividad?';
  return '';
 }
 function generate(req){req=req||{};const target=req.objetivoDelCampo||'function';
  const extra=[req.descripcion,req.detalleNuevo,...(req.respuestas||[]).map(x=>typeof x==='string'?x:x?.respuesta)].filter(Boolean).join('. ');
  const fn=plain(req.contextoFuncion),ac=plain(req.contextoActividad);
  const full=extra||ac||fn;
  const c=combineEvidence(target==='function'?full:extra,fn);
  let diagnosis=explain(c);const result=(propuestas=[],preguntas=[],alertas=[])=>({propuestas,preguntas,alertas,diagnostico:diagnosis});
  if(target==='function'){
   if(plain(extra).length<16)return result([],['Describa qué tareas realiza, qué atiende y cuál es el propósito principal de su trabajo.'],[]);
   if(!c.groups.length){const legacy=base.generate(req);return {...legacy,diagnostico:diagnosis,alertas:unique([...(legacy.alertas||[]),'No se reconoció un proceso con suficiente evidencia; revise detenidamente la formulación.'])};}
   let proposals=[],alerts=[];const active=c.groups.filter(g=>g.domain&&g.hitScore>=1.6).slice(0,3);
   for(let g of active){const f=functionText(g);if(f&&!proposals.some(x=>norm(x.funcion)===norm(f)))proposals.push({funcion:f,actividades:[]});}
   if(!proposals.length){let fallback=notInventedText(c.groups[0]);if(fallback)proposals.push({funcion:fallback,actividades:[]});}
   if(c.excluded.length)alerts.push('Se omitieron acciones negadas o atribuidas a otras personas; revise que la interpretación sea correcta.');
   if(active.length>=2)alerts.push(`Se identificaron ${active.length} procesos distintos. Considere registrarlos como funciones separadas, si corresponde.`);
   if(active.some(g=>g.role==='apoyo'))alerts.push('Se ha conservado el carácter de apoyo declarado, sin atribuir automáticamente facultades decisorias.');
   if(!proposals.length)return result([], [dynamicQuestion(target,c,extra)],alerts);
   const weak=c.groups[0]?.actions.length===0;
   return result(proposals,weak?[dynamicQuestion(target,c,extra)]:[],alerts);
  }
  if(target==='activity'){
   if(!fn)return result([],['Registre primero la función a la cual pertenecerán estas actividades.'],[]);
   const fnDomain=domainMatches(fn)[0];
   if(!plain(extra)){return result([],['Cuénteme cómo realiza esa función: ¿qué hace primero, qué verifica y qué registra o entrega?'],[])}
   let acts=[];let groups=c.groups.length?c.groups:[{domain:fnDomain,actions:[],chunks:[extra],role:detectRole(clean(extra))}];
   for(let g of groups){for(let a of g.actions){if(SENSITIVE.has(a.id)&&g.role!=='directo')continue;
     const usedDomain=(g.domain?.score>=3.3?g.domain:fnDomain)||g.domain;
     if(fnDomain && g.domain && fnDomain.id!==g.domain.id && g.domain.score>=1.65 && !RELATED.some(f=>f.includes(fnDomain.id)&&f.includes(g.domain.id)))continue;
     if(usedDomain?.id==='tecnologia' && a.id==='atender' && g.actions.some(x=>x.id==='soportar'))continue;
     const t=activityText(a,usedDomain,g.chunks.join(' '));if(t&&!acts.some(y=>norm(y.actividad)===norm(t)))acts.push({actividad:t,productos:[]});
   }}
   if(!acts.length)return result([], [dynamicQuestion(target,c,extra)],['No se propondrán actividades no descritas por el servidor.']);
   const past=req.borradorActual?.actividades||[];
   const merged=unique([...past.map(x=>plain(x?.actividad)),...acts.map(x=>x.actividad)]).slice(0,22).map(actividad=>({actividad,productos:[]}));
   const warnings=[];
   if(c.excluded.length)warnings.push('Se excluyeron acciones negadas o que el servidor atribuyó a otras personas.');
   if(c.groups.length>1)warnings.push('Se identificaron actividades de distintos procesos; verifique que pertenezcan a la función indicada.');
   return result([{funcion:fn,actividades:merged}],[],warnings);
  }
  if(target==='product'){
   if(!ac)return result([],['Registre primero la actividad a la que corresponde este resultado.'],[]);
   const actionTextOriginal=ac+(extra?'. '+extra:'');
   const d=domainMatches(fn+' '+ac)[0]||c.groups[0]?.domain;
   let acts=actionMatches(clean(ac)).filter(a=>!SENSITIVE.has(a.id)||detectRole(clean(ac))==='directo');
   // Actividad escrita como sustantivo (por ejemplo, «registro de documentos»).
   // Sólo se usa una inferencia si existe correspondencia exacta actividad-resultados.
   if(!acts.length){const nounMap=[['registro de','registrar'],['derivacion de','derivar'],['recepcion de','recibir'],['elaboracion de','redactar'],['revision de','revisar'],['seguimiento de','seguir'],['actualizacion de','actualizar'],['limpieza de','limpiar'],['mantenimiento de','reparar'],['organizacion de','archivar']];
    let noun=nounMap.find(([s])=>clean(ac).includes(s));if(noun)acts=ACTION_VERBS.filter(x=>x.id===noun[1]);
   }
   let products=[];
   // Los productos explícitos del propio servidor tienen prioridad.
   const explicit=plain(extra).match(/(?:producto|resultado|entregable|queda|genero|obtengo|se obtiene|entrego)\s*(?:es|son|un|una|los|las|como|:)?\s*([^.!?\n]{7,120})/i);
   if(explicit){let raw=plain(explicit[1]).replace(/^(?:un|una|los|las|el|la)\s+/i,'');if(raw.length>=8&&!/^(?:yo|nosotros)\b/i.test(raw))products.push(out(raw));}
   for(const a of acts){let p=productText(a,d,actionTextOriginal);if(p)products.push(out(p));}
   const prior=req.borradorActual?.actividades?.[0]?.productos||[];
   let all=unique([...prior.map(plain),...products]).slice(0,7);
   if(!all.length)return result([], [dynamicQuestion(target,c,extra)],['Para evitar entregables inexistentes, indique un resultado verificable.']);
   let warn=[];
   if(acts.length>1)warn.push('Esta actividad parece contener varias acciones. Verifique si corresponde dividirla antes de identificar sus productos.');
   warn.push('Confirme el producto real: puede ser un documento, registro, servicio o resultado de trabajo, no necesariamente un informe.');
   return result([{funcion:fn,actividades:[{actividad:ac,productos:all}]}],[],warn);
  }
  return base.generate(req);
 }
 function diagnosticar(text){const c=combineEvidence(text);return explain(c)}
 root.UNT_LOCAL_ASSISTANT=Object.freeze({generate,diagnosticar,advice:base.advice,version:VERSION,type:'motor-local-contextual',catalogo:knowledge.length,knowledge:knowledge});
})(window);
