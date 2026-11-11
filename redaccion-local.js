/*
 * UNT · Motor de interpretación funcional V16. Sin red, modelos descargables ni APIs.
 * No se transmite ni persiste el texto. Sugerencias editables; jamás acredita funciones.
 * Arquitectura: normalización + extracción de acciones + detección multitemática
 * + distinción de responsabilidad + formulación contextual + validación.
 */
(function(root){
 'use strict';
 const VERSION='2.0.0';
 const C=v=>String(v??'').replace(/\s+/g,' ').trim();
 const N=v=>C(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const U=v=>C(v).toLocaleUpperCase('es-PE');
 const finish=v=>/[.!?]$/.test(C(v))?C(v):C(v)+'.';
 const uniq=a=>Array.from(new Set(a.filter(Boolean)));
 const has=(s,roots)=>roots.some(r=>r.includes(' ')?s.includes(r):new RegExp('(^|[^a-zñ])'+r+'[a-zñ]*','i').test(s));
 // No se "corrigen" nombres, dependencias ni siglas institucionales.
 const commonTypos={recivo:'recibo',resivo:'recibo',recivir:'recibir',rejistro:'registro',rejistrar:'registrar',solisitud:'solicitud',solisitudes:'solicitudes',expendiente:'expediente',expendientes:'expedientes',derivasion:'derivacion',tramites:'tramites',tramitasion:'tramitacion',vinculasion:'vinculacion',archibo:'archivo',carpetaas:'carpetas',despachoo:'despacho',docuemnto:'documento',documentso:'documentos',matricual:'matricula',matricuala:'matricula',matricuals:'matriculas',asuarios:'usuarios',solcitudes:'solicitudes',informaticaa:'informatica',presupuuesto:'presupuesto',imformes:'informes',informess:'informes',asisitencia:'asistencia',progamacion:'programacion',actualziar:'actualizar',coordinarciones:'coordinaciones',paples:'papeles',secretria:'secretaria',solcitantes:'solicitantes'};
 function tidy(text){return N(text).replace(/\b[a-zñ]+\b/g,t=>commonTypos[t]||t).replace(/\bsgd\s*unt\b/g,'sgdunt');}
 function toks(s){return (s.match(/[a-zñ]{3,}/g)||[]).filter(x=>!stop.has(x));}
 const stop=new Set('para con los las una uno unos unas del por que sobre entre desde hacia esta este estos estas cada como tambien donde cuya cuales porque luego segun personas tienen dentro cuando mediante aquello esta sobre debo todos todas deben cuales mismo tiene toda todo hacer realice realiza realizo realizan hago hacemos labor labores trabajo trabajos area unidad facultad personal respectivo respectiva correspondientes correspondiente debidamente diversos diversas muy algo mucho algunos algunas encargan encargo encargar'.split(' '));
 function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const now=[i];for(let j=1;j<=b.length;j++)now[j]=Math.min(now[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=now;}return prev[b.length]}
 const DOMAIN_ROWS=[
 // id | nombre | anclas (alta especificidad) | vocabulario | objeto | finalidad | verbo base | actividades sugeridas
 ['documental','Gestión documentaria','sgdunt|mesa de partes|tramite documentario|sistema de gestion documental|correspondencia','expedient|ofici|memorand|document|deriv|archiv|solicitud|recepcion','LA DOCUMENTACIÓN ADMINISTRATIVA','PARA FACILITAR SU TRAZABILIDAD Y TRAMITACIÓN OPORTUNA','GESTIONAR','RECIBIR Y VERIFICAR LA DOCUMENTACIÓN PRESENTADA|REGISTRAR LA DOCUMENTACIÓN EN EL SISTEMA INSTITUCIONAL CORRESPONDIENTE|DERIVAR LOS DOCUMENTOS A LAS UNIDADES COMPETENTES'],
 ['grados','Grados y títulos','bachiller|titulacion|sustentacion|grado academico|grados y titulos|diploma','egresad|tesis|jurado|titulo profesional','LOS EXPEDIENTES ADMINISTRATIVOS DE GRADOS Y TÍTULOS','PARA CONTRIBUIR A SU TRAMITACIÓN SEGÚN LOS PROCEDIMIENTOS APLICABLES','TRAMITAR','REVISAR LOS REQUISITOS ADMINISTRATIVOS DE LOS EXPEDIENTES|ORGANIZAR LA DOCUMENTACIÓN DE GRADOS Y TÍTULOS|REGISTRAR LAS SOLICITUDES EN EL CONTROL CORRESPONDIENTE'],
 ['matricula','Matrícula académica','matricula|rematricula|reserva de matricula|rectificacion de matricula','inscripci|alumno|estudiant|curso matriculad','LAS SOLICITUDES Y REGISTROS DEL PROCESO DE MATRÍCULA','PARA FACILITAR LA ATENCIÓN DE LOS PROCEDIMIENTOS ACADÉMICOS','APOYAR','RECIBIR LAS SOLICITUDES RELACIONADAS CON MATRÍCULA|VERIFICAR LOS REQUISITOS ADMINISTRATIVOS DE LAS SOLICITUDES|REGISTRAR LAS ATENCIONES EN EL SISTEMA CORRESPONDIENTE'],
 ['horarios','Programación académica','carga academica|horario de clases|programacion academica|distribucion de aulas|secciones academicas','horari|aula|turnos de clase|asignatura|docentes horarios','LA INFORMACIÓN DE HORARIOS Y PROGRAMACIÓN ACADÉMICA','PARA CONTRIBUIR A SU DISPONIBILIDAD Y ACTUALIZACIÓN OPORTUNAS','ORGANIZAR','RECOPILAR LOS DATOS DE PROGRAMACIÓN ACADÉMICA|ACTUALIZAR LOS CUADROS DE HORARIOS Y AMBIENTES|COMUNICAR LOS CAMBIOS DE PROGRAMACIÓN A LOS INTERESADOS'],
 ['actas','Actas y registros académicos','actas de notas|acta de evaluacion|sistema de notas|registro de notas','calificacion|nota|evaluacion academica|acta academica','LAS ACTAS Y REGISTROS ACADÉMICOS','PARA FACILITAR SU CONTROL Y DISPONIBILIDAD ADMINISTRATIVA','ORGANIZAR','REVISAR LA INFORMACIÓN DE LAS ACTAS ACADÉMICAS|REGISTRAR LAS ACTAS RECIBIDAS|ORGANIZAR LA DOCUMENTACIÓN ACADÉMICA CORRESPONDIENTE'],
 ['certificados','Constancias y certificados','constancia de estudios|certificado de estudios|historial academico|certificado academico','constancia|certificad|record academico|record de notas','LAS SOLICITUDES DE CONSTANCIAS Y CERTIFICACIONES ACADÉMICAS','PARA CONTRIBUIR A SU EMISIÓN Y ENTREGA CONFORME AL PROCEDIMIENTO','TRAMITAR','REVISAR LOS REQUISITOS DE LAS SOLICITUDES|PREPARAR LA INFORMACIÓN ADMINISTRATIVA REQUERIDA|REGISTRAR EL ESTADO DE LOS TRÁMITES'],
 ['laboratorios','Laboratorios universitarios','laboratorio|reactiv|instrumental|material biologico','insum|equipos de practica|practicas de laboratorio|muestras','LOS RECURSOS Y REGISTROS DE LABORATORIO','PARA FACILITAR EL DESARROLLO DE LAS PRÁCTICAS ACADÉMICAS','APOYAR','REGISTRAR LAS NECESIDADES DE MATERIALES DEL LABORATORIO|ORGANIZAR LA INFORMACIÓN DEL USO DE EQUIPOS|CONTROLAR LOS MATERIALES SEGÚN LAS LABORES ASIGNADAS'],
 ['biblioteca','Biblioteca y acervo','biblioteca|prestamo bibliografico|catalogo bibliografico|repositorio institucional','libro|revista cientifica|acervo|material bibliografico','EL SERVICIO Y LOS REGISTROS BIBLIOTECARIOS','PARA FACILITAR LA CONSULTA Y DISPONIBILIDAD DEL MATERIAL','APOYAR','REGISTRAR LOS PRÉSTAMOS Y DEVOLUCIONES DEL MATERIAL|ORGANIZAR EL MATERIAL BIBLIOGRÁFICO|ORIENTAR SOBRE LA CONSULTA DE LOS RECURSOS DISPONIBLES'],
 ['investigacion','Investigación universitaria','investigacion|proyecto de investigacion|semillero de investigacion|publicacion cientifica','articulo cientifico|investigadores|estudio academico|proyect investig','LA INFORMACIÓN ADMINISTRATIVA DE ACTIVIDADES DE INVESTIGACIÓN','PARA APOYAR EL SEGUIMIENTO DE LOS PROCEDIMIENTOS DE INVESTIGACIÓN','APOYAR','REGISTRAR LA INFORMACIÓN DE LOS PROYECTOS DE INVESTIGACIÓN|ORGANIZAR LOS EXPEDIENTES O DOCUMENTOS PRESENTADOS|CONSOLIDAR LA INFORMACIÓN REQUERIDA'],
 ['proyeccion','Extensión y proyección social','proyeccion social|responsabilidad social universitaria|extension universitaria|voluntariado universitario','comunidad|extension|programa social|proyecto social','LAS ACTIVIDADES ADMINISTRATIVAS DE EXTENSIÓN Y PROYECCIÓN SOCIAL','PARA FACILITAR LA COORDINACIÓN DE LAS INICIATIVAS INSTITUCIONALES','APOYAR','RECOPILAR LA INFORMACIÓN DE LAS ACTIVIDADES PROGRAMADAS|COORDINAR LOS REQUERIMIENTOS ADMINISTRATIVOS|ELABORAR LOS REGISTROS DE ACTIVIDADES REALIZADAS'],
 ['bienestar','Bienestar universitario','bienestar universitario|beca estudiantil|servicio social universitario|comedor universitario','beneficiario|subvencion estudiantil|becari|ayuda estudiantil','LAS SOLICITUDES Y REGISTROS DE BIENESTAR UNIVERSITARIO','PARA CONTRIBUIR A LA ATENCIÓN DE LOS USUARIOS','APOYAR','REVISAR LAS SOLICITUDES DE LOS USUARIOS|ACTUALIZAR LOS REGISTROS DE ATENCIÓN|DERIVAR LAS CONSULTAS A LAS UNIDADES COMPETENTES'],
 ['presupuesto','Presupuesto público','certificacion presupuestal|presupuesto institucional|modificacion presupuestaria|pim|pia|s iaf','presupuest|nota presupuest|clasificador de gasto|meta presupuestaria','LA INFORMACIÓN Y LOS TRÁMITES PRESUPUESTARIOS','PARA CONTRIBUIR A SU REGISTRO Y SEGUIMIENTO','APOYAR','RECOPILAR LOS SUSTENTOS ADMINISTRATIVOS|VERIFICAR LA INFORMACIÓN DEL TRÁMITE PRESUPUESTARIO|REGISTRAR EL ESTADO DE LOS EXPEDIENTES'],
 ['tesoreria','Tesorería','tesoreria|giro bancario|cuenta bancaria|conciliacion bancaria|deposito bancario','cobranza|pago|transferencia|abono|giro|recaudacion','LOS REGISTROS Y TRÁMITES DE TESORERÍA','PARA CONTRIBUIR A SU CONTROL Y ATENCIÓN OPORTUNOS','APOYAR','VERIFICAR LA DOCUMENTACIÓN DE SUSTENTO|REGISTRAR LA INFORMACIÓN DE LOS TRÁMITES|ORGANIZAR LOS DOCUMENTOS DE TESORERÍA'],
 ['contabilidad','Contabilidad','contabilidad|asiento contable|registro contable|devengado|comprobante de pago','factur|recibo de honorario|comprobante|contable|balance','LA DOCUMENTACIÓN Y LOS REGISTROS CONTABLES','PARA CONTRIBUIR A SU ORGANIZACIÓN Y REGISTRO','APOYAR','RECOPILAR LOS COMPROBANTES Y SUSTENTOS|VERIFICAR LA INFORMACIÓN CONTABLE RECIBIDA|ORGANIZAR LOS DOCUMENTOS CORRESPONDIENTES'],
 ['abastecimiento','Abastecimiento y adquisiciones','abastecimiento|logistica|orden de compra|orden de servicio|cuadro multianual de necesidades|cmn|contrataciones del estado|osce','adquisic|compra|cotizacion|requerimiento|proveedor|pecosa','LOS REQUERIMIENTOS Y EXPEDIENTES DE ABASTECIMIENTO','PARA CONTRIBUIR A LA ATENCIÓN DE LAS NECESIDADES DE BIENES Y SERVICIOS','APOYAR','RECOPILAR LOS REQUERIMIENTOS DE BIENES Y SERVICIOS|ORGANIZAR LOS SUSTENTOS DE LOS REQUERIMIENTOS|REALIZAR EL SEGUIMIENTO DE LAS ATENCIONES'],
 ['patrimonio','Control patrimonial','control patrimonial|inventario patrimonial|bien patrimonial|alta de bienes|baja de bienes','inventari|activo fijo|codificacion|patrimoni|movimiento de bienes','LOS REGISTROS Y EL CONTROL ADMINISTRATIVO DE BIENES PATRIMONIALES','PARA CONTRIBUIR A SU IDENTIFICACIÓN Y TRAZABILIDAD','APOYAR','VERIFICAR LA INFORMACIÓN DE LOS BIENES ASIGNADOS|ACTUALIZAR LOS REGISTROS DE CONTROL PATRIMONIAL|REPORTAR LOS CAMBIOS O INCIDENCIAS IDENTIFICADAS'],
 ['almacen','Almacén y materiales','almacen|kardex|stock|existencias de materiales|salida de almacen','insum|material|suministro|distribucion de bienes','LOS REGISTROS DE ENTRADA Y SALIDA DE MATERIALES','PARA FACILITAR EL CONTROL DE LAS EXISTENCIAS','CONTROLAR','REGISTRAR EL INGRESO DE LOS MATERIALES|VERIFICAR LAS EXISTENCIAS DISPONIBLES|REGISTRAR LAS SALIDAS SEGÚN LAS ATENCIONES REALIZADAS'],
 ['personal','Administración de personal','legajo|planilla|nomina de personal|contrato cas|desplazamiento de personal','contrataci|servidor|rrhh|recurso humano|licencia del personal|vacacion|cese','LA INFORMACIÓN ADMINISTRATIVA DEL PERSONAL','PARA CONTRIBUIR A LA ACTUALIZACIÓN DE LOS REGISTROS Y TRÁMITES CORRESPONDIENTES','APOYAR','RECOPILAR LA DOCUMENTACIÓN ADMINISTRATIVA DEL PERSONAL|ACTUALIZAR LOS REGISTROS ASIGNADOS|ORGANIZAR LOS EXPEDIENTES DE PERSONAL'],
 ['asistencia','Asistencia y control de personal','control de asistencia|marcacion de asistencia|registro de asistencia|papeleta de salida|tardanza','marcacion|asistencia del personal|inasistencia|permiso laboral','LOS REGISTROS DE ASISTENCIA Y PERMANENCIA DEL PERSONAL','PARA CONTRIBUIR AL CONTROL ADMINISTRATIVO CORRESPONDIENTE','REGISTRAR','RECOPILAR LOS REGISTROS DE ASISTENCIA|VERIFICAR LAS INCIDENCIAS REPORTADAS|ELABORAR LA INFORMACIÓN DE CONTROL DE ASISTENCIA'],
 ['capacitacion','Capacitación de personal','plan de desarrollo de personas|pdp|capacitacion del personal|curso de formacion','curso|taller|participantes|aprendizaje|desarrollo de capacidades','LAS ACTIVIDADES ADMINISTRATIVAS DE CAPACITACIÓN DEL PERSONAL','PARA FACILITAR SU ORGANIZACIÓN Y SEGUIMIENTO','APOYAR','REGISTRAR LAS NECESIDADES DE CAPACITACIÓN IDENTIFICADAS|COORDINAR LAS ACTIVIDADES PROGRAMADAS|CONSOLIDAR LA INFORMACIÓN DE PARTICIPACIÓN'],
 ['rendimiento','Gestión del Rendimiento','gestion del rendimiento|gdr|evaluacion de desempeno|metas de desempeno','seguimiento de metas|evidencias de desempeno|retroalimentacion','EL REGISTRO Y SEGUIMIENTO ADMINISTRATIVO DE METAS DE RENDIMIENTO','PARA CONTRIBUIR A LA TRAZABILIDAD DEL PROCESO INSTITUCIONAL','APOYAR','ORGANIZAR LA INFORMACIÓN DE METAS E INDICADORES|RECOPILAR LAS EVIDENCIAS DE SEGUIMIENTO|ACTUALIZAR LOS REGISTROS DE AVANCE'],
 ['seguridad','Seguridad y salud en el trabajo','seguridad y salud en el trabajo|sst|iperc|accidente laboral|peligro ocupacional','prevencion de riesgos|equipos de proteccion|salud ocupacional|riesgo laboral','LA INFORMACIÓN Y LAS ACTIVIDADES ADMINISTRATIVAS DE SEGURIDAD Y SALUD','PARA CONTRIBUIR A LA PREVENCIÓN Y EL SEGUIMIENTO INSTITUCIONAL','APOYAR','REGISTRAR LAS INCIDENCIAS O NECESIDADES IDENTIFICADAS|ORGANIZAR LA DOCUMENTACIÓN DE SEGURIDAD Y SALUD|COMUNICAR LAS OBSERVACIONES A LAS UNIDADES COMPETENTES'],
 ['planeamiento','Planeamiento institucional','pei|poi|plan estrategico institucional|plan operativo institucional|planeamiento institucional','planificacion institucional|objetivo estrategico|accion estrategica|seguimiento del poi','LA INFORMACIÓN DE PLANES Y ACTIVIDADES INSTITUCIONALES','PARA CONTRIBUIR A SU SEGUIMIENTO Y ACTUALIZACIÓN','APOYAR','RECOPILAR LA INFORMACIÓN DE ACTIVIDADES PROGRAMADAS|ACTUALIZAR LAS MATRICES DE SEGUIMIENTO|CONSOLIDAR LOS REPORTES DE AVANCE'],
 ['calidad','Calidad y acreditación','acreditacion|licenciamiento|autoevaluacion|estandar de calidad|sineace|sunedu','calidad academica|criterio de calidad|evidencia de calidad|plan de mejora','LAS EVIDENCIAS Y REGISTROS DE ASEGURAMIENTO DE LA CALIDAD','PARA CONTRIBUIR A SU ORGANIZACIÓN Y SEGUIMIENTO','APOYAR','RECOPILAR LAS EVIDENCIAS REQUERIDAS|ORGANIZAR LAS MATRICES Y REGISTROS DE SEGUIMIENTO|ACTUALIZAR LA INFORMACIÓN DEL PROCESO DE MEJORA'],
 ['tecnologia','Soporte informático','soporte tecnico|sistema informatico|software|hardware|impresora|red informatica|computadora|correo institucional','internet|sistema|equipo informatico|formateo|conectividad|usuario de sistema','LOS REQUERIMIENTOS DE SOPORTE INFORMÁTICO','PARA CONTRIBUIR A LA CONTINUIDAD OPERATIVA DE LOS SERVICIOS','ATENDER','REGISTRAR LOS REQUERIMIENTOS DE SOPORTE|REVISAR LAS INCIDENCIAS REPORTADAS|ATENDER O DERIVAR LOS REQUERIMIENTOS SEGÚN SU COMPETENCIA'],
 ['estadistica','Estadística y reportes','base de datos|cuadro estadistico|tablero de control|power bi|excel|indicador de gestion','reporte|estadistic|consolidad|grafico|datos|tabulacion','LOS DATOS Y REPORTES ADMINISTRATIVOS','PARA FACILITAR SU SEGUIMIENTO Y UTILIZACIÓN INSTITUCIONAL','ELABORAR','RECOPILAR LOS DATOS REQUERIDOS|VERIFICAR Y CONSOLIDAR LA INFORMACIÓN|ELABORAR LOS REPORTES CORRESPONDIENTES'],
 ['atencion','Orientación al usuario','atencion al publico|atencion al usuario|ventanilla|orientacion al estudiante|orientacion al docente','consultas|informacion al usuario|respondo|atiend|usuarios','LAS CONSULTAS Y SOLICITUDES ADMINISTRATIVAS DE LOS USUARIOS','PARA FACILITAR SU ATENCIÓN Y ORIENTACIÓN OPORTUNAS','BRINDAR ATENCIÓN A','ATENDER LAS CONSULTAS DE LOS USUARIOS|VERIFICAR LA INFORMACIÓN REQUERIDA|COMUNICAR LOS PROCEDIMIENTOS APLICABLES'],
 ['eventos','Eventos institucionales','evento institucional|consejo de facultad|sesion de consejo|ceremonia institucional|acto academico|reunion institucional','convocatoria|conferencia|ceremonia|invitacion|evento|sesion','LAS ACTIVIDADES LOGÍSTICAS Y ADMINISTRATIVAS DE EVENTOS INSTITUCIONALES','PARA CONTRIBUIR A SU ORGANIZACIÓN Y DESARROLLO','COORDINAR','ORGANIZAR LOS REQUERIMIENTOS ADMINISTRATIVOS DE LOS EVENTOS|COMUNICAR LAS CONVOCATORIAS CORRESPONDIENTES|REGISTRAR LA INFORMACIÓN DE LAS ACTIVIDADES REALIZADAS'],
 ['convenios','Convenios y cooperación','convenio|cooperacion interinstitucional|carta de intencion|acuerdo interinstitucional','alianza|contraparte|instituciones cooperantes','LA DOCUMENTACIÓN ADMINISTRATIVA DE CONVENIOS Y COOPERACIÓN','PARA CONTRIBUIR A SU TRAMITACIÓN Y SEGUIMIENTO','APOYAR','RECOPILAR LOS DOCUMENTOS DE SUSTENTO|ORGANIZAR LOS EXPEDIENTES DE CONVENIOS|REALIZAR EL SEGUIMIENTO DE LOS TRÁMITES ASIGNADOS'],
 ['mantenimiento','Mantenimiento de instalaciones','mantenimiento|reparacion|instalacion electrica|gasfiteria|carpinteria|infraestructura','averia|desperfecto|instalaciones|ambientes|conservacion','LOS TRABAJOS DE MANTENIMIENTO DE AMBIENTES E INSTALACIONES','PARA CONTRIBUIR A SU CONSERVACIÓN Y DISPONIBILIDAD','REALIZAR','VERIFICAR LAS NECESIDADES DE MANTENIMIENTO|EJECUTAR LOS TRABAJOS ASIGNADOS|REPORTAR LAS ATENCIONES O INCIDENCIAS'],
 ['limpieza','Limpieza y desinfección','limpieza|aseo|desinfeccion|residuos solidos|higienizacion','limpi|barrer|trapear|desinfect|recoger residuos','LA LIMPIEZA Y CONSERVACIÓN DE LOS AMBIENTES ASIGNADOS','PARA MANTENER CONDICIONES ADECUADAS DE USO','REALIZAR','ORGANIZAR LOS MATERIALES DE LIMPIEZA|LIMPIAR Y DESINFECTAR LOS AMBIENTES ASIGNADOS|REPORTAR LAS NECESIDADES DE REPOSICIÓN DE INSUMOS'],
 ['areas_verdes','Áreas verdes','areas verdes|jardineria|poda|riego de jardines|cesped|plantas ornamentales','jardin|poda|regar|riego|abonad|malezas','EL MANTENIMIENTO Y CONSERVACIÓN DE LAS ÁREAS VERDES ASIGNADAS','PARA PRESERVAR SU ESTADO Y PRESENTACIÓN','REALIZAR','VERIFICAR EL ESTADO DE LOS JARDINES ASIGNADOS|EJECUTAR LAS LABORES DE RIEGO Y CONSERVACIÓN|RETIRAR LOS RESIDUOS VEGETALES GENERADOS'],
 ['vigilancia','Seguridad patrimonial y vigilancia','vigilancia|control de acceso|portería|guardiania|seguridad de instalaciones','ronda|ingreso de visitantes|vigilante|resguardo|control de ingreso','EL CONTROL DE ACCESOS Y LA VIGILANCIA DE LAS INSTALACIONES','PARA CONTRIBUIR A SU SEGURIDAD Y RESGUARDO','REALIZAR','VERIFICAR EL INGRESO A LAS INSTALACIONES ASIGNADAS|EFECTUAR LAS RONDAS DE VIGILANCIA PROGRAMADAS|REPORTAR LAS INCIDENCIAS IDENTIFICADAS'],
 ['transporte','Transporte institucional','conductor|chofer|vehiculo institucional|traslado de personal|movilidad institucional|flota vehicular','transporte|manejo de vehiculo|vehicul|desplazamiento|ruta','LOS SERVICIOS DE TRANSPORTE INSTITUCIONAL ASIGNADOS','PARA CONTRIBUIR AL DESPLAZAMIENTO OPORTUNO Y SEGURO','REALIZAR','VERIFICAR LAS CONDICIONES DEL VEHÍCULO ASIGNADO|EFECTUAR LOS TRASLADOS PROGRAMADOS|REGISTRAR LAS INCIDENCIAS DE LOS SERVICIOS'],
 ['archivo','Archivo y custodia documental','archivo central|archivo fisico|custodia documental|expedientes archivados|foliacion','archiv|clasific|foliar|ordenar carpetas|conservacion documental','LOS DOCUMENTOS Y EXPEDIENTES BAJO CUSTODIA','PARA FACILITAR SU CONSERVACIÓN Y LOCALIZACIÓN','ORGANIZAR','CLASIFICAR LOS DOCUMENTOS SEGÚN EL CRITERIO CORRESPONDIENTE|MANTENER ACTUALIZADOS LOS REGISTROS DE ARCHIVO|UBICAR LOS EXPEDIENTES REQUERIDOS'],
 ['secretaria','Secretaría administrativa','agenda del decano|secretaria de decanato|despacho decanal|secretaria administrativa','agenda|citacion|reunion|coordinacion del despacho','LAS ACTIVIDADES DE APOYO ADMINISTRATIVO DEL DESPACHO','PARA CONTRIBUIR A SU ATENCIÓN Y ORGANIZACIÓN OPORTUNAS','APOYAR','ORGANIZAR LA AGENDA DE ACTIVIDADES DEL DESPACHO|ATENDER LAS COMUNICACIONES ADMINISTRATIVAS ASIGNADAS|PREPARAR LA DOCUMENTACIÓN DE APOYO REQUERIDA'],
 ['tramites','Procedimientos administrativos','tupa|procedimiento administrativo|administrado|subsanacion|notificacion administrativa','tramite|peticion|expediente administrativo|solicitud administrativa','LOS PROCEDIMIENTOS Y SOLICITUDES ADMINISTRATIVAS','PARA CONTRIBUIR A SU ATENCIÓN CONFORME A LOS TRÁMITES ESTABLECIDOS','TRAMITAR','REVISAR LOS REQUISITOS DE LAS SOLICITUDES|REGISTRAR LOS TRÁMITES PRESENTADOS|DERIVAR LOS EXPEDIENTES SEGÚN CORRESPONDA']
 ];
 const domains=DOMAIN_ROWS.map(row=>{const [id,label,an,terms,obj,goal,verb,activity]=row;return {id,label,anchors:an.split('|'),terms:terms.split('|'),obj,goal,verb,typical:activity.split('|')}});
 const ACTION_ROWS=[
 ['recibir','recibo|recibir|recibe|recibi|recepcion|llegan|ingresan documentos|me entregan|presentan solicitudes','RECIBIR','DOCUMENTACIÓN O SOLICITUDES','DOCUMENTACIÓN RECIBIDA'],
 ['revisar','revis|verific|comprob|cotej|requisit|validar document','VERIFICAR','DOCUMENTACIÓN Y REQUISITOS','EXPEDIENTES O SOLICITUDES REVISADOS'],
 ['registrar','registro|registrar|registramos|registran|registre|anot|asent|ingres|digita|carg|subo|sistematiz','REGISTRAR','INFORMACIÓN Y TRÁMITES','REGISTROS ADMINISTRATIVOS ACTUALIZADOS'],
 ['derivar','deriv|remit|documentos trasladados|envio a|paso al area|mando a','DERIVAR','DOCUMENTACIÓN','DOCUMENTOS DERIVADOS'],
 ['digitalizar','digitaliz|escane|escan|fotocopi','DIGITALIZAR','DOCUMENTACIÓN','DOCUMENTOS DIGITALIZADOS'],
 ['archivar','archiv|custodi|folia|clasific|ordeno expedient','ORGANIZAR','DOCUMENTACIÓN BAJO CUSTODIA','ARCHIVO DOCUMENTAL ORGANIZADO'],
 ['orientar','orient|atiend|atend|resuelvo consultas|explic|informo al usuario','ORIENTAR','USUARIOS','CONSULTAS ADMINISTRATIVAS ATENDIDAS'],
 ['seguir','seguim|monitore|rastre|consulto estado|pendiente|hago seguimiento','REALIZAR SEGUIMIENTO','TRÁMITES O ACTIVIDADES','REGISTROS DE SEGUIMIENTO ACTUALIZADOS'],
 ['comunicar','comunic|informo|informar|informamos|aviso|avisar|notific|respondo correo|enviar correo','COMUNICAR','INFORMACIÓN','COMUNICACIONES ADMINISTRATIVAS REALIZADAS'],
 ['redactar','redact|elabor|prepar|escribo ofici|hago informe|emito informe','ELABORAR','DOCUMENTOS O INFORMES','DOCUMENTOS O INFORMES ELABORADOS'],
 ['consolidar','consolid|recopil|reuno inform|integro datos|cruzo datos|proces','CONSOLIDAR','INFORMACIÓN','INFORMACIÓN CONSOLIDADA'],
 ['actualizar','actualiz|modific|corrig|depur|mantengo al dia|actualizo','ACTUALIZAR','REGISTROS O INFORMACIÓN','REGISTROS ACTUALIZADOS'],
 ['coordinar','coordin|articul|convoc|organizo reunion|programo reuni','COORDINAR','ACTIVIDADES Y REQUERIMIENTOS','COORDINACIONES ADMINISTRATIVAS REALIZADAS'],
 ['programar','programo|programar|programamos|programacion de horarios|calendariz|agend|planific|asigno turnos','PROGRAMAR','ACTIVIDADES Y HORARIOS','PROGRAMACIONES ACTUALIZADAS'],
 ['controlar','control|fiscaliz|supervis|inspeccion|vigilo|evaluo cumplimiento','CONTROLAR','REGISTROS O ACTIVIDADES ASIGNADAS','REGISTROS DE CONTROL ACTUALIZADOS'],
 ['inventariar','inventari|contabilizo bienes|cuento materiales|kardex|verifico stock','VERIFICAR','EXISTENCIAS O BIENES','REGISTROS DE INVENTARIO ACTUALIZADOS'],
 ['entregar','entreg|distribu|repart|despach|asigno materiales','ENTREGAR','BIENES O DOCUMENTOS','BIENES O DOCUMENTOS ENTREGADOS'],
 ['limpiar','limpi|barro|trape|desinfect|aseo','LIMPIAR','AMBIENTES ASIGNADOS','AMBIENTES LIMPIADOS'],
 ['reparar','repar|arregl|corrijo desperfecto|mantenim','REALIZAR MANTENIMIENTO','INSTALACIONES O EQUIPOS','ATENCIONES DE MANTENIMIENTO REALIZADAS'],
 ['regar','rieg|regar|riego|pod|deshierb|abono jardines','CONSERVAR','ÁREAS VERDES ASIGNADAS','ÁREAS VERDES ATENDIDAS'],
 ['trasladar','conduz|conduc|manejo vehiculo|transport|traslado de personal','REALIZAR','TRASLADOS ASIGNADOS','SERVICIOS DE TRANSPORTE REALIZADOS'],
 ['asistir','asisto|asistir|apoyo|ayud|colabor|brindo apoyo','APOYAR','PROCEDIMIENTOS ASIGNADOS','ACTIVIDADES DE APOYO REALIZADAS'],
 ['reportar','reporto|reportar|reportamos|comunico incidencias|elevo reporte|levanto informe','REPORTAR','INFORMACIÓN O INCIDENCIAS','REPORTES DE ACTIVIDAD ELABORADOS'],
 ['tramitar','tramit|gestiono solicitud|gestionar tramite|proceso expedient','TRAMITAR','SOLICITUDES O EXPEDIENTES','SOLICITUDES TRAMITADAS'],
 ['atender','atenci|atiendo solicitudes|atiendo casos|resuelvo peticion','ATENDER','SOLICITUDES O CASOS','SOLICITUDES ATENDIDAS'],
 ['analizar','analiz|interpreto datos|estudio informaci|examino','ANALIZAR','DATOS O INFORMACIÓN','ANÁLISIS DE INFORMACIÓN ELABORADOS'],
 ['diseñar','disen|estructur|formul|desarrollo propuesta','ELABORAR','PROPUESTAS O INSTRUMENTOS','PROPUESTAS O INSTRUMENTOS ELABORADOS'],
 ['capacitar','capacit|enseno|instruy|dict|facilit taller','BRINDAR','ORIENTACIÓN O CAPACITACIÓN','SESIONES DE CAPACITACIÓN REALIZADAS'],
 ['instalar','instalo|instalar|instala programas|configur|habilito sistema|monto equipo','INSTALAR O CONFIGURAR','EQUIPOS O SISTEMAS','EQUIPOS O SISTEMAS HABILITADOS'],
 ['soportar','soluciono falla|soporte tecnico|restauro|reinstal','ATENDER','INCIDENCIAS TÉCNICAS','INCIDENCIAS DE SOPORTE ATENDIDAS'],
 ['pagar','pago a|efectuo pagos|giro pago|pago facturas','EFECTUAR','PAGOS ASIGNADOS','PAGOS PROCESADOS'],
 ['aprobar','aprueb|autoriz|resuelvo formalmente','APROBAR','TRÁMITES ASIGNADOS','TRÁMITES APROBADOS'],
 ['firmar','firmo|suscrib|rubric','SUSCRIBIR','DOCUMENTOS ASIGNADOS','DOCUMENTOS SUSCRITOS'],
 ['evaluar','evalu|calific|valoro resultados','EVALUAR','INFORMACIÓN O RESULTADOS','EVALUACIONES REALIZADAS']
 ];
 const actions=ACTION_ROWS.map(([id,word,verb,obj,product])=>({id,words:word.split('|'),verb,obj,product}));
 const privileged=new Set(['aprobar','firmar','pagar','evaluar']);
 function recognized(input){const t=tidy(input);const ws=toks(t);return {t,ws}}
 function clauseParts(text){return N(text).replace(/\b(?:pero|sin embargo|en cambio|ademas|tambien|despues|luego|posteriormente|finalmente|por otro lado)\b/g,';').split(/[;.!?\n]+|,\s*(?=(?:no |solo |si |me |reviso|registro|recibo|elaboro|derivo|archivo|realizo))/).map(C).filter(Boolean);}
 function negative(clause){return /\b(no (?:me |nos |se )?(?:encargo|realiz|hago|manejo|puedo|aprueb|firm|pag|ejecuto|elabor|autoriz|evalu)|nunca |tampoco |no corresponde|sin intervenir|no participo|no tengo a cargo|otra oficina realiza)\b/.test(clause)&&!(/\bno solo\b/.test(clause));}
 function scoreDomains(text){const s=tidy(text),normalized=toks(s);return domains.map(d=>{
  let hits=[];d.anchors.forEach(k=>{if(has(s,[k]))hits.push({k,weight:6})});d.terms.forEach(k=>{if(has(s,[k]))hits.push({k,weight:1.8})});
  let score=hits.reduce((a,b)=>a+b.weight,0);if(d.id==='documental'&&hits.every(x=>x.weight<6))score*=.75;
  if(d.id==='atencion'&&hits.every(x=>x.weight<6))score*=.7;
  if(d.id==='estadistica'&&hits.every(x=>x.weight<6))score*=.75;
  if(d.id==='presupuesto'&&has(s,['certific'])&&has(s,['presupuest']))score+=6;
  return {...d,score:Math.round(score*10)/10,evidence:hits.map(x=>x.k)};
 }).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||b.evidence.length-a.evidence.length);
 }
 function scoreActions(text){const clean=tidy(text),parts=clauseParts(text).map(tidy).filter(x=>!negative(x));const seen=new Map();parts.forEach((p,i)=>{actions.forEach(a=>{const hits=a.words.filter(w=>has(p,[w]));if(hits.length){const value={...a,position:i,hits:hits.length,clause:p};if(!seen.has(a.id)||value.hits>seen.get(a.id).hits)seen.set(a.id,value)}})});return [...seen.values()].sort((a,b)=>a.position-b.position)}
 function level(text){const t=tidy(text);if(/\b(?:solo apoyo|unicamente apoyo|mi funcion es apoyar|ayudo|colaboro|brindo apoyo|asisto|apoyo en|apoyo a|me piden apoyar|participo apoyando)\b/.test(t))return 'apoyo';if(/\b(?:me encargo|soy responsable|mi responsabilidad|tengo a cargo|realizo directamente|ejecuto|administro|coordino directamente)\b/.test(t))return 'directo';return 'indefinido'}
 function selectAreas(description,ref){const text=description||ref;const cleanParts=clauseParts(text).filter(s=>!negative(tidy(s))).join('. ');return scoreDomains(cleanParts||text)}
 function objectPhrase(d,acts,text){const t=tidy(text);if(/sgdunt|sistema de gestion documental/.test(t)&&d.id==='documental')return 'LA RECEPCIÓN, EL REGISTRO Y LA DERIVACIÓN DE DOCUMENTOS EN EL SGDUNT';if(d.id==='documental'&&acts.some(a=>a.id==='archivar')&&!acts.some(a=>a.id==='recibir'))return 'LA ORGANIZACIÓN Y CUSTODIA DE LA DOCUMENTACIÓN ADMINISTRATIVA';if(d.id==='estadistica'&&/indicador/.test(t))return 'LOS INDICADORES Y REPORTES ADMINISTRATIVOS';if(d.id==='grados'&&/sustent/.test(t))return 'LA DOCUMENTACIÓN DE LOS PROCEDIMIENTOS DE SUSTENTACIÓN Y TITULACIÓN';if(d.id==='transporte'&&/chofer|condu|manej/.test(t))return 'LOS TRASLADOS CON LOS VEHÍCULOS INSTITUCIONALES ASIGNADOS';return d.obj}
 const appropriate=(d, lvl, acts)=>{
   if(lvl==='apoyo')return 'APOYAR';
   if(d.id==='atencion')return 'ATENDER';
   if(['mantenimiento','limpieza','areas_verdes','vigilancia','transporte'].includes(d.id))return d.verb;
   if(acts.some(a=>a.id==='elaborar')&&d.id==='estadistica')return 'ELABORAR';
   if(d.id==='archivo'&&acts.some(a=>a.id==='archivar'))return 'ORGANIZAR';
   return d.verb==='BRINDAR ATENCIÓN A'?'ATENDER':d.verb;
 };
 const improveLanguage=s=>U(finish(s.replace(/\s+/g,' ').replace(/\bLA LA\b/gi,'LA')));
 function contextualFallback(input,lv){
   // Formulación cautelosa a partir del propio objeto descrito por el servidor.
   // No presupone un trámite normado ni funciones de decisión.
   const text=C(input).replace(/\b(?:yo |normalmente |generalmente |principalmente )/gi,'').trim();
   const m=text.match(/(?:me encargo de|soy responsable de|mis labores (?:son|consisten en)|mi trabajo consiste en|trabajo en|me dedico a|realizo|desarrollo|apoyo en|apoyo a|ayudo a)\s+(.+)/i);
   if(!m)return null;
   let object=m[1].replace(/[.!?].*$/s,'').replace(/\b(?:y (?:tambien|ademas) )/gi,'y ');
   object=object.replace(/^(?:hacer|realizar|gestionar|llevar a cabo|coordinar|ayudar con|apoyar en|organizar)\s+/i,'');
   object=object.replace(/^(?:el trabajo de|las actividades de|la labor de)\s+/i,'');
   if(object.length<14||object.length>175)return null;
   const label=/^(la|el|los|las|un|una)\b/i.test(object)?object:'LAS ACTIVIDADES RELACIONADAS CON '+object;
   const action=lv==='apoyo'?'APOYAR EL DESARROLLO DE':'DESARROLLAR';
   const result=improveLanguage(`${action} ${label} CONFORME AL ALCANCE DE LAS RESPONSABILIDADES ASIGNADAS`);
   return result.length<350?result:null;
 }
 function functionProposals(detected,acts,lvl,input,previous){const rows=[],primary=detected[0];if(!primary)return rows;
   const d=primary,scope=objectPhrase(d,acts,input);const v=appropriate(d,lvl,acts);const a=d.goal;
   rows.push(improveLanguage(`${v==='APOYAR'?'APOYAR LA GESTIÓN DE':v} ${scope} ${a}`));
   if(acts.length>=2){const lead=acts.filter(x=>!['asistir','aprobar','firmar','pagar'].includes(x.id)).slice(0,3);
     if(lead.length>=2){/* Alternativas más específicas sustentadas en las acciones declaradas. */
       const commons={recibir:'RECEPCIÓN',revisar:'VERIFICACIÓN',registrar:'REGISTRO',derivar:'DERIVACIÓN',digitalizar:'DIGITALIZACIÓN',archivar:'ORGANIZACIÓN',orientar:'ORIENTACIÓN',seguir:'SEGUIMIENTO',comunicar:'COMUNICACIÓN',redactar:'ELABORACIÓN',consolidar:'CONSOLIDACIÓN',actualizar:'ACTUALIZACIÓN',coordinar:'COORDINACIÓN',programar:'PROGRAMACIÓN',controlar:'CONTROL',inventariar:'CONTROL',entregar:'ENTREGA',limpiar:'LIMPIEZA',reparar:'MANTENIMIENTO',regar:'CONSERVACIÓN',trasladar:'TRASLADO',reportar:'ELABORACIÓN',tramitar:'TRAMITACIÓN',atender:'ATENCIÓN',analizar:'ANÁLISIS',diseñar:'FORMULACIÓN',capacitar:'CAPACITACIÓN',instalar:'INSTALACIÓN',soportar:'ATENCIÓN'};
       const chain=uniq(lead.map(x=>commons[x.id]).filter(Boolean));
       if(chain.length>1){const body=chain.length===2?chain.join(' Y '):chain.slice(0,-1).join(', ')+' Y '+chain.at(-1);
         if(lvl!=='apoyo' && !['mantenimiento','limpieza','areas_verdes','vigilancia','transporte','tecnologia'].includes(d.id))rows.push(improveLanguage(`REALIZAR LAS ACTIVIDADES DE ${body} VINCULADAS CON ${d.obj} ${a}`));}
     }
   }
   const second=detected.find(x=>x.id!==d.id&&x.score>=5&&x.score>=d.score*.65&&x.evidence.some(x=>x.length>=5));
   if(second){const v2=appropriate(second,lvl,acts);rows.push(improveLanguage(`${v2} ${second.obj} ${second.goal}`));}
   if(previous&&C(previous).length>18&&!rows.some(r=>N(r)===N(previous))){rows.push(improveLanguage(previous));}
   return uniq(rows).slice(0,3)
 }
 function shortObj(d,action,input){const t=tidy(input);if(d?.id==='documental'){
  if(action.id==='registrar'&&/sgdunt/.test(t))return 'LOS DOCUMENTOS EN EL SGDUNT';
  if(action.id==='derivar')return 'LOS DOCUMENTOS A LA UNIDAD DE ORGANIZACIÓN COMPETENTE';
  if(action.id==='recibir')return 'LAS SOLICITUDES Y LOS DOCUMENTOS PRESENTADOS';
  if(action.id==='revisar')return 'LOS REQUISITOS DE LOS DOCUMENTOS RECIBIDOS';
  if(action.id==='archivar')return 'LOS EXPEDIENTES ADMINISTRATIVOS';
  if(action.id==='seguir')return 'LOS TRÁMITES PENDIENTES';
 }
 if(d?.id==='matricula'){
  if(action.id==='recibir')return 'LAS SOLICITUDES DE MATRÍCULA';
  if(action.id==='revisar')return 'LOS REQUISITOS DE LAS SOLICITUDES DE MATRÍCULA';
  if(action.id==='registrar')return 'LAS SOLICITUDES DE MATRÍCULA EN EL REGISTRO CORRESPONDIENTE';
 }
 if(d?.id==='grados'){
  if(action.id==='revisar')return 'LOS REQUISITOS DE LOS EXPEDIENTES DE GRADOS Y TÍTULOS';
  if(action.id==='registrar')return 'LA INFORMACIÓN DE LOS TRÁMITES DE GRADOS Y TÍTULOS';
  if(action.id==='derivar')return 'LOS EXPEDIENTES DE GRADOS Y TÍTULOS A LA UNIDAD COMPETENTE';
 }
 if(d?.id==='estadistica'){
  if(action.id==='consolidar')return 'LOS DATOS ADMINISTRATIVOS REQUERIDOS';
  if(action.id==='redactar'||action.id==='reportar')return 'LOS REPORTES DE LA INFORMACIÓN PROCESADA';
  if(action.id==='registrar')return 'LOS DATOS EN EL REGISTRO CORRESPONDIENTE';
 }
 if(d?.id==='tecnologia'){
  if(action.id==='revisar')return 'LAS INCIDENCIAS TÉCNICAS REPORTADAS';
  if(action.id==='registrar')return 'LOS REQUERIMIENTOS DE SOPORTE';
  if(action.id==='instalar'||action.id==='soportar')return 'LOS EQUIPOS O SISTEMAS ASIGNADOS';
 }
 if(d?.id==='areas_verdes'){
  if(action.id==='regar'||action.id==='limpiar')return 'LOS JARDINES O LAS ÁREAS VERDES ASIGNADAS';
 }
 if(d?.id==='limpieza'&&action.id==='limpiar')return 'LOS AMBIENTES ASIGNADOS';
 if(d?.id==='biblioteca'&&action.id==='registrar')return 'LOS PRÉSTAMOS Y DEVOLUCIONES DE MATERIAL BIBLIOGRÁFICO';
 if(d?.id==='patrimonio'&&action.id==='inventariar')return 'LOS BIENES PATRIMONIALES ASIGNADOS';
 if(d?.id==='horarios'&&action.id==='programar')return 'LOS HORARIOS Y AMBIENTES SEGÚN LA INFORMACIÓN RECIBIDA';
 if(d?.id==='rendimiento'&&action.id==='seguir')return 'EL AVANCE DE METAS E INDICADORES DE RENDIMIENTO';
 if(d?.id==='eventos'&&action.id==='coordinar')return 'LOS REQUERIMIENTOS ADMINISTRATIVOS DE LOS EVENTOS ASIGNADOS';
 const base={recibir:'LA DOCUMENTACIÓN O LAS SOLICITUDES RECIBIDAS',revisar:'LOS REQUISITOS DE LA INFORMACIÓN RECIBIDA',registrar:'LA INFORMACIÓN DEL PROCEDIMIENTO ASIGNADO',derivar:'LA DOCUMENTACIÓN A LA UNIDAD COMPETENTE',digitalizar:'LA DOCUMENTACIÓN ASIGNADA',archivar:'LOS DOCUMENTOS A SU CARGO',orientar:'A LOS USUARIOS SOBRE LOS PROCEDIMIENTOS QUE ATIENDE',seguir:'LOS TRÁMITES O ACTIVIDADES PENDIENTES',comunicar:'LA INFORMACIÓN A LOS INTERESADOS',redactar:'LOS DOCUMENTOS O REPORTES ASIGNADOS',consolidar:'LOS DATOS O DOCUMENTOS RECIBIDOS',actualizar:'LOS REGISTROS ASIGNADOS',coordinar:'LAS ACTIVIDADES ADMINISTRATIVAS ASIGNADAS',programar:'LAS ACTIVIDADES O LOS HORARIOS ASIGNADOS',controlar:'LOS REGISTROS BAJO SU RESPONSABILIDAD',inventariar:'LAS EXISTENCIAS O LOS BIENES ASIGNADOS',entregar:'LOS BIENES O DOCUMENTOS CORRESPONDIENTES',limpiar:'LOS AMBIENTES ASIGNADOS',reparar:'LOS EQUIPOS O AMBIENTES ASIGNADOS',regar:'LAS ÁREAS VERDES ASIGNADAS',trasladar:'LOS TRASLADOS INSTITUCIONALES ASIGNADOS',asistir:'LOS PROCEDIMIENTOS A SU CARGO',reportar:'LAS INCIDENCIAS O LOS RESULTADOS DE LAS ACTIVIDADES',tramitar:'LAS SOLICITUDES O EXPEDIENTES ASIGNADOS',atender:'LAS SOLICITUDES ADMINISTRATIVAS PRESENTADAS',analizar:'LOS DATOS O DOCUMENTOS REQUERIDOS',diseñar:'LAS PROPUESTAS O INSTRUMENTOS CORRESPONDIENTES',capacitar:'LA ORIENTACIÓN O CAPACITACIÓN ASIGNADA',instalar:'LOS EQUIPOS O SISTEMAS ASIGNADOS',soportar:'LAS INCIDENCIAS TÉCNICAS REPORTADAS',pagar:'LOS PAGOS QUE TIENE AUTORIZADOS',aprobar:'LOS TRÁMITES DE SU COMPETENCIA',firmar:'LOS DOCUMENTOS QUE TIENE FACULTAD DE SUSCRIBIR',evaluar:'LA INFORMACIÓN O LOS RESULTADOS ASIGNADOS'};
 return base[action.id]||action.obj;
 }
 function actionText(a,d,input){if(privileged.has(a.id)&&level(input)!=='directo')return null;
   if(a.id==='asistir'){return `APOYAR LAS ACTIVIDADES ADMINISTRATIVAS ASIGNADAS${d?' EN EL ÁMBITO DE '+d.label.toLocaleUpperCase('es-PE'):''}`}
   if(a.id==='reparar')return `REALIZAR EL MANTENIMIENTO DE ${shortObj(d,a,input)}`;
   if(a.id==='seguir')return `REALIZAR EL SEGUIMIENTO DE ${shortObj(d,a,input)}`;
   if(a.id==='soportar')return `ATENDER ${shortObj(d,a,input)}`;
   if(a.id==='trasladar')return `REALIZAR ${shortObj(d,a,input)}`;
   if(a.id==='regar')return `CONSERVAR ${shortObj(d,a,input)}`;
   if(a.id==='orientar')return `ORIENTAR ${shortObj(d,a,input)}`;
   return `${a.verb} ${shortObj(d,a,input)}`;
 }
 function outputForActivity(input,domain,description){
  const text=tidy(input),d=domain||scoreDomains(input+' '+description)[0];const products=[];
  // En la etapa de productos se distinguen verbos de sustantivos y participios:
  // «información recibida» no implica la actividad «recibir».
  const productVerbs={
    recibir:/\b(recibir|recibo|recibe|recibi|reciben|recepciono|recepcionar)\b/,
    revisar:/\b(revisar|reviso|revisa|verificar|verifico|verifica|comprobar|compruebo|cotejar)\b/,
    registrar:/\b(registrar|registro|registra|registramos|registran|anotar|anoto|ingresar|ingreso|digitar|digito)\b/,
    derivar:/\b(derivar|derivo|deriva|remitir|remito|remite)\b/,
    digitalizar:/\b(digitalizar|digitalizo|digitaliza|escanear|escaneo)\b/,
    archivar:/\b(archivar|archivo|organizar|organizo|clasificar|clasifico|custodiar|custodio|foliar|folio)\b/,
    orientar:/\b(orientar|oriento|orienta|atender|atiendo|atiende)\b/,
    seguir:/\b(seguimiento|monitorear|monitoreo|monitorea)\b/,
    comunicar:/\b(comunicar|comunico|comunica|notificar|notifico|informar|informo|aviso)\b/,
    redactar:/\b(elaborar|elaboro|elabora|redactar|redacto|preparar|preparo)\b/,
    consolidar:/\b(consolidar|consolido|consolida|recopilar|recopilo|procesar|proceso)\b/,
    actualizar:/\b(actualizar|actualizo|actualiza|modificar|modifico|corregir|corrijo)\b/,
    coordinar:/\b(coordinar|coordino|coordina|convocar|convoco)\b/,
    programar:/\b(programar|programo|programa|calendarizar|agendar|agendo)\b/,
    controlar:/\b(controlar|controlo|controla|supervisar|superviso)\b/,
    inventariar:/\b(inventariar|inventario|contabilizar|verificar existencias)\b/,
    entregar:/\b(entregar|entrego|entrega|distribuir|distribuyo)\b/,
    limpiar:/\b(limpiar|limpio|limpia|desinfectar|desinfecto)\b/,
    reparar:/\b(reparar|reparo|repara|mantenimiento)\b/,
    regar:/\b(regar|riego|riega|podar|podo|conservar|conservo)\b/,
    trasladar:/\b(trasladar|traslado|conducir|conduzco|transportar|transporto)\b/,
    asistir:/\b(apoyar|apoyo|asistir|asisto|colaborar|colaboro)\b/,
    reportar:/\b(reportar|reporto|reporta)\b/,
    tramitar:/\b(tramitar|tramito|tramita)\b/,
    atender:/\b(atender|atiendo|atiende)\b/,
    analizar:/\b(analizar|analizo|analiza)\b/,
    diseñar:/\b(disenar|diseno|formula|formular)\b/,
    capacitar:/\b(capacitar|capacito|capacita|dictar|dicto)\b/,
    instalar:/\b(instalar|instalo|instala|configurar|configuro)\b/,
    soportar:/\b(atender incidencias|resolver fallas|solucionar problemas|soporte tecnico)\b/,
    pagar:/\b(pagar|pago|paga)\b/,aprobar:/\b(aprobar|apruebo|aprueba)\b/,
    firmar:/\b(firmar|firmo|firma|suscribir|suscribo)\b/,
    evaluar:/\b(evaluar|evaluo|evalua)\b/
  };
  const a=scoreActions(input).filter(x=>productVerbs[x.id]?.test(text));
  const specific=(id)=>{
   if(id==='registrar'&&/sgdunt/.test(text+' '+tidy(description)))return 'DOCUMENTOS REGISTRADOS EN EL SGDUNT';
   if(id==='registrar'&&d?.id==='matricula')return 'SOLICITUDES DE MATRÍCULA REGISTRADAS';
   if(id==='registrar'&&d?.id==='biblioteca')return 'PRÉSTAMOS Y DEVOLUCIONES REGISTRADOS';
   if(id==='registrar'&&d?.id==='patrimonio')return 'REGISTROS PATRIMONIALES ACTUALIZADOS';
   if(id==='registrar'&&d?.id==='asistencia')return 'REGISTROS DE ASISTENCIA ACTUALIZADOS';
   if(id==='recibir'&&d?.id==='documental')return 'DOCUMENTACIÓN RECIBIDA';
   if(id==='revisar'&&d?.id==='grados')return 'EXPEDIENTES DE GRADOS Y TÍTULOS REVISADOS';
   if(id==='seguir'&&d?.id==='rendimiento')return 'REGISTROS DE SEGUIMIENTO DE METAS ACTUALIZADOS';
   if(id==='redactar'&&/ofici/.test(text))return 'OFICIOS ELABORADOS';
   if(id==='redactar'&&/acta/.test(text))return 'ACTAS ELABORADAS';
   if(id==='redactar'&&/informe/.test(text))return 'INFORMES ELABORADOS';
   if(id==='redactar'&&/memorand/.test(text))return 'MEMORANDOS ELABORADOS';
   if(id==='reparar'&&d?.id==='mantenimiento')return 'ATENCIONES DE MANTENIMIENTO REALIZADAS';
   return null;
  };
  const safe=a.filter(x=>!privileged.has(x.id)||level(input)==='directo');
  for(const x of safe){products.push(specific(x.id)||x.product)}
  // A falta de un verbo reconocido, aprovechar el producto explícito, no crear supuestas actas.
  if(!products.length){if((d?.id==='archivo'||/archiv|custodi|expedientes bajo/.test(tidy(description)))&&/\b(organizar|clasificar|ordenar|custodiar|archivar)\b/.test(text))products.push('ARCHIVO DOCUMENTAL ORGANIZADO');else if((d?.id==='areas_verdes'||/areas verdes|jardines/.test(tidy(description)))&&/\b(conservar|regar|podar|limpiar|mantener)\b/.test(text))products.push('ÁREAS VERDES ATENDIDAS');else if((d?.id==='transporte'||/traslados con los vehiculos/.test(tidy(description)))&&/\b(traslado|traslados|transportar|conducir)\b/.test(text))products.push('SERVICIOS DE TRANSPORTE REALIZADOS');else if(/\b(informes?|reportes?|actas?|oficios?|memorandos?)\b/.test(text)){
    if(/inform|report/.test(text))products.push('INFORMES O REPORTES ELABORADOS');
    else if(/acta/.test(text))products.push('ACTAS ELABORADAS');
    else if(/ofici/.test(text))products.push('OFICIOS ELABORADOS');
   } else if(/\b(consultas?|solicitudes? atendidas|atenciones?)\b/.test(text))products.push('SOLICITUDES O CONSULTAS ATENDIDAS')}
  return uniq(products).slice(0,4);
 }
 function advice(text){const t=tidy(text);if(t.length<8)return '';
   const first=t.split(' ')[0]||'';
   if(!/(ar|er|ir)$/.test(first))return 'Inicie la función con un verbo en infinitivo (por ejemplo, organizar, tramitar o apoyar).';
   if(t.split(/\s+/).length<5)return 'Especifique el objeto de la función y su alcance.';
   if(!/\b(?:para|conforme|segun|mediante|de acuerdo|a fin de|oportun|en el marco|bajo los)\b/.test(t))return 'Incorpore un atributo, alcance o finalidad verificable de la función.';
   if(/\b(?:realizar|hacer|ver)\s+(?:cosas|todo|tramites varios|lo que)\b/.test(t))return 'Sustituya expresiones vagas por el proceso o servicio administrativo concreto.';
   return '';
 }
 function generate(req){const target=req?.objetivoDelCampo||'function';const details=[req?.descripcion,req?.detalleNuevo,...(req?.respuestas||[]).map(x=>typeof x==='string'?x:x?.respuesta)].filter(Boolean).join('. ');
  const fn=C(req?.contextoFuncion),ac=C(req?.contextoActividad),prev=req?.borradorActual;
  const originalText=details||ac||fn;const positive=clauseParts(originalText).filter(x=>!negative(tidy(x))).join('. ');
  const areaScores=selectAreas(positive||originalText,fn);const acts=scoreActions(positive||originalText);
  const primary=areaScores[0]||null;const lv=level(details+' '+fn);
  const diagnostics={procesos:areaScores.slice(0,3).map(x=>({nombre:x.label,ponderacion:x.score})),acciones:acts.map(x=>x.id),nivelResponsabilidad:lv,motor:'reglas-locales',version:VERSION};
  const result=(propuestas=[],preguntas=[],alertas=[])=>({propuestas,preguntas,alertas,diagnostico:diagnostics});
  if(target==='function'){
    if(!C(details)||N(details).length<12)return result([],['¿De qué se encarga principalmente y qué documentos, servicios, personas o procedimientos atiende?'],[]);
    if(!primary){const fallback=contextualFallback(details,lv);if(fallback)return result([{funcion:fallback,actividades:[]}],[],['No se reconoció un proceso institucional específico. Esta propuesta se basa únicamente en sus palabras; precise el objeto y el alcance antes de incorporarla.']);return result([],['¿Qué proceso o servicio específico atiende? Por ejemplo, matrícula, expedientes, informática, mantenimiento o registros.'],['No se inventarán responsabilidades que no se deducen de la descripción.'])}
    const warnings=[];
    if(lv==='apoyo')warnings.push('Se identificó una función de apoyo: la propuesta evita atribuir facultades de aprobación o decisión.');
    if(acts.some(x=>privileged.has(x.id))&&lv!=='directo')warnings.push('No se presume autorización para aprobar, firmar, evaluar o disponer pagos.');
    if(areaScores.length>1&&areaScores[1].score>=Math.max(5,areaScores[0].score*.65))warnings.push('Se identificaron varios procesos: revise si corresponden a funciones diferentes.');
    const options=functionProposals(areaScores,acts,lv,positive||details,prev?.funcion);
    if(!options.length)return result([],['¿Qué responsabilidad concreta desarrolla dentro de ese proceso?'],[]);
    return result(options.map(funcion=>({funcion,actividades:[]})),[],[...warnings,'Seleccione la formulación más fiel a las responsabilidades que realmente desempeña.']);
  }
  if(target==='activity'){
    if(!fn)return result([],['¿Cuál es la función a la que corresponden estas actividades?'],[]);
    const d=primary||scoreDomains(fn)[0]||null;
    let explicit=scoreActions(details);if(explicit.some(x=>x.id==='redactar'))explicit=explicit.filter(x=>x.id!=='reportar'||!(/reporte|informe/.test(tidy(details))));let proposals=[];const alerts=[];
    if(explicit.length){proposals=uniq(explicit.map(x=>actionText(x,d,details)).filter(Boolean)).map(x=>({actividad:finish(U(x)),productos:[]}));
      if(proposals.length&&acts.some(x=>privileged.has(x.id))&&lv!=='directo')alerts.push('Se excluyeron acciones que requerirían autoridad expresa de aprobación, firma o pago.');
    } else if(d&&details.length<40){proposals=d.typical.map(x=>({actividad:finish(U(x)),productos:[]}));alerts.push('Estas actividades son ejemplos del proceso, no labores comprobadas. Elimine las que no realiza.');}
    else if(d){proposals=d.typical.slice(0,3).map(x=>({actividad:finish(U(x)),productos:[]}));alerts.push('La descripción no permitió reconocer acciones concretas; las propuestas son referenciales.');}
    const prior=Array.isArray(prev?.actividades)?prev.actividades.filter(x=>x&&C(x.actividad)).map(x=>({actividad:finish(U(x.actividad)),productos:[]})):[];
    const merged=uniq([...prior.map(x=>x.actividad),...proposals.map(x=>x.actividad)]).slice(0,20).map(actividad=>({actividad,productos:[]}));
    if(!merged.length)return result([],['¿Qué hace usted, paso a paso, para cumplir la función registrada?'],[]);
    alerts.push(explicit.length?'Las actividades se identificaron a partir de acciones expresadas por usted. Confirme su alcance.':'Revise que cada actividad realmente forme parte de su función.');
    return result([{funcion:fn,actividades:merged}],[],alerts);
  }
  if(target==='product'){
    if(!ac)return result([],['¿Qué actividad realiza antes de obtener este producto o resultado?'],[]);
    const d=scoreDomains(fn+' '+ac)[0]||primary;
    const p=outputForActivity(ac,d,details);
    const old=Array.isArray(prev?.actividades?.[0]?.productos)?prev.actividades[0].productos:[];
    const output=uniq([...old.map(U),...p.map(U)]).slice(0,8);
    if(!output.length)return result([],['Al finalizar esta actividad, ¿qué documento, registro actualizado, atención u otro resultado verificable queda?'],['No se ha supuesto un documento que usted no mencionó.']);
    return result([{funcion:fn,actividades:[{actividad:ac,productos:output}]}],[''].filter(Boolean),['Verifique que cada producto exista realmente y pueda evidenciarse o contabilizarse.']);
  }
  return result([],['Seleccione si desea apoyo para una función, actividad o producto.'],[]);
 }
 root.UNT_LOCAL_ASSISTANT=Object.freeze({generate,advice,diagnosticar:(text)=>{const d=scoreDomains(text),a=scoreActions(text);return {procesos:d.slice(0,5).map(x=>({nombre:x.label,puntaje:x.score,coincidencias:x.evidence})),acciones:a.map(x=>x.id),nivelResponsabilidad:level(text),clausulasExcluidas:clauseParts(text).filter(x=>negative(tidy(x)))}},version:VERSION,type:'motor-local-de-interpretacion',knowledge:{domains,actions}});
})(window);
