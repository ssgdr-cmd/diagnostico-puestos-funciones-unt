/* UNT 2026 · Aplicación institucional de diagnóstico funcional.
   Acceso directo a formularios. URH conserva autenticación para expedientes de terceros.
   Sin backend configurado, se bloquea el acceso a la captura de información. */
(() => {
'use strict';
const D=window.UNT_DATA, CFG=window.UNT_CONFIG||{}, demo=CFG.demo===true, configured=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey);
const app=document.getElementById('app'), toastEl=document.getElementById('toast');
// Computadoras compartidas: nunca guardar perfiles, facultades ni claves de edición en el navegador.
// Solo se utiliza memoria de la pestaña para la declaración actualmente abierta.
function purgeLegacyBrowserState(){
 for(const storeName of ['localStorage','sessionStorage']){
  try{const storage=window[storeName];const ref=(CFG.supabaseUrl||'').match(/^https?:\/\/([^.]+)/)?.[1]||'';for(const key of ['unt.v19.resume','unt.faculty','unt.requested_role','unt.sidebar.hidden',...(ref?[`sb-${ref}-auth-token`]:[])])storage.removeItem(key)}catch{}
 }
}
let sb=null;
const roles={staff:{label:'PERSONAL ADMINISTRATIVO',intro:'Registre las funciones, actividades y productos que desarrolla.',icon:'▤'},faculty_admin:{label:'ADMINISTRADOR DE FACULTAD',intro:'Registre sus funciones y genere un oficio sobre las labores declaradas por el personal, para revisión y firma del Decanato.',icon:'✓'},authority:{label:'DECANO O DIRECTOR',intro:'Registre las necesidades y oportunidades de mejora de su unidad de organización.',icon:'⌂'},urh_admin:{label:'ADMINISTRACIÓN URH',intro:'Consolide y supervise la información recibida de las facultades.',icon:'◈'}};
const statuses={draft:['EN ELABORACIÓN','neutral'],submitted:['RECIBIDO · PENDIENTE DE COTEJO DOCUMENTAL','attn'],changes_requested:['OBSERVADO POR FACULTAD','attn'],validated:['CONFORMIDAD VERIFICADA POR URH','done'],forwarded:['REMITIDO A URH','done']};
const MOCK_NAME={staff:['RIVERA MORENO','CARLA ELENA'],faculty_admin:['SOTO CAMPOS','JULIO ALBERTO'],authority:['HERRERA VERA','PATRICIA ANDREA'],urh_admin:['PAREDES LEÓN','MARIO ANDRÉS']};
const ID=()=> (crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const U=v=>String(v??'').toLocaleUpperCase('es-PE');
const $=(q,r=document)=>r.querySelector(q); const $$=(q,r=document)=>[...r.querySelectorAll(q)];
const fmt=x=> x==null||!Number.isFinite(+x)?'—':new Intl.NumberFormat('es-PE',{maximumFractionDigits:1}).format(+x);
const niceDate=d=>new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'});
// El token de edición vive únicamente en memoria durante esta pestaña; nunca se persiste.
function institutionalEmail(value){return String(value||'').trim().toLowerCase();}
// Las declaraciones se registran sin enviar correos, contraseñas ni códigos.
// La revisión de fichas ajenas mantiene una sesión institucional autorizada.
async function recordsApi(action,payload={}){
 if(demo)throw new Error('El backend no está habilitado en la demostración');
 if(!configured)throw new Error('Supabase no está configurado');
 const authSession=sb ? (await sb.auth.getSession()).data.session : null;
 const headers={'Content-Type':'application/json','apikey':CFG.supabaseAnonKey};
 if(authSession?.access_token)headers.Authorization='Bearer '+authSession.access_token;
 const response=await fetch(CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/unt-registros',{
  method:'POST',headers,
  body:JSON.stringify({action,...payload})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw new Error(data.error||'No fue posible completar la solicitud');
 return data;
}
// V19.1: registro monotónico de cambios. Una respuesta de la red NO puede
// marcar como sincronizado un texto escrito después de iniciar la petición.
let autosaveTimer=null, editGeneration=0, activeSave=null;
function scheduleCloudSave(){
 if(demo||!state.recordToken||isLocked()||state.screen!=='workspace'||state.nav!=='registro')return;
 editGeneration++;state.dirty=true;clearTimeout(autosaveTimer);
 autosaveTimer=setTimeout(()=>{if(state.dirty)saveDraft(true).catch(e=>console.warn('Autoguardado pendiente',e));},4500);
}
function queueUnsavedChanges(){
 if(state.dirty&&!isLocked()&&state.recordToken){
   clearTimeout(autosaveTimer);
   autosaveTimer=setTimeout(()=>{if(state.dirty)saveDraft(true).catch(e=>console.warn('Nuevo intento de guardado',e))},1400);
 }
}

const currentFaculty=()=>D.faculties.find(f=>f.id===state.profile?.faculty_id)||D.faculties[0];
const facultyName=id=>D.faculties.find(f=>f.id===id)?.name||'FACULTAD POR DETERMINAR';
const notice=msg=>{toastEl.textContent=msg;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),4100)};
function emptyProfile(role='staff'){return {id:'',last_names:'',first_names:'',dni:'',worker_code:'',job_title:'',address:'',phone:'',institutional_email:'',personal_email:'',education_level:role==='authority'?'SUPERIOR':'',higher_detail:'',professional_title:'',masters_detail:'',doctorates_detail:'',masters_count:0,doctorates_count:0,academic_titles:[],academic_grades:[],faculty_id:state.selectedFaculty||'',org_unit:'',authority_scope:'',authority_unit:'',role,requested_role:role};}
const sampleProfile=role=>({ ...emptyProfile(role), id:'demo-'+role, last_names:MOCK_NAME[role][0],first_names:MOCK_NAME[role][1],dni:'00000000',worker_code:'EJEMPLO-001',job_title:'ASISTENTE ADMINISTRATIVO',address:'DOMICILIO FICTICIO DE PRUEBA',phone:'000000000',institutional_email:'demo@unitru.edu.pe',personal_email:'demo@example.com',education_level:'SUPERIOR',higher_detail:'ADMINISTRACIÓN',academic_titles:[{name:'LICENCIATURA EN ADMINISTRACIÓN',type:'PROFESIONAL'}],academic_grades:[{level:'BACHILLER',name:'ADMINISTRACIÓN'}],faculty_id:'fce',org_unit:role==='authority'?'DECANATO':role==='faculty_admin'?'ADMINISTRACIÓN DE FACULTAD':'SECRETARÍA ADMINISTRATIVA'});
const emptyFunction=()=>({id:ID(),description:'',activities:[{id:ID(),description:'',products:[emptyProduct()]}],notes:''});
function emptyProduct(){return {id:ID(),name:'',indicator:'',unit:'',frequency:'',product_type:'',temporality:'',execution_mode:'',months:[],normal:'',peak:'',intensity:5,complexity:5,priority:5,origin:'inicia',previous_unit:'',next_unit:'',reason:'',notes:''};}
function emptyContent(){return {functions:[emptyFunction()],observations:'',authority:{needs:[],revisions:[],outsourcing:[],difficulties:[],no_needs_confirmed:false}};}
function sampleContent(){return {functions:[{id:ID(),description:'GESTIONAR LA DOCUMENTACIÓN ADMINISTRATIVA DE LA FACULTAD PARA ASEGURAR SU TRÁMITE OPORTUNO.',activities:[{id:ID(),description:'RECIBIR, REVISAR Y REGISTRAR SOLICITUDES Y EXPEDIENTES ADMINISTRATIVOS.',products:[{...emptyProduct(),name:'EXPEDIENTES REGISTRADOS Y DERIVADOS',unit:'EXPEDIENTES/SEMANA',frequency:'DIARIA',months:['MARZO','AGOSTO'],normal:'20',peak:'45',intensity:7,complexity:5,priority:8,origin:'continua',previous_unit:'MESA DE PARTES',next_unit:'DECANATO'}]}],notes:''}],observations:'EJEMPLO SIN VALIDEZ INSTITUCIONAL. REGISTRO FICTICIO.',authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}};}
let aiSessions={};
let ai={description:'',respuestas:{},respuestasAnteriores:[],detalleNuevo:'',propuestas:[],preguntas:[],alertas:[],analisis:null,busy:false,error:'',token:'',attempts:0,selected:0,stage:'inicio',open:false,target:{kind:'function',fi:0,ai:0,pi:0}};
let state={sidebarHidden:false,screen:'faculty',selectedFaculty:'',authorityScope:'',role:null,nav:'registro',step:0,profile:null,submission:null,records:[],directory:[],dispatches:[],reviewers:[],coverage:null,metrics:[],filterFaculty:'fce',selectedId:null,modal:null,demoSwitch:false,loading:false,session:null,authEmail:'ssgdr@unitru.edu.pe',captchaToken:'',recordToken:'',revision_no:1,receipt:'',dirty:false,saveBusy:false,facReviewToken:'',facReviewRows:[],facReviewName:'',issuedFacultyLink:'',progress:[],progressError:''};
const seededRecords=()=>{const f=sampleContent();return [
  {id:'demo-reg-01',owner_id:'demo-uno',faculty_id:'fce',owner_name:'MENDOZA RUIZ, LUCÍA',job_title:'TÉCNICO ADMINISTRATIVO',org_unit:'SECRETARÍA ACADÉMICA',worker_code:'UNT-001',role:'staff',status:'submitted',content:f,updated_at:'2026-10-21T16:00:00Z'},
  {id:'demo-reg-02',owner_id:'demo-dos',faculty_id:'fce',owner_name:'SALINAS VEGA, JORGE',job_title:'ASISTENTE ADMINISTRATIVO',org_unit:'DECANATO',worker_code:'UNT-002',role:'staff',status:'validated',content:sampleContent(),updated_at:'2026-10-20T11:00:00Z'},
  {id:'demo-reg-03',owner_id:'demo-tres',faculty_id:'med',owner_name:'PALACIOS MEJÍA, MARÍA',role:'staff',status:'submitted',content:sampleContent(),updated_at:'2026-10-19T12:00:00Z'}
]};
// La demostración conserva las revisiones ficticias mientras se alterna entre roles
// dentro de la misma pestaña, sin escribir almacenamiento ni llamar a Supabase.
const demoReviewState=new Map();
function demoRecords(){return seededRecords().map(r=>{const d=demoReviewState.get(r.id);return d?{...r,content:d.content||r.content,revision_no:d.revision_no||1,faculty_checked:!!d.checked}:r;});}
if(demo)state.records=demoRecords();
function initialSubmission(){const content=emptyContent();if(state.role==='authority')content.functions=[];return {id:'demo-my-'+state.role,owner_id:state.profile?.id,faculty_id:state.profile?.faculty_id,role:state.role,status:'draft',content,updated_at:new Date().toISOString()}}
function barIcon(c){return `<span class="ico">${c}</span>`;}
const statusBadge=(s,role)=>{const [name,tone]=statuses[s]||statuses.draft;return `<span class="pill ${tone}">${esc(role==='authority'&&s==='submitted'?'RECIBIDO EN URH · POR REVISAR':name)}</span>`};
function navItems(){if(state.role==='urh_admin')return [['dashboard','◈','Panel institucional'],['registros','▤','Registros recibidos'],['indicadores','▥','Indicadores'],['despachos','⇩','Oficios Word']];if(state.role==='faculty_admin')return [['registro','▤','Mi ficha funcional'],['conformidad','✓','Revisión del personal'],['resumen','◈','Estado de mi ficha']];return [['registro','▤',state.role==='authority'?'Necesidades de mi unidad':'Mi registro funcional'],['resumen','◈','Estado del envío']];}
function brand(){return `<div class="brand"><img class="brand-shield" src="assets/escudo-manual-unt.png" alt="Escudo de la Universidad Nacional de Trujillo"><div><div class="brand-name">UNIVERSIDAD NACIONAL DE TRUJILLO</div><div class="brand-dependency"><span class="brand-direction">DIRECCIÓN GENERAL DE ADMINISTRACIÓN</span><span class="brand-unit">Unidad de Recursos Humanos</span></div></div></div>`;}
function ribbon(){return demo?`<span class="demo-ribbon">VISTA PREVIA · DATOS FICTICIOS · SIN REGISTRO</span>`:'';}
function viewFaculty(){const options=D.faculties.map(f=>`<option value="${esc(f.id)}" ${state.selectedFaculty===f.id?'selected':''}>FACULTAD DE ${esc(U(f.name))}</option>`).join('');return `<section class="landing faculty-landing"><header>${brand()}<div class="header-right"><button class="btn ghost sm" data-role="urh_admin">Acceso URH ↗</button></div></header><div class="landing-content first-landing"><div><span class="eyebrow">UNIVERSIDAD NACIONAL DE TRUJILLO · FACULTADES</span><h1>Diagnóstico de<br><em>puestos y funciones</em><br><span>del personal administrativo.</span></h1><p class="lead">Registro organizado de puestos, funciones, actividades y productos del personal administrativo de las facultades.</p><form id="facultySelectionForm" class="faculty-select-card"><div class="step-label">PASO 01 DE 02 · UBICACIÓN INSTITUCIONAL</div><label for="landing_faculty">Seleccione la facultad a la que pertenece</label><select id="landing_faculty" name="faculty" required><option value="">Elija su facultad</option>${options}</select><button class="btn primary wide" type="submit">Continuar →</button><p class="tiny muted">La facultad seleccionada se utilizará para organizar los registros institucionales.</p></form></div><div class="hero-visual" aria-hidden="true"><div class="hero-panel faculty-hero-panel"><div class="hero-top"><span>UNIVERSIDAD NACIONAL DE TRUJILLO</span><span>URH / 2026</span></div><div class="hero-number">13<span>.</span></div><p class="hero-statement">Facultades integradas en un diagnóstico institucional.</p><div class="hero-card"><b>Información para decisiones sustentadas</b><div class="hero-bars">${[36,63,45,78,57,90,62].map(h=>`<div style="height:${h}%"></div>`).join('')}</div><div class="hero-stats"><span>PERSONAL</span><span>FUNCIONES</span><span>DEMANDA</span></div></div></div></div></div><footer class="landing-bottom">Dirección General de Administración · Unidad de Recursos Humanos · Universidad Nacional de Trujillo</footer></section>${ribbon()}`;}
function viewLanding(){const f=facultyName(state.selectedFaculty);return `<section class="landing profile-landing"><header>${brand()}<button class="btn ghost sm" data-action="change-faculty">← Cambiar facultad</button></header><main class="role-choice"><span class="eyebrow">PASO 02 DE 02 · MODALIDAD DE REGISTRO</span><h1>Diagnóstico de puestos<br><em>y funciones</em></h1><div class="faculty-selected"><span>FACULTAD SELECCIONADA</span><strong>FACULTAD DE ${esc(U(f))}</strong></div><h2>¿Qué información desea registrar?</h2><p class="muted">Ingrese directamente y complete el formulario correspondiente.</p><div class="rolelist"><button class="rolecard" data-role="staff"><span class="roleicon">▤</span><span class="roletext"><b>Personal administrativo</b><small>Funciones, actividades, productos, frecuencia y condiciones de trabajo</small></span><span class="arw">→</span></button><button class="rolecard" data-role="faculty_admin"><span class="roleicon">✓</span><span class="roletext"><b>Administrador de facultad</b><small>Registra sus funciones y revisa las declaraciones de su facultad</small></span><span class="arw">→</span></button><button class="rolecard" data-role="authority"><span class="roleicon">⌂</span><span class="roletext"><b>Decanos y directores</b><small>Necesidades no atendidas, servicios externos y oportunidades de mejora</small></span><span class="arw">→</span></button></div></main></section>${ribbon()}`;}
function viewAuth(){return `<section class="landing auth-landing"><header>${brand()}<button class="btn ghost sm" data-action="go-home">← Volver</button></header><main class="auth"><div class="auth-head"><span class="eyebrow">ACCESO URH</span><h2>Administración institucional</h2><p class="muted">Ingrese con su cuenta autorizada de la Unidad de Recursos Humanos.</p></div><div class="card"><div class="callout bluecall"><b>UNIDAD DE RECURSOS HUMANOS</b><br>Administración de registros e indicadores de las facultades.</div><div class="spacer"></div><form id="loginForm" class="stack"><div class="field"><label>Correo institucional</label><input type="email" name="email" placeholder="usuario@unitru.edu.pe" value="${esc(state.authEmail)}" required autocomplete="username"></div><div class="field"><label>Contraseña</label><input type="password" name="password" placeholder="Ingrese su contraseña" required autocomplete="current-password" minlength="8"></div><button class="btn primary wide" type="submit">Ingresar al panel URH →</button></form><p class="tiny muted" style="margin-top:18px">Las credenciales se verifican en Supabase Auth y no se almacenan en GitHub.</p></div></main></section>`;}
function viewSetup(){return `<section class="landing auth-landing"><header>${brand()}<button class="btn ghost sm" data-action="go-home">← Inicio</button></header><main class="auth"><div class="auth-head"><span class="eyebrow">CONFIGURACIÓN DEL SISTEMA</span><h2>Conexión pendiente</h2><p class="muted">Debe configurarse el servicio institucional de recepción de información antes de enviar registros.</p></div><div class="card"><div class="callout bluecall"><b>Recepción no habilitada</b><br>Contacte a la Unidad de Recursos Humanos para configurar el servicio.</div><button class="btn primary" data-action="go-home" style="margin-top:22px">Volver al inicio</button></div></main></section>`;}
function viewAwaiting(){return `<section class="landing auth-landing"><header>${brand()}<button class="btn ghost sm" data-action="logout">Cerrar sesión</button></header><main class="auth"><div class="auth-head"><span class="eyebrow">VERIFICACIÓN DE PERFIL</span><h2>Solicitud de acceso registrada</h2><p class="muted">Su identificación fue guardada y el perfil solicitado necesita autorización institucional.</p></div><div class="card"><div class="callout bluecall"><b>Perfil solicitado:</b> ${esc(roles[state.profile?.requested_role]?.label||'PERFIL DE USUARIO')}<br><b>Facultad:</b> ${esc(facultyName(state.profile?.faculty_id))}</div><p class="subtle" style="margin-top:20px">La Dirección General de Administración y la Unidad de Recursos Humanos deben verificar la habilitación del rol antes de permitir el acceso al módulo de validación o al diagnóstico de autoridades. Ingrese nuevamente después de recibir la confirmación.</p><button class="btn primary" data-action="logout">Volver al inicio</button></div></main></section>`;}
function shell(inner,title='Registro funcional'){const menus=navItems();return `<div class="shell ${state.sidebarHidden?'sidebar-collapsed':''}"><aside class="sidebar" id="sidebar" aria-label="Navegación de la aplicación">${brand()}<div class="sidebar-heading">NAVEGACIÓN</div><nav class="sidebar-nav">${menus.map(([key,icon,name])=>`<button class="side-item ${state.nav===key?'active':''}" data-nav="${key}">${barIcon(icon)}<span>${name}</span></button>`).join('')}</nav><div class="side-bottom"><div class="person">${esc(state.profile?.first_names||'USUARIO')} ${esc(state.profile?.last_names||'')}</div><div class="micro">${esc(roles[state.role]?.label||'')}</div><button data-action="logout">↗ ${state.role==='urh_admin'?'Cerrar sesión':'Finalizar y salir'}</button></div></aside><button type="button" class="sidebar-scrim" data-action="close-menu" aria-label="Cerrar menú de navegación" tabindex="-1"></button><div class="content"><header class="topbar"><div class="flex"><button class="btn ghost sm toolbar-mob" type="button" data-action="menu" aria-controls="sidebar" aria-expanded="${state.sidebarHidden?'false':'true'}" aria-label="Mostrar u ocultar el menú de navegación" title="Mostrar u ocultar el menú">☰ <span class="menu-caption">${state.sidebarHidden?'Mostrar menú':'Ocultar menú'}</span></button><button class="back-nav" type="button" data-action="go-back" aria-label="Regresar a la pantalla anterior"><span aria-hidden="true">←</span> Regresar</button><div class="breadcrumb">Diagnóstico de puestos / <b>${esc(title)}</b></div></div><div class="topright"><span class="pill">${esc(state.role==='urh_admin'?'COBERTURA INSTITUCIONAL':facultyName(state.profile?.faculty_id))}</span><span class="avatar">${esc((state.profile?.first_names||'U').slice(0,1))}</span></div></header><main class="main">${inner}<div class="footer-note">Dirección General de Administración · Unidad de Recursos Humanos · Universidad Nacional de Trujillo · Uso institucional. El diagnóstico no constituye, por sí solo, una evaluación individual de desempeño.</div></main></div></div>${ribbon()}${state.modal?modal():''}`;}
function pageTitle(kicker,title,desc,action=''){return `<div class="page-intro"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2><p>${desc}</p></div>${action}</div>`;}
function input(name,label,value='',type='text',opts={}){const full=opts.full?' full':'';const hint=opts.hint?`<span class="hint">${esc(opts.hint)}</span>`:'';const check=/^prod_\d+_\d+_\d+_name$/.test(name)?`<div class="writing-check" data-writing-check="${esc(name)}" role="status" hidden></div>`:''; const required=opts.required?'required':'';const upp=opts.upper!==false&&type!=='email'?'upper':'';return `<div class="field${full}"><label for="${name}">${esc(label)}${required?' *':''}</label><input id="${name}" name="${name}" type="${type}" class="${upp}" value="${esc(value)}" ${required} ${opts.maxlength?`maxlength="${opts.maxlength}"`:''} ${opts.placeholder?`placeholder="${esc(opts.placeholder)}"`:''}/>${check}${hint}</div>`;}
function select(name,label,options,chosen='',opts={}){return `<div class="field ${opts.full?'full':''}"><label for="${name}">${esc(label)}${opts.required?' *':''}</label><select id="${name}" name="${name}" ${opts.required?'required':''}><option value="">Seleccione una opción</option>${options.map(x=>{const value=typeof x==='string'?x:x.value,label=typeof x==='string'?x:x.label;return `<option value="${esc(value)}" ${value===chosen?'selected':''}>${esc(label)}</option>`}).join('')}</select>${opts.hint?`<span class="hint">${esc(opts.hint)}</span>`:''}</div>`;}
function textarea(name,label,value='',opts={}){const check=/^(fn_desc_\d+|act_\d+_\d+)$/.test(name)?`<div class="writing-check" data-writing-check="${esc(name)}" role="status" hidden></div>`:'';return `<div class="field full"><label for="${name}">${esc(label)}${opts.required?' *':''}</label><textarea id="${name}" name="${name}" rows="${opts.rows||3}" ${opts.required?'required':''} placeholder="${esc(opts.placeholder||'')}" class="${opts.upper===false?'':'upper'}">${esc(value)}</textarea>${check}${opts.hint?`<span class="hint">${esc(opts.hint)}</span>`:''}</div>`;}
function profileView(){let p=state.profile||emptyProfile(state.role);return `<div class="card"><div class="section-head"><span class="section-mark">01</span><div><h3>Identificación personal y académica</h3><p class="muted tiny" style="margin:0">Complete los datos que conozca. Puede declarar estudios, especialidades y grados obtenidos sin requisitos adicionales.</p></div></div><form id="profileForm"><div class="input-grid">${input('last_names','APELLIDOS',p.last_names,'text',{required:true})}${input('first_names','NOMBRES',p.first_names,'text',{required:true})}${input('dni','DOCUMENTO DE IDENTIDAD (DNI, SI CORRESPONDE)',p.dni,'text',{maxlength:20,hint:'Puede completar o corregir el documento de identidad posteriormente.'})}${input('worker_code','CÓDIGO DE TRABAJADOR',p.worker_code,'text',{required:true})}${input('job_title','DENOMINACIÓN DEL PUESTO O CARGO',p.job_title||'','text',{})}${input('address','DOMICILIO (SI CORRESPONDE)',p.address,'text',{full:true})}${input('phone','NÚMERO DE CELULAR (OPCIONAL)',p.phone,'tel',{})}${input('institutional_email','CORREO INSTITUCIONAL (SI DISPONE)',p.institutional_email,'text',{upper:false})}${input('personal_email','CORREO ELECTRÓNICO PERSONAL (OPCIONAL)',p.personal_email,'text',{upper:false})}${academicView(p)}<div class="field"><label>FACULTAD DE ADSCRIPCIÓN *</label><input readonly value="FACULTAD DE ${esc(U(facultyName(p.faculty_id||state.selectedFaculty)))}" aria-label="Facultad seleccionada"><input name="faculty_id" type="hidden" value="${esc(p.faculty_id||state.selectedFaculty)}"></div>${state.role==='authority'?`${select('authority_scope','RESPONSABILIDAD ACADÉMICA O DE GOBIERNO',[{value:'DECANATO',label:'DECANO(A)'},{value:'ESCUELA',label:'DIRECTOR(A) DE ESCUELA PROFESIONAL'},{value:'DEPARTAMENTO',label:'DIRECTOR(A) DE DEPARTAMENTO ACADÉMICO'}],p.authority_scope||'',{})}${input('authority_unit','ESCUELA PROFESIONAL O DEPARTAMENTO ACADÉMICO (SEGÚN CORRESPONDA)',p.authority_unit||'','text',{full:true,placeholder:'EJ. ESCUELA PROFESIONAL DE ECONOMÍA; NO CORRESPONDE SI ES DECANO'})}`:''}${input('org_unit','UNIDAD DE ORGANIZACIÓN DONDE DESEMPEÑA SUS LABORES',p.org_unit,'text',{full:true,placeholder:'EJ. SECRETARÍA ACADÉMICA, DECANATO, DIRECCIÓN DE ESCUELA...'})}</div><div class="divider"></div><div class="form-actions right"><button class="btn primary" type="submit">Continuar y guardar borrador →</button></div></form></div>`;}
function normalizedAcademicProfile(p){const level=String(p.education_level||'').toUpperCase();const result={...p,education_level:['SECUNDARIA','TÉCNICO','SUPERIOR'].includes(level)?level:level.startsWith('SECUNDARIA')?'SECUNDARIA':level.includes('TÉCNIC')?'TÉCNICO':level?'SUPERIOR':''};let titles=Array.isArray(p.academic_titles)?p.academic_titles:[];let grades=Array.isArray(p.academic_grades)?p.academic_grades:[];if(!Array.isArray(p.academic_titles)&&p.professional_title){titles=[{type:result.education_level==='TÉCNICO'?'TÉCNICO':'PROFESIONAL',name:p.professional_title}];}if(!Array.isArray(p.academic_grades)){if(level==='BACHILLER')grades.push({level:'BACHILLER',name:p.higher_detail||''});const nM=Math.max(0,Number(p.masters_count)||0),nD=Math.max(0,Number(p.doctorates_count)||0);String(p.masters_detail||'').split('\n').slice(0,nM).forEach(name=>grades.push({level:'MAESTRÍA',name}));String(p.doctorates_detail||'').split('\n').slice(0,nD).forEach(name=>grades.push({level:'DOCTORADO',name}));}result.academic_titles=titles;result.academic_grades=grades;return result;}
function academicView(profile){
 const p=normalizedAcademicProfile(profile),level=state.role==='authority'?'SUPERIOR':p.education_level;
 const higher=level==='SUPERIOR',technical=level==='TÉCNICO';
 const degrees=technical?['BACHILLER TÉCNICO','OTRO GRADO TÉCNICO']:['BACHILLER','MAESTRÍA','DOCTORADO','OTRO GRADO'];
 const degreeRows=(p.academic_grades||[]).map((row,i)=>`<div class="academic-line"><div class="field"><label for="academic_grade_${i}_level">GRADO / CONDICIÓN ${i+1}</label><select id="academic_grade_${i}_level" name="academic_grade_${i}_level"><option value="">Seleccione, si corresponde</option>${[...new Set([...degrees,row.level].filter(Boolean))].map(x=>`<option value="${esc(x)}" ${row.level===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label for="academic_grade_${i}_name">DENOMINACIÓN O ESPECIALIDAD</label><input id="academic_grade_${i}_name" name="academic_grade_${i}_name" class="upper" value="${esc(row.name||'')}" placeholder="EJ. ${technical?'BACHILLER TÉCNICO EN CONTABILIDAD':'BACHILLER EN ECONOMÍA O MAGÍSTER EN GESTIÓN PÚBLICA'}"></div><button class="btn ghost sm remove-academic" type="button" data-action="delete-academic-grade" data-idx="${i}" aria-label="Eliminar grado ${i+1}">Eliminar</button></div>`).join('');
 const titleRows=(p.academic_titles||[]).map((row,i)=>`<div class="academic-line"><div class="field"><label for="title_type_${i}">TIPO DE TÍTULO ${i+1}</label><select id="title_type_${i}" name="title_type_${i}">${['TÉCNICO','PROFESIONAL','SEGUNDA ESPECIALIDAD','OTRO'].map(t=>`<option value="${t}" ${row.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label for="academic_title_${i}">TÍTULO ${i+1} · DENOMINACIÓN</label><input id="academic_title_${i}" class="upper" name="academic_title_${i}" value="${esc(row.name||'')}" placeholder="EJ. ${technical?'TÉCNICO EN ADMINISTRACIÓN':'ECONOMISTA, ABOGADO, CONTADOR PÚBLICO...'}"></div><button class="btn ghost sm remove-academic" type="button" data-action="delete-academic-title" data-idx="${i}" aria-label="Eliminar título ${i+1}">Eliminar</button></div>`).join('');
 return `<div class="academic-level-wrap full"><div class="field"><label id="education_title">NIVEL EDUCATIVO</label>${state.role==='authority'?`<div class="field"><input type="text" value="SUPERIOR / UNIVERSITARIO (PREDETERMINADO)" readonly aria-label="Nivel superior predeterminado"><input type="hidden" name="education_level" value="SUPERIOR"></div>`:`<div class="education-pills" role="radiogroup" aria-labelledby="education_title">${[['SECUNDARIA','Secundaria'],['TÉCNICO','Técnico'],['SUPERIOR','Superior / universitario']].map(([code,label])=>`<label class="education-choice ${level===code?'selected':''}"><input type="radio" name="education_level" value="${code}" ${level===code?'checked':''}><span>${label}</span></label>`).join('')}</div><span class="hint">Seleccione el nivel que corresponda. Los grados y títulos son opcionales y se pueden ampliar sin límites artificiales.</span>`}</div></div><div id="academic_extra" class="academic-extra full ${technical||higher?'':'is-hidden'}">${input('higher_detail',technical?'CARRERA O ESPECIALIDAD TÉCNICA':'CARRERA O ESPECIALIDAD DE ESTUDIOS SUPERIORES',p.higher_detail||'','text',{full:true,placeholder:'EJ. ADMINISTRACIÓN, ECONOMÍA, INGENIERÍA... (SI CORRESPONDE)'})}<div class="academic-block"><div class="academic-block-head"><div><b>${technical?'Grado técnico obtenido (si corresponde)':'Grado académico obtenido (si corresponde)'}</b><p>${technical?'Puede consignar bachiller técnico u otro grado que corresponda.':'Puede consignar bachiller, maestría, doctorado u otro grado.'} Precise la especialidad de cada grado.</p></div><button type="button" class="btn ghost sm" data-action="add-academic-grade">+ Añadir grado</button></div><div class="academic-list">${degreeRows||'<p class="academic-empty">Ningún grado registrado; puede continuar sin agregarlo.</p>'}</div></div><div class="academic-block"><div class="academic-block-head"><div><b>${technical?'Título técnico (si corresponde)':'Título profesional (si corresponde)'}</b><p>Indique la denominación exacta del título que posee. Si no tiene título, continúe sin completar este apartado.</p></div><button type="button" class="btn ghost sm" data-action="add-academic-title">+ Añadir título</button></div><div class="academic-list">${titleRows||'<p class="academic-empty">Sin títulos registrados.</p>'}</div></div></div>`;
}
function updateAcademicVisibility(){const form=$('#profileForm');if(!form)return;state.profile={...(state.profile||{}),...formProfile()};state.profile=normalizedAcademicProfile(state.profile);if(state.profile.education_level==='SECUNDARIA'){state.profile.academic_titles=[];state.profile.academic_grades=[];state.profile.higher_detail='';}render(true);}
function updateAcademicRows(action,idx){const form=$('#profileForm');if(!form)return;state.profile=normalizedAcademicProfile({...(state.profile||{}),...formProfile()});const titles=state.profile.academic_titles,grades=state.profile.academic_grades;if(action==='add-academic-title')titles.push({type:state.profile.education_level==='TÉCNICO'?'TÉCNICO':'PROFESIONAL',name:''});if(action==='delete-academic-title')titles.splice(idx,1);if(action==='add-academic-grade')grades.push({level:'',name:''});if(action==='delete-academic-grade')grades.splice(idx,1);render(true);}

function steps(){return state.role==='authority'?['Identificación','Necesidades de la unidad','Observaciones','Revisión']:['Identificación','Funciones y productos','Observaciones','Revisión'];}
function declaration(){const stages=steps();let step=state.step;return shell(`${state.recordToken?`<div class="save-status tiny muted" role="status">${state.dirty?'Cambios pendientes de guardar':'Borrador guardado en Supabase'}</div>`:''}${pageTitle('REGISTRO INSTITUCIONAL',state.role==='authority'?'Necesidades de mi unidad':'Mi información funcional','Complete cada apartado de manera clara. Puede revisar toda su información antes de enviarla.')}
<div class="step-caption">ETAPA ${step+1} DE ${stages.length} · ${stages[step].toUpperCase()}</div><div class="stepper">${stages.map((n,i)=>`<div title="${n}" class="segment ${i===step?'active':i<step?'done':''}"></div>`).join('')}</div>${state.submission?.status==='submitted'||state.submission?.status==='validated'||state.submission?.status==='forwarded'?`<div class="callout bluecall" style="margin-bottom:17px">Su registro figura como <b>${statuses[state.submission.status][0]}</b>. Puede revisar los datos. Si existen observaciones, coordine su atención con la URH. No se reabren fichas desde computadoras compartidas.</div>`:''}
${step===0?profileView():state.role==='authority'&&step===1?authorityView():step===1?functionsView():step===stages.length-2?observationsView():reviewView()}`,'Mi registro');}
function functionsView(){const data=state.submission?.content||emptyContent();const locked=isLocked();return `<div class="card"><div class="section-head"><span class="section-mark">02</span><div><h3>Funciones, actividades y productos</h3><p class="muted tiny" style="margin:0">Agregue tantas funciones como correspondan. Los productos se vinculan a sus respectivas actividades. Las observaciones de coherencia son orientativas y no impiden continuar.</p></div></div><div class="inline-help"><b>Cómo redactar una función:</b> <strong>VERBO EN INFINITIVO + SUJETO U OBJETO DE LA ACCIÓN + ATRIBUTO.</strong><br>Ejemplo: «Gestionar la documentación administrativa de la facultad para asegurar su trámite oportuno».<br><span class="tiny muted">Una función es una responsabilidad general de carácter continuo; una actividad explica cómo se desarrolla; un producto es el resultado verificable. No se solicitan archivos ni evidencias en esta etapa.</span></div>
${data.functions.map((f,fi)=>functionCard(f,fi,locked)).join('')}
${!locked&&ai.open?aiAssistantPanel():''}${!locked?`<div class="btnrow"><button class="btn ghost" data-action="add-function">+ Agregar otra función</button></div>`:''}<div class="form-actions"><button class="btn ghost" data-action="prev-step">← Identificación</button><div class="btnrow"><button class="btn ghost" data-action="save-draft">Guardar avance de esta sesión</button><button class="btn primary" data-action="next-step">Continuar →</button></div></div></div>`;}
// Panel contextual de apoyo: permanece oculto hasta que el usuario lo solicita junto a un campo.
function aiTargetKey(t){return `${t.kind}:${t.fi}:${t.ai}:${t.pi}`;}
function saveAiSession(){if(ai.target){aiSessions[aiTargetKey(ai.target)]={description:ai.description,respuestas:{...ai.respuestas},respuestasAnteriores:ai.respuestasAnteriores.map(x=>({...x})),detalleNuevo:ai.detalleNuevo,propuestas:structuredClone(ai.propuestas),preguntas:[...ai.preguntas],alertas:[...ai.alertas],analisis:ai.analisis?structuredClone(ai.analisis):null,attempts:ai.attempts,selected:ai.selected,stage:ai.stage};}}
function aiTrigger(kind,fi,act=0,pi=0){
 const phrase=kind==='function'?'Apoyo para redactar la función':kind==='activity'?'Apoyo para las actividades':'Apoyo para identificar productos';
 return `<div class="ai-inline-action"><button type="button" class="ai-assist-trigger" data-action="ai-open" data-kind="${kind}" data-fi="${fi}" data-ai="${act}" data-pi="${pi}" aria-label="Abrir asistente local de redacción: ${phrase}"><span aria-hidden="true">✦</span> ${phrase} <span aria-hidden="true">↗</span></button></div>`;
}
function aiAssistantPanel(){
 const target=ai.target?.kind||'function',chosen=ai.propuestas[ai.selected];
 const f=state.submission?.content?.functions?.[ai.target.fi],a=f?.activities?.[ai.target.ai];
 const labels={function:'Redactar la función',activity:'Redactar actividades',product:'Identificar el producto'};
 const promptLabel={function:'¿Qué responsabilidad cumples en tu puesto?',activity:'¿Cómo realizas esta función?',product:'¿Qué resultado obtienes al realizar esta actividad?'};
 const hints={function:'Describe de qué te encargas y para qué lo haces. No es necesario detallar todavía las actividades.',activity:'Explica las acciones que realizas para cumplir la función. Puedes escribirlas seguidas.',product:'Indica qué documento, registro, información organizada o servicio concreto queda al terminar.'};
 const placeholders={function:'Ej.: Me encargo de recibir y tramitar las solicitudes que llegan a la secretaría de la facultad, procurando que sean atendidas dentro de los plazos.',activity:'Ej.: Recibo las solicitudes, reviso sus requisitos, las registro en el sistema y las derivo a la unidad competente.',product:'Ej.: Queda el registro de las solicitudes tramitadas y las constancias de derivación.'};
 const guidance={function:'La propuesta se incorporará únicamente al campo de función. Las actividades y los productos se completan más abajo.',activity:'Se utilizará la función registrada como referencia. Se propondrán exclusivamente actividades, no productos.',product:'Se utilizarán la función y la actividad ya registradas para proponer el resultado verificable.'};
 const fnContext=target!=='function'?`<section class="ai-linked-context"><span>FUNCIÓN DE REFERENCIA</span><p>${esc(f?.description||'Aún no se ha registrado la función. Es recomendable completarla primero.')}</p>${target==='product'?`<span>ACTIVIDAD DE REFERENCIA</span><p>${esc(a?.description||'Aún no se ha registrado la actividad.')}</p>`:''}</section>`:'';
 const reference={function:'En la Secretaría Académica me encargo de gestionar la atención de solicitudes estudiantiles para facilitar su tramitación oportuna.',activity:'Recibo y verifico los requisitos de las solicitudes; después las registro y remito a la unidad competente.',product:'El resultado de esta actividad es un registro actualizado de solicitudes atendidas.'}[target];
 let preview='';
 if(chosen){
  if(target==='function')preview=`<div class="ai-result-card"><span class="ai-result-eyebrow">FUNCIÓN PROPUESTA</span><label for="ai_edit_fn">Revise la redacción y ajuste lo necesario</label><textarea id="ai_edit_fn" data-ai-field="funcion" rows="4" maxlength="900">${esc(chosen.funcion)}</textarea><div class="ai-function-alert" role="status" ${functionWritingAdvice(chosen.funcion)?'':'hidden'}>ⓘ ${esc(functionWritingAdvice(chosen.funcion))}</div></div>`;
  if(target==='activity')preview=`<div class="ai-result-card"><div class="ai-result-head"><span class="ai-result-eyebrow">ACTIVIDADES PROPUESTAS</span><button type="button" class="btn ghost sm" data-action="ai-add-activity">+ Añadir</button></div><p class="ai-result-help">Conserve únicamente las actividades que efectivamente realiza.</p>${chosen.actividades.map((x,i)=>`<div class="ai-one-field"><label for="ai_edit_act_${i}">Actividad ${i+1}</label><textarea id="ai_edit_act_${i}" rows="3" data-ai-field="actividad" data-idx="${i}" maxlength="650">${esc(x.actividad)}</textarea><button type="button" class="ai-tiny-delete" data-action="ai-remove-activity" data-idx="${i}">Quitar actividad</button></div>`).join('')}</div>`;
  if(target==='product')preview=`<div class="ai-result-card"><div class="ai-result-head"><span class="ai-result-eyebrow">PRODUCTOS PROPUESTOS</span><button type="button" class="btn ghost sm" data-action="ai-add-product" data-idx="0">+ Añadir</button></div><p class="ai-result-help">Confirme cuáles son resultados reales de la actividad.</p>${(chosen.actividades[0]?.productos||[]).map((x,i)=>`<div class="ai-one-field"><label for="ai_edit_prod_${i}">Producto ${i+1}</label><textarea id="ai_edit_prod_${i}" rows="2" data-ai-field="producto" data-idx="0" data-prod="${i}" maxlength="230">${esc(x)}</textarea><button type="button" class="ai-tiny-delete" data-action="ai-remove-product" data-idx="0" data-prod="${i}">Quitar producto</button></div>`).join('')}</div>`;
 }
 const hasSuggestion=target==='function'?Boolean(chosen?.funcion?.trim()):target==='activity'?Boolean(chosen?.actividades?.some(x=>x.actividad.trim())):Boolean(chosen?.actividades?.[0]?.productos?.some(x=>x.trim()));
 return `<div class="ai-drawer-backdrop" data-action="ai-close" aria-hidden="true"></div>
 <aside class="ai-drawer ai-compact-drawer" role="dialog" aria-modal="true" aria-labelledby="ai-drawer-title" tabindex="-1">
 <header class="ai-drawer-header"><div class="ai-drawer-title"><div class="ai-drawer-symbol" aria-hidden="true">✦</div><div><span class="eyebrow">ASISTENTE DE INTERPRETACIÓN FUNCIONAL · UNT</span><h3 id="ai-drawer-title">${labels[target]}</h3></div></div><button type="button" class="ai-drawer-close" data-action="ai-close" aria-label="Cerrar asistente">✕</button></header>
 <div class="ai-drawer-scroll"><p class="ai-short-intro">${guidance[target]}</p>${fnContext}
 <section class="ai-brief-input"><label for="ai_work_desc">${promptLabel[target]}</label><p>${hints[target]}</p><textarea id="ai_work_desc" rows="5" maxlength="3500" placeholder="${placeholders[target]}">${esc(ai.description)}</textarea><div class="ai-helperline"><details class="ai-reference"><summary>Ver un ejemplo de descripción</summary><p>${reference}</p></details><span id="ai-char-count">${ai.description.length}/3500</span></div></section>
 ${ai.preguntas.length?`<section class="ai-single-question"><label for="ai_answer_0">${esc(ai.preguntas[0])}</label><textarea id="ai_answer_0" data-ai-answer="0" rows="4" maxlength="650" placeholder="Amplíe aquí la información, si corresponde.">${esc(ai.respuestas[0]||'')}</textarea></section>`:''}
 <div class="ai-actions-simple"><button type="button" class="btn primary" data-action="ai-generate" ${ai.busy?'disabled':''}>${ai.busy?'✦ Preparando propuesta…':ai.attempts?'✦ Mejorar redacción':'✦ Obtener propuesta'}</button><span class="tiny muted">Análisis contextual local, sin envío a proveedores de IA. Compruebe que el texto refleje su trabajo real.</span></div>
 
 ${ai.attempts&&ai.analisis?`<section class="ai-v17-interpretation" aria-label="Interpretación del asistente"><div class="ai-v17-label">Así entendí tu descripción</div><div class="ai-v17-data"><b>Proceso:</b> ${esc((ai.analisis.procesos||[]).slice(0,2).map(x=>x.nombre).join(' · ')||'Necesito más detalles')}</div><div class="ai-v17-data"><b>Acciones identificadas:</b> ${esc((ai.analisis.accionesDeclaradas||[]).slice(0,6).join(', ')||'No identificadas todavía')}</div>${ai.analisis.fragmentosExcluidos?.length?`<p class="ai-v17-data">No he considerado ${ai.analisis.fragmentosExcluidos.length} acción(es) negada(s) o atribuidas a otra persona.</p>`:''}<p class="tiny muted" style="margin:6px 0 0">Si no corresponde, modifica tu explicación y pulsa «Mejorar redacción».</p></section>`:''}
 ${ai.error?`<p role="alert" class="ai-error">${esc(ai.error)}</p>`:''}
 ${chosen?`<section class="ai-simple-results"><div class="ai-simple-results-title"><h4>Propuesta para este campo</h4><span>Editable antes de incorporarla</span></div>${target==='function'&&ai.propuestas.length>1?`<div class="ai-alternatives" role="group" aria-label="Funciones o formulaciones detectadas"><span class="tiny muted">Propuestas:</span>${ai.propuestas.map((_,i)=>`<button type="button" class="ai-option ${i===ai.selected?'selected':''}" data-action="ai-select-option" data-idx="${i}" aria-pressed="${i===ai.selected}">${i+1}</button>`).join('')}</div>`:''}${ai.alertas.length?`<p class="ai-cautions">${esc(ai.alertas[0])}</p>`:''}${preview}${hasSuggestion?`<button type="button" class="btn primary ai-save-result" data-action="ai-apply" data-idx="${ai.selected}">✓ ${target==='function'?'Incorporar función':target==='activity'?'Incorporar actividades':'Incorporar productos'}</button>${target==='function'&&ai.propuestas.length>1?`<button type="button" class="btn ghost ai-save-result" data-action="ai-apply-all">Incorporar las ${ai.propuestas.length} propuestas como funciones separadas</button><p class="tiny muted">Utilice esta opción solo cuando correspondan a responsabilidades distintas. Revise duplicidades y complete las actividades y productos reales.</p>`:''}`:`<p class="ai-result-help">Se necesita precisar el trabajo realizado para construir una propuesta.</p>`}</section>`:''}
 </div><footer class="ai-drawer-footer"><span>La redacción final será confirmada por el servidor.</span><button type="button" class="btn ghost sm" data-action="ai-close">Cerrar</button></footer></aside>`;
}
function demoAiProposals(description,answers=[],target='function',fn='',activity=''){
 const text=(description+' '+answers.map(x=>x.respuesta).join(' ')).toLocaleLowerCase('es-PE');
 const context=(fn+' '+activity+' '+text).toLocaleLowerCase('es-PE');
 const hasDoc=/document|solicitu|expedient|papel|tramit|trámit|registro|mesa de parte/.test(context);
 const hasStudy=/horari|aula|asisten|clase|estudiant|matricul|académic/.test(context);
 if(target==='function'){
  if(text.trim().length<18)return {propuestas:[],preguntas:['¿De qué trabajo se encarga y cuál es su finalidad?'],alertas:[]};
  const funcion=hasStudy?'ORGANIZAR LA INFORMACIÓN ACADÉMICA ASIGNADA PARA CONTRIBUIR AL DESARROLLO OPORTUNO DE LAS ACTIVIDADES DE LA FACULTAD.':hasDoc?'GESTIONAR LA DOCUMENTACIÓN ADMINISTRATIVA DE LA FACULTAD PARA CONTRIBUIR A LA ATENCIÓN OPORTUNA DE LOS TRÁMITES.':'COORDINAR LAS ACTIVIDADES ADMINISTRATIVAS ASIGNADAS PARA CONTRIBUIR AL FUNCIONAMIENTO DE LA FACULTAD.';
  return {propuestas:[{funcion,actividades:[]}],preguntas:[],alertas:['Ejemplo ilustrativo: compruebe que refleja su responsabilidad real.']};
 }
 if(target==='activity'){
  if(!fn.trim())return {propuestas:[],preguntas:['¿Cuál es la función a la que corresponden estas actividades?'],alertas:[]};
  const specs=[[/recib|solicitu|papel|expedient/,'RECIBIR LAS SOLICITUDES O DOCUMENTOS QUE SE PRESENTAN EN LA FACULTAD.'],[/revis|verif|complet|requisit/,'VERIFICAR LOS REQUISITOS DE LA DOCUMENTACIÓN RECIBIDA.'],[/registr|sistem|anot/,'REGISTRAR LAS SOLICITUDES EN EL SISTEMA INSTITUCIONAL CORRESPONDIENTE.'],[/deriv|remit|mand|env[ií]/,'DERIVAR LA DOCUMENTACIÓN A LA UNIDAD DE ORGANIZACIÓN COMPETENTE.'],[/seguim|estado|respon/,'REALIZAR EL SEGUIMIENTO DE LOS TRÁMITES PENDIENTES.'],[/comunic|avis|inform/,'COMUNICAR EL ESTADO DEL TRÁMITE A LOS INTERESADOS.'],[/lista|relaci[oó]n/,'ELABORAR LAS RELACIONES DE INFORMACIÓN SOLICITADAS.'],[/horari|aula/,'ACTUALIZAR LA PROGRAMACIÓN DE HORARIOS O AMBIENTES SEGÚN LA INFORMACIÓN RECIBIDA.']];
  const acts=specs.filter(([pat])=>pat.test(text)).map(([,actividad])=>({actividad,productos:[]}));
  if(!acts.length)return {propuestas:[],preguntas:['¿Qué acciones concretas realiza para cumplir esta función?'],alertas:[]};
  return {propuestas:[{funcion:fn,actividades:acts}],preguntas:[],alertas:[]};
 }
 if(!activity.trim())return {propuestas:[],preguntas:['¿Qué actividad realiza antes de obtener este resultado?'],alertas:[]};
 const products=[];
 const evidence=(activity+' '+text).toLocaleLowerCase('es-PE');
 if(/registr|sistem/.test(evidence))products.push('REGISTROS DE SOLICITUDES O DOCUMENTOS');
 if(/deriv|remit/.test(evidence))products.push('CONSTANCIAS DE DERIVACIÓN DE DOCUMENTOS');
 if(/lista|relacion|relación/.test(evidence))products.push('RELACIONES O LISTAS ELABORADAS');
 if(/report|informe/.test(evidence))products.push('REPORTES ELABORADOS');
 if(!products.length)return {propuestas:[],preguntas:['¿Qué documento, registro o resultado concreto queda al finalizar esta actividad?'],alertas:[]};
 return {propuestas:[{funcion:fn,actividades:[{actividad:activity,productos:[...new Set(products)]}]}],preguntas:[],alertas:['Referencia ilustrativa: confirme los productos que efectivamente obtiene.']};
}
function cleanAiOption(v){
 if(!v||typeof v.funcion!=='string'||!Array.isArray(v.actividades))return null;
 const acts=v.actividades.slice(0,25).filter(x=>x&&typeof x.actividad==='string').map(x=>({actividad:x.actividad.slice(0,650),productos:Array.isArray(x.productos)?x.productos.filter(q=>typeof q==='string').slice(0,12).map(z=>z.slice(0,230)):[]}));
 return {funcion:v.funcion.slice(0,900),actividades:acts};
}
function syncAiAnswers(){
 $$("[data-ai-answer]").forEach(el=>{ai.respuestas[Number(el.dataset.aiAnswer)]=el.value});
 const extra=document.getElementById('ai_more');if(extra)ai.detalleNuevo=extra.value;
}
function saveAiResponses(){
 syncAiAnswers();const gathered=[];
 ai.preguntas.forEach((q,i)=>{const response=(ai.respuestas[i]||'').trim();if(response)gathered.push({pregunta:q,respuesta:response})});
 ai.respuestasAnteriores.push(...gathered);ai.respuestasAnteriores=ai.respuestasAnteriores.slice(-20);
 ai.preguntas=[];ai.respuestas={};
}
function syncAiDraft(){
 const chosen=ai.propuestas[ai.selected];if(!chosen)return;
 const fn=document.getElementById('ai_edit_fn');if(fn)chosen.funcion=fn.value;
 $$("[data-ai-field='actividad']").forEach(el=>{let a=chosen.actividades[Number(el.dataset.idx)];if(a)a.actividad=el.value});
 $$("[data-ai-field='producto']").forEach(el=>{let a=chosen.actividades[Number(el.dataset.idx)];if(a&&a.productos[Number(el.dataset.prod)]!==undefined)a.productos[Number(el.dataset.prod)]=el.value});
}
async function aiGenerate(){
 if(ai.busy)return;
 syncAiAnswers();syncAiDraft();
 const desc=ai.description.trim(),more=ai.detalleNuevo.trim();
 const answers=ai.preguntas.map((pregunta,i)=>({pregunta,respuesta:(ai.respuestas[i]||'').trim()})).filter(x=>x.respuesta);
 const refF=state.submission?.content?.functions?.[ai.target.fi],refA=refF?.activities?.[ai.target.ai];if(desc.length<10&&!(ai.target.kind==='activity'&&refF?.description?.trim().length>14)&&!(ai.target.kind==='product'&&refA?.description?.trim().length>12)){ai.error='Agregue una frase sobre su trabajo o complete primero el campo de referencia.';render(true);return;}
 if(desc.length>3500||more.length>1700){ai.error='El texto es muy largo; distribúyelo entre las respuestas y la descripción.';render(true);return;}
 const sensitive=[desc,more,...answers.map(x=>x.respuesta)].join(' ');
 if(/\b\d{8}\b|\b\d{9}\b|[^\s@]+@[^\s@]+\.[^\s@]+/.test(sensitive)){ai.error='Retira números de DNI, celular y correos de tu explicación antes de continuar.';render(true);return;}
 if(ai.preguntas.length&&!answers.length&&!ai.propuestas.length){ai.error='Responda brevemente la pregunta para preparar una propuesta.';render(true);return;}
 ai.busy=true;ai.error='';render(true);
 try{
  let data;
   if(!window.UNT_LOCAL_ASSISTANT)throw new Error('No se cargó el asistente de redacción local.');
   const requestPayload={
     objetivoDelCampo:ai.target.kind,descripcion:desc,contextoFuncion:refF?.description||'',
     contextoActividad:refA?.description||'',respuestas:[...ai.respuestasAnteriores,...answers],
     detalleNuevo:more,borradorActual:ai.propuestas[ai.selected]||null
   };
   data=window.UNT_LOCAL_ASSISTANT.generate(requestPayload);
  if(ai.preguntas.length)saveAiResponses();
  if(more){ai.respuestasAnteriores.push({pregunta:'Otra información que recordé',respuesta:more});ai.detalleNuevo='';}
  ai.propuestas=(data.propuestas||[]).map(cleanAiOption).filter(Boolean).slice(0,10);
  ai.preguntas=(data.preguntas||[]).filter(q=>typeof q==='string').slice(0,1);
  ai.respuestas={};ai.alertas=(data.alertas||[]).filter(q=>typeof q==='string').slice(0,5);ai.analisis=data.diagnostico||null;
  ai.selected=0;ai.attempts++;ai.stage=ai.preguntas.length?'aclarar':ai.propuestas.length?'revisar':'inicio';
  if(!ai.propuestas.length&&!ai.preguntas.length)ai.error='Añada una breve descripción para precisar este campo.';
 }catch(e){ai.error=e.name==='AbortError'?'El asistente tardó demasiado. Vuelve a intentarlo.':(e.message||'El asistente no está disponible.');ai.token='';}
 finally{ai.busy=false;render(true);}
}
function applyAiProposal(i){
 if(isLocked())return notice('El registro enviado no permite modificaciones.');
 syncAiDraft();const chosen=cleanAiOption(ai.propuestas[i]);if(!chosen)return notice('Primero obtenga una propuesta.');
 syncFunctionFields();const functions=state.submission.content.functions,t=ai.target,fn=functions[t.fi];if(!fn)return notice('No se encontró la función seleccionada.');
 let targetField='';
 if(t.kind==='function'){
  if(!chosen.funcion.trim())return notice('Revise la redacción de la función.');
  // Modifica solo la función solicitada: conserva intactas actividades y productos existentes.
  fn.description=U(chosen.funcion.trim());targetField=`fn_desc_${t.fi}`;
 }else if(t.kind==='activity'){
  if(!fn.description.trim())return notice('Registre primero la función.');
  const suggested=chosen.actividades.map(x=>x.actividad.trim()).filter(Boolean);
  if(!suggested.length)return notice('No se identificaron actividades concretas.');
  let current=fn.activities[t.ai],insertIndex=t.ai+1;
  if(current){current.description=U(suggested.shift());targetField=`act_${t.fi}_${t.ai}`;}
  const existing=new Set(fn.activities.map(x=>U(x.description.trim())).filter(Boolean));
  for(const txt of suggested){if(existing.has(U(txt)))continue;fn.activities.splice(insertIndex++,0,{id:ID(),description:U(txt),products:[emptyProduct()]});existing.add(U(txt));}
 }else{
  const act=fn.activities[t.ai];if(!act?.description.trim())return notice('Registre primero la actividad correspondiente.');
  const list=[...new Set((chosen.actividades||[]).flatMap(x=>x.productos||[]).map(x=>U(x.trim())).filter(Boolean))];
  if(!list.length)return notice('Especifique el resultado verificable de esta actividad.');
  const known=new Set(act.products.map(x=>U(x.name.trim())).filter(Boolean));
  let insertIndex=t.pi+1;
  if(act.products[t.pi]&&!act.products[t.pi].name.trim()&&list.length){act.products[t.pi].name=list.shift();known.add(act.products[t.pi].name)}
  for(const value of list){if(!known.has(value)){act.products.splice(insertIndex++,0,{...emptyProduct(),name:value});known.add(value)}}
  targetField=`prod_${t.fi}_${t.ai}_${t.pi}_name`;
 }
 delete aiSessions[aiTargetKey(t)];ai={description:'',respuestas:{},respuestasAnteriores:[],detalleNuevo:'',propuestas:[],preguntas:[],alertas:[],analisis:null,busy:false,error:'',token:'',attempts:0,selected:0,stage:'inicio',open:false,target:{kind:'function',fi:0,ai:0,pi:0}};
 render(true);notice('Propuesta incorporada. Puede revisarla o modificarla en su ficha.');
 const el=document.getElementById(targetField);el?.focus({preventScroll:true});el?.scrollIntoView({behavior:'smooth',block:'center'});
}
function applyAllAiFunctions(){
 if(isLocked())return notice('La ficha presentada no puede modificarse.');
 syncAiDraft();syncFunctionFields();
 const t=ai.target;
 if(t.kind!=='function')return;
 const fns=state.submission?.content?.functions;
 if(!fns?.[t.fi])return notice('No se encontró la función que desea completar.');
 const choices=ai.propuestas.map(cleanAiOption).filter(x=>x?.funcion?.trim());
 if(choices.length<2)return notice('Solo se identificó una propuesta.');
 // Cada propuesta se conserva como función editable. No se inventan actividades ni productos.
 const unique=[];const seen=new Set(fns.filter((_,i)=>i!==t.fi).map(x=>U(x.description.trim())).filter(Boolean));
 for(const option of choices){const name=U(option.funcion.trim());if(seen.has(name))continue;seen.add(name);unique.push(name)}
 if(!unique.length)return notice('Las funciones propuestas ya figuran en su ficha.');
 fns[t.fi].description=unique[0];let offset=1;
 for(const name of unique.slice(1)){const item=emptyFunction();item.description=name;fns.splice(t.fi+offset++,0,item)}
 delete aiSessions[aiTargetKey(t)];ai.open=false;
 render(true);scheduleCloudSave();
 notice(`Se incorporaron ${unique.length} funciones. Confirme que son responsabilidades distintas y complete actividades y productos.`);
}
function initAiWidget(){ /* Asistente local: no requiere servicios, CAPTCHA ni tokens. */ }

// Análisis de consistencia local, exclusivamente orientativo. No califica ni impide registrar.
const coherenceGroups={
 documentaria:/document|expedient|tram[it]|solicitud|archiv|sgd|ofici|memorand|correspondenc|mes[a]? de partes/i,
 academica:/alumn|estudiant|matricul|horari|aula|clase|asisten|curso|docente|escuela|acta de notas|plan de estudio/i,
 presupuestal:/presupuest|tesorer|pago|factur|viatic|contabil|recaud|cobranz|devengad/i,
 logistica:/inventari|almacen|patrimoni|adquisic|bien(es)?|stock|logistic|abastec/i,
 personal:/planill|personal|contrat|cas|servidor|vacacion|asistenc|legaj/i,
 mantenimiento:/mantenim|reparac|limpiez|jardin|instalacion|electric|equipo tecnic/i
};
const normalizeWork=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function topicsFor(t){const q=normalizeWork(t);return Object.keys(coherenceGroups).filter(k=>coherenceGroups[k].test(q));}
function workRoots(t){const stop=new Set(['para','con','por','las','los','del','una','unos','unas','que','como','segun','sobre','desde','hasta','entre','mediante','facultad','unidad','organizacion','correspondiente','respectivo','realizar','asegurar','garantizar','trabajo','labor','segun','atencion','gestion','gestionar','actividades','administrativas','administrativos']);return normalizeWork(t).split(/[^a-z0-9]+/).filter(x=>x.length>4&&!stop.has(x)).map(w=>w.slice(0,Math.min(5,w.length)));}
function weakMismatch(a,b){const ta=topicsFor(a),tb=topicsFor(b);if(!ta.length||!tb.length)return false;if(ta.some(k=>tb.includes(k)))return false;const roots=new Set(workRoots(a));if(workRoots(b).some(r=>roots.has(r)))return false;return true;}
// Advertencias de redacción, solo orientativas. Nunca bloquean el registro.
// Es una heurística local; las comprobaciones semánticas pertenecen al asistente IA.
function functionWritingAdvice(value){
 const text=normalizeWork(value);
 if(!text||text.length<10)return '';
 const first=text.match(/^[a-z]+/)?.[0]||'';
 const example='Ejemplo: «Gestionar la documentación administrativa de la facultad para contribuir a su atención oportuna».';
 if(!/(?:ar|er|ir)(?:se)?$/.test(first))
  return 'No se identifica un verbo en infinitivo al inicio. La estructura sugerida es VERBO EN INFINITIVO + OBJETO DE LA ACCIÓN + ATRIBUTO O FINALIDAD. '+example;
 const beforePurpose=text.split(/\b(?:para|a fin de|con la finalidad de|con el proposito de|conforme a|de acuerdo con|segun|mediante|en el marco de)\b/)[0];
 if(beforePurpose.split(/\s+/).filter(Boolean).length<4)
  return 'Conviene precisar qué se gestiona, coordina, organiza o realiza (objeto de la acción). '+example;
 if(!/\b(?:para|conforme a|segun|mediante|a fin de|de acuerdo con|con el proposito de|con la finalidad de|en el marco de|de manera|oportunamente|eficientemente|con criterios de|bajo criterios de|segun los|de acuerdo a)\b/.test(text))
  return 'Conviene precisar el atributo, alcance, condición o finalidad de esta responsabilidad. Estructura: VERBO EN INFINITIVO + OBJETO + ATRIBUTO. '+example;
 return '';
}
function adviceForField(el){const id=el?.id||'',value=el?.value?.trim()||'';if(!value||value.length<10)return '';
 if(/^fn_desc_\d+$/.test(id))return functionWritingAdvice(value);
 const a=id.match(/^act_(\d+)_(\d+)$/);if(a){const first=normalizeWork(value).match(/^[a-z]+/)?.[0]||'';
  if(!/(ar|er|ir)(se)?$/.test(first))return 'Revise la actividad: conviene formularla como una acción concreta iniciada con un verbo en infinitivo.';
  const fn=document.getElementById(`fn_desc_${a[1]}`)?.value?.trim()||'';
  if(!fn)return 'Registre la función para examinar la relación con esta actividad.';
  if(weakMismatch(fn,value))return 'Compruebe si esta actividad corresponde a la función registrada; la relación no resulta evidente en el texto.';
  return '';
 }
 const p=id.match(/^prod_(\d+)_(\d+)_(\d+)_name$/);if(p){const first=normalizeWork(value).match(/^[a-z]+/)?.[0]||'';
  if(/(ar|er|ir)(se)?$/.test(first))return 'Revise el producto: se espera un resultado o entregable verificable, no una acción.';
  const act=document.getElementById(`act_${p[1]}_${p[2]}`)?.value?.trim()||'';
  if(!act)return 'Registre la actividad vinculada antes de confirmar el producto.';
  if(weakMismatch(act,value))return 'Compruebe si el producto corresponde a la actividad descrita; la relación no resulta evidente en el texto.';
  return '';
 }
 return '';
}
function updateWritingAdvice(){if(state.nav!=='registro'||state.step!==1||state.role==='authority'||!state.submission)return;
 document.querySelectorAll('[data-writing-check]').forEach(box=>{const target=document.getElementById(box.dataset.writingCheck);if(!target)return;const advice=adviceForField(target);box.hidden=!advice;box.textContent=advice?('ⓘ '+advice):'';});
}
let adviceTimer=0;
function scheduleWritingAdvice(){clearTimeout(adviceTimer);adviceTimer=setTimeout(updateWritingAdvice,480);}
function functionCard(f,fi,locked){return `<section class="compound function-layer" data-fid="${esc(f.id)}"><div class="compound-top"><span class="idx"><span class="shape-icon">01</span> FUNCIÓN ${fi+1}</span>${!locked&&fi>0?`<button class="btn critical sm" data-action="delete-function" data-fi="${fi}">Eliminar función</button>`:''}</div>${textarea(`fn_desc_${fi}`,'DESCRIBA LA FUNCIÓN QUE DESEMPEÑA',f.description,{required:true,rows:5,hint:'Ejemplo: COORDINAR LA RECEPCIÓN Y DERIVACIÓN DE EXPEDIENTES PARA ASEGURAR LA ATENCIÓN DE LOS TRÁMITES.'})}${!locked?aiTrigger('function',fi):''}<div class="divider"></div><div class="flex space-between"><b style="font-size:14px">Actividades vinculadas a esta función</b>${!locked?`<button class="btn ghost sm" data-action="add-activity" data-fi="${fi}">+ Añadir actividad</button>`:''}</div>${f.activities.map((a,ai)=>activityCard(fi,ai,a,locked)).join('')}${textarea(`fn_note_${fi}`,'PRECISIONES DE LA FUNCIÓN (OPCIONAL)',f.notes,{rows:3,placeholder:'OTRAS PARTICULARIDADES DEL TRABAJO'})}</section>`;}
function activityCard(fi,ai,a,locked){return `<div class="activity-card activity-layer"><div class="flex space-between" style="margin-bottom:13px"><b style="font-size:12px;color:#2e698e">ACTIVIDAD ${fi+1}.${ai+1}</b>${!locked&&ai>0?`<button class="btn critical sm" data-action="delete-activity" data-fi="${fi}" data-ai="${ai}">Quitar actividad</button>`:''}</div>${textarea(`act_${fi}_${ai}`,'¿QUÉ ACCIONES RELACIONADAS REALIZA?',a.description,{rows:4,hint:'Ejemplo: REVISAR Y REGISTRAR SOLICITUDES RECIBIDAS DE LOS USUARIOS.'})}${!locked?aiTrigger('activity',fi,ai):''}<div class="flex space-between" style="margin-top:16px"><b class="tiny">Productos o entregables de esta actividad</b>${!locked?`<button class="btn ghost sm" data-action="add-product" data-fi="${fi}" data-ai="${ai}">+ Agregar producto</button>`:''}</div>${a.products.map((p,pi)=>productCard(fi,ai,pi,p,locked)).join('')}</div>`;}
function productCard(fi,ai,pi,p,locked){const pre=`prod_${fi}_${ai}_${pi}`;const mon=D.months.map(m=>`<button type="button" data-action="toggle-month" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}" data-month="${m}" class="monthchip ${(p.months||[]).includes(m)?'checked':''}">${m.slice(0,3)}</button>`).join('');return `<div class="prod-card product-layer"><div class="flex space-between" style="margin-bottom:12px"><span class="idx" style="font-size:11px">PRODUCTO ${fi+1}.${ai+1}.${pi+1}</span>${!locked&&pi>0?`<button class="btn critical sm" data-action="delete-product" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}">Eliminar</button>`:''}</div><div class="input-grid">${input(`${pre}_name`,'PRODUCTO O ENTREGABLE',p.name,'text',{required:true,full:true,placeholder:'EJ. EXPEDIENTES REGISTRADOS Y DERIVADOS'})}${input(`${pre}_indicator`,'INDICADOR O CRITERIO DE MEDICIÓN (SI CORRESPONDE)',p.indicator||'','text',{full:true,placeholder:'EJ. PORCENTAJE DE EXPEDIENTES ATENDIDOS OPORTUNAMENTE'})}${!locked?aiTrigger('product',fi,ai,pi):''}${select(`${pre}_frequency`,'PERIODICIDAD DE SU ELABORACIÓN',D.frequency,p.frequency)}${select(`${pre}_product_type`,'TIPO DE PRODUCTO',[{value:'',label:'SELECCIONE UNA OPCIÓN'},{value:'documento',label:'DOCUMENTO O EXPEDIENTE'},{value:'registro',label:'REGISTRO O BASE DE DATOS'},{value:'servicio',label:'SERVICIO O ATENCIÓN'},{value:'bien',label:'BIEN O ELEMENTO FÍSICO'},{value:'otro',label:'OTRO PRODUCTO VERIFICABLE'}],p.product_type||'')}${select(`${pre}_temporality`,'TEMPORALIDAD',[{value:'',label:'SELECCIONE UNA OPCIÓN'},{value:'permanente',label:'ACTIVIDAD PERMANENTE'},{value:'estacional',label:'ACTIVIDAD ESTACIONAL'},{value:'temporal',label:'ACTIVIDAD TEMPORAL / POR PROYECTO'}],p.temporality||'')}${select(`${pre}_execution_mode`,'MODALIDAD DE EJECUCIÓN',[{value:'',label:'SELECCIONE UNA OPCIÓN'},{value:'propio',label:'PERSONAL PROPIO DE LA UNIDAD'},{value:'apoyo',label:'APOYO DE OTRA UNIDAD'},{value:'externo',label:'SERVICIO EXTERNO / TERCERO'},{value:'mixto',label:'EJECUCIÓN MIXTA'}],p.execution_mode||'')}${input(`${pre}_unit`,'UNIDAD DE MEDIDA',p.unit,'text',{placeholder:'EJ. EXPEDIENTES/SEMANA'})}${input(`${pre}_normal`,'VOLUMEN HABITUAL (APROX.)',p.normal,'number',{hint:'Cantidad en la unidad indicada.'})}${input(`${pre}_peak`,'VOLUMEN EN PERIODO CRÍTICO (APROX.)',p.peak,'number',{hint:'Si no puede estimarlo, deje vacío.'})}</div><div style="margin:17px 0 8px"><label class="bold tiny">MESES O PERIODOS DE MAYOR DEMANDA</label><div class="chiplist" style="margin-top:9px">${mon}</div><div class="hint tiny muted" style="margin-top:8px">Seleccione los meses en que habitualmente aumenta la cantidad de trabajo. Si no aplica, no seleccione.</div></div>
<div class="grid three" style="margin-top:20px">${rangeWidget(pre,'intensity','INTENSIDAD DE TRABAJO',p.intensity,'1 = baja · 10 = muy alta')}${rangeWidget(pre,'complexity','DIFICULTAD / COMPLEJIDAD',p.complexity,'1 = sencilla · 10 = muy compleja')}${rangeWidget(pre,'priority','PRIORIDAD INSTITUCIONAL',p.priority,'1 = baja · 10 = crítica')}</div>
<div class="divider"></div><div class="input-grid">${select(`${pre}_origin`,'¿DÓNDE SE INICIA ESTE TRÁMITE O PROCESO?',[{value:'inicia',label:'SE INICIA EN MI UNIDAD DE ORGANIZACIÓN'},{value:'continua',label:'ES CONTINUIDAD DE OTRA UNIDAD DE ORGANIZACIÓN'},{value:'independiente',label:'NO CORRESPONDE A UN TRÁMITE ENCADENADO'}],p.origin)}${input(`${pre}_previous_unit`,'UNIDAD DE ORGANIZACIÓN DE ORIGEN (SI CORRESPONDE)',p.previous_unit,'text',{placeholder:'UNIDAD DE ORGANIZACIÓN REMITENTE'})}${input(`${pre}_next_unit`,'¿A QUÉ UNIDAD DE ORGANIZACIÓN SE REMITE O ENTREGA?',p.next_unit,'text',{placeholder:'UNIDAD DE ORGANIZACIÓN DESTINATARIA O USUARIO FINAL'})}${input(`${pre}_reason`,'¿QUÉ OCASIONA LOS INCREMENTOS DE TRABAJO?',p.reason,'text',{placeholder:'MATRÍCULA, CIERRE ACADÉMICO, PLAZOS...'})}</div>${textarea(`${pre}_notes`,'OBSERVACIONES DEL PRODUCTO (OPCIONAL)',p.notes,{rows:3})}</div>`;}
function rangeWidget(pre,key,label,value,description){return `<div class="field"><label>${label}</label><div class="range-row"><input type="range" min="1" max="10" step="1" name="${pre}_${key}" value="${Number(value)||5}" data-range-output="${pre}_${key}"/><output class="rangemark" id="out_${pre}_${key}">${Number(value)||5}/10</output></div><div class="scale-caption"><span>${description.split(' · ')[0]}</span><span>${description.split(' · ')[1]||''}</span></div></div>`;}
function observationsView(){return `<div class="card"><div class="section-head"><span class="section-mark">${'03'}</span><div><h3>Observaciones y condiciones de trabajo</h3><p class="muted tiny" style="margin:0">Indique únicamente información relacionada con el trabajo institucional. No incluya acusaciones personales ni datos sensibles de terceros.</p></div></div>${textarea('general_observations',state.role==='authority'?'OBSERVACIONES DE LA AUTORIDAD':'OBSERVACIONES DEL SERVIDOR',state.submission.content.observations,{rows:7,hint:'Puede informar obstáculos, duplicidades, limitaciones de sistemas, problemas de coordinación u oportunidades de mejora.'})}<div class="form-actions"><button class="btn ghost" data-action="prev-step">← Regresar</button><div class="btnrow"><button class="btn ghost" data-action="save-draft">Guardar avance de esta sesión</button><button class="btn primary" data-action="next-step">Revisar registro →</button></div></div></div>`;}
function authorityView(){const a=state.submission.content.authority;return `<div class="card"><div class="section-head"><span class="section-mark">02</span><div><h3>Necesidades funcionales de la unidad</h3><p class="muted tiny" style="margin:0">Para decanos, directores de escuela y directores de departamento. Describa las necesidades de su unidad.</p></div></div><div class="callout bluecall">Describa necesidades organizacionales, no calificaciones personales. Cada situación constituye un registro preliminar que la URH deberá contrastar técnicamente.</div>${authorityGroup('needs','Funciones necesarias no atendidas','Identifique responsabilidades o productos requeridos que no se realizan o se atienden insuficientemente.',['FUNCIÓN REQUERIDA','ACTIVIDADES Y PRODUCTOS ESPERADOS','FRECUENCIA Y PERIODO DE DEMANDA','¿POR QUÉ NO SE ATIENDE?'],a.needs)}${authorityGroup('revisions','Funciones o procedimientos que requieren revisión','Registre tareas duplicadas, procesos innecesarios o actividades que no corresponden a la unidad.',['FUNCIÓN O ACTIVIDAD','SITUACIÓN OBSERVADA','FRECUENCIA / ALCANCE','PROPUESTA DE MEJORA'],a.revisions)}${authorityGroup('outsourcing','Servicios externos o locaciones recurrentes','Distinga locación de servicios y tercerización. Registrar continuidad no presume irregularidad.',['SERVICIO O ACTIVIDAD CONTRATADA','ENTREGABLES','PERIODICIDAD Y CONTINUIDAD','JUSTIFICACIÓN / ALTERNATIVA'],a.outsourcing)}${authorityGroup('difficulties','Dificultades del funcionamiento administrativo','Describa problemas verificables, frecuencia e impacto, sin atribuir culpas personales.',['DIFICULTAD OPERATIVA','PROCESO AFECTADO','FRECUENCIA E IMPACTO','MEDIDA PROPUESTA'],a.difficulties)}<div class="field" style="margin-top:18px"><label><input type="checkbox" id="no_needs_confirmed" ${a.no_needs_confirmed?'checked':''} style="width:auto;min-height:auto;margin-right:9px">Declaro que, a la fecha, no identifico necesidades o dificultades adicionales que registrar (marcar solo si no se consignan casos).</label></div><div class="form-actions"><button class="btn ghost" data-action="prev-step">← Regresar</button><div class="btnrow"><button class="btn ghost" data-action="save-draft">Guardar avance de esta sesión</button><button class="btn primary" data-action="next-step">Continuar →</button></div></div></div>`;}
function authorityGroup(key,title,desc,labels,items){return `<section class="compound" style="background:#fff"><div class="flex space-between" style="margin-bottom:7px"><h3 style="font-size:17px;margin:0">${title}</h3><button class="btn ghost sm" data-action="add-need" data-need="${key}">+ Añadir registro</button></div><p class="subtle">${desc}</p>${!items.length?`<div class="empty" style="padding:20px">Sin registros en este apartado. Solo añada los casos que considere pertinentes.</div>`:''}${items.map((it,i)=>`<div class="activity-card activity-layer"><div class="flex space-between"><b class="tiny">REGISTRO ${i+1}</b><button class="btn critical sm" data-action="delete-need" data-need="${key}" data-idx="${i}">Eliminar</button></div><div class="input-grid" style="margin-top:12px">${labels.map((lb,k)=>`<div class="field ${k===0||k===1?'full':''}"><label>${lb}</label><textarea class="upper" rows="2" name="need_${key}_${i}_${k}">${esc(it[k]||'')}</textarea></div>`).join('')}</div></div>`).join('')}</section>`;}
function reviewView(){const s=state.submission, f=s.content.functions, products=f.flatMap(fn=>fn.activities.flatMap(a=>a.products));const canSend=!isLocked();return `<div class="card"><div class="section-head"><span class="section-mark">✓</span><div><h3>Revisión y envío del registro</h3><p class="muted tiny" style="margin:0">Verifique la información antes de presentarla.</p></div></div>${state.role==='authority'?`<div class="grid four">${[['needs','NECESIDADES'],['revisions','REVISIÓN DE PROCEDIMIENTOS'],['outsourcing','SERVICIOS EXTERNOS'],['difficulties','DIFICULTADES']].map(([key,label])=>`<div class="kpi"><div class="label">${label}</div><div class="value">${s.content.authority[key].length}</div></div>`).join('')}</div>`:`<div class="grid three"><div class="kpi"><div class="label">FUNCIONES REGISTRADAS</div><div class="value">${f.length}</div></div><div class="kpi"><div class="label">ACTIVIDADES REGISTRADAS</div><div class="value">${f.reduce((n,x)=>n+x.activities.length,0)}</div></div><div class="kpi"><div class="label">PRODUCTOS REGISTRADOS</div><div class="value">${products.length}</div></div></div>`}<div class="spacer"></div><div class="inline-help"><b>Registro responsable.</b> Confirmo que la información consignada corresponde al trabajo que efectivamente realizo, de acuerdo con mi conocimiento y experiencia. Su presentación no reemplaza la verificación de la URH ni la fijación de metas del GDR.</div><div class="spacer"></div>${(state.role==='authority'?[]:f).map((fn,i)=>`<div class="data-row"><div><small>FUNCIÓN ${i+1}</small><b>${esc(fn.description||'SIN REDACTAR')}</b><small>${fn.activities.length} actividad(es) · ${fn.activities.reduce((n,a)=>n+a.products.length,0)} producto(s)</small></div></div>`).join('')}<div class="divider"></div><div class="flex space-between"><span>${statusBadge(s.status)}</span><span class="tiny muted">Última actualización: ${niceDate(s.updated_at)}</span></div>${!demo?`<p class="tiny muted">El borrador se guarda en Supabase y puede continuar desde esta sesión de navegador. La URH comprobará posteriormente la información declarada.</p>`:''}<div class="form-actions"><button class="btn ghost" data-action="prev-step">← Corregir</button><div class="btnrow"><button class="btn ghost" data-action="save-draft">Guardar</button>${canSend?`<button class="btn primary" data-action="submit-declaration">${state.role==='authority'?'Enviar necesidades directamente a URH':state.role==='faculty_admin'?'Presentar mi ficha funcional':'Presentar mi ficha para conformidad documental'} →</button>`:''}</div></div></div>`;}
function isLocked(){return ['submitted','validated','forwarded'].includes(state.submission?.status)}
function ownSummary(){const s=state.submission;return shell(`${pageTitle('ESTADO DE SU REGISTRO','Estado de recepción','La URH recibe digitalmente la declaración. Las fichas del personal se corroboran con la conformidad documental firmada.')}<div class="card"><div class="status-card"><span style="font-size:27px">▤</span><div><h3>${state.role==='authority'&&s?.status==='submitted'?'RECIBIDO DIRECTAMENTE EN URH':statuses[s?.status||'draft'][0]}</h3><p class="muted" style="margin:0">${s?.status==='forwarded'?'El expediente digital fue remitido a la URH.':s?.status==='validated'?'La URH verificó la conformidad documental de su registro.':s?.status==='submitted'?state.role==='authority'?'La URH recibió directamente su declaración de necesidades.':state.role==='faculty_admin'?'La URH recibió su ficha. Descargue el Word para conformidad documental.':'La URH recibió su ficha. Imprima el Word y solicite la firma del administrador de facultad.':s?.status==='changes_requested'?'La URH indicó que se necesitan precisiones. Coordine con su facultad.':'Su registro aún está en elaboración.'}</p></div></div><div class="spacer"></div><div class="grid three"><div class="kpi"><div class="label">${state.role==='authority'?'NECESIDADES':'FUNCIONES'}</div><div class="value">${state.role==='authority'?(s?.content?.authority?.needs?.length||0):s?.content?.functions?.length||0}</div></div><div class="kpi"><div class="label">FACULTAD</div><div class="value" style="font-size:19px">${esc(facultyName(state.profile.faculty_id))}</div></div><div class="kpi"><div class="label">ACTUALIZADO</div><div class="value" style="font-size:20px">${niceDate(s?.updated_at||Date.now())}</div></div></div>${state.receipt?`<div class="callout bluecall"><b>Código de recepción:</b> ${esc(state.receipt)}</div>`:''}${s?.review_note?`<div class="callout redcall" style="margin-top:20px"><b>Observación recibida:</b> ${esc(s.review_note)}</div>`:''}<div class="form-actions right"><button class="btn ghost" data-nav="registro">${isLocked()?'Ver mi registro':'Continuar registro'} →</button>${['submitted','validated','forwarded'].includes(s?.status)?`<button class="btn primary" data-action="download-personal-word">${state.role==='authority'?'↓ Descargar informe de necesidades (Word)':'↓ Descargar oficio para el Decanato (Word)'}</button>`:''}<button class="btn ghost" data-action="logout">Finalizar y salir</button></div></div>`,'Revisión y envío');}
const roleCanReview=(r)=>state.role==='urh_admin';
function ownRecordList(){return state.records.filter(r=>r.faculty_id===state.selectedFaculty&&['staff','authority'].includes(r.role))}
function facultyReviewerView(){
 const rows=state.facReviewRows||[],checked=rows.filter(x=>x.faculty_checked===true).length,all=rows.length>0&&checked===rows.length;
 const who=`<div class="field"><label for="faculty_reviewer_name">NOMBRE DEL ADMINISTRADOR QUE REVISA</label><input id="faculty_reviewer_name" class="upper" value="${esc(state.facReviewName)}" placeholder="APELLIDOS Y NOMBRES" autocomplete="off"><span class="hint">Se consigna como responsable de las revisiones y precisiones realizadas.</span></div>`;
 const items=rows.map(r=>{
  const f=(r.content?.functions||[]),id=esc(r.id),checked=!!r.faculty_checked;
  return `<details class="faculty-review-item" data-faculty-record="${id}"><summary><span><b>${esc(r.owner_name||'SERVIDOR')}</b><br><small>${esc(r.job_title||'PUESTO SIN INDICAR')} · ${esc(r.org_unit||'')} · ${esc(r.receipt_code||'')}</small></span><span class="${checked?'faculty-check-ok':'faculty-check-pending'}">${checked?'✓ REVISADO':'PENDIENTE DE REVISIÓN'}</span></summary><div class="faculty-review-body"><div class="tiny muted">Código de trabajador: ${esc(r.worker_code)} · Versión ${Number(r.revision_no)||1}</div><form id="faculty_edit_${id}" data-id="${id}" class="faculty-edit-form stack">
   ${f.map((fn,fi)=>`<div class="compound"><div class="flex space-between"><b>FUNCIÓN ${fi+1}</b><button type="button" class="btn ghost sm" data-action="faculty-add-activity" data-id="${id}" data-fi="${fi}">+ Actividad</button></div><label class="faculty-review-label">DESCRIPCIÓN DE LA FUNCIÓN<textarea rows="3" data-rfield="function" data-fi="${fi}">${esc(fn.description||'')}</textarea></label><label class="faculty-review-label">PRECISIONES<textarea rows="2" data-rfield="fnnotes" data-fi="${fi}">${esc(fn.notes||'')}</textarea></label>${(fn.activities||[]).map((act,ai)=>`<div class="faculty-edit-activity"><div class="flex space-between"><b>Actividad ${fi+1}.${ai+1}</b><button type="button" class="btn ghost sm" data-action="faculty-add-product" data-id="${id}" data-fi="${fi}" data-ai="${ai}">+ Producto</button></div><label class="faculty-review-label">ACTIVIDAD<textarea rows="2" data-rfield="activity" data-fi="${fi}" data-ai="${ai}">${esc(act.description||'')}</textarea></label>${(act.products||[]).map((pr,pi)=>`<div class="faculty-edit-product"><b>Producto ${fi+1}.${ai+1}.${pi+1}</b><label class="faculty-review-label">PRODUCTO O ENTREGABLE<input data-rfield="prodname" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}" value="${esc(pr.name||'')}"></label><label class="faculty-review-label">INDICADOR DE MEDICIÓN<input data-rfield="indicator" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}" value="${esc(pr.indicator||'')}" placeholder="Si corresponde"></label><div class="grid two"><label class="faculty-review-label">FRECUENCIA<input data-rfield="frequency" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}" value="${esc(pr.frequency||'')}"></label><label class="faculty-review-label">UNIDAD DE MEDIDA<input data-rfield="unit" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}" value="${esc(pr.unit||'')}"></label><label class="faculty-review-label">VOLUMEN HABITUAL<input data-rfield="normal" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}" value="${esc(pr.normal||'')}"></label><label class="faculty-review-label">VOLUMEN CRÍTICO<input data-rfield="peak" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}" value="${esc(pr.peak||'')}"></label></div><label class="faculty-review-label">PRECISIONES DEL PRODUCTO<textarea data-rfield="prodnotes" data-fi="${fi}" data-ai="${ai}" data-pi="${pi}">${esc(pr.notes||'')}</textarea></label></div>`).join('')}</div>`).join('')}</div>`).join('')}
   <button type="button" class="btn ghost sm" data-action="faculty-add-function" data-id="${id}">+ Añadir función al registro</button>
   <label class="faculty-review-label">MOTIVO DE LOS CAMBIOS (SOLO SI CORRIGE)<textarea rows="2" name="revision_reason" placeholder="Explique qué cambió y por qué, para que la URH lo verifique."></textarea></label>
   <div class="faculty-review-actions"><button type="button" class="btn ghost" data-action="faculty-save" data-id="${id}">Guardar correcciones</button><button type="button" class="btn ${checked?'ghost':'primary'}" data-action="faculty-mark" data-id="${id}" data-checked="${checked?'false':'true'}">${checked?'Desmarcar revisión':'✓ Marcar ficha revisada'}</button><button type="button" class="btn ghost" data-action="faculty-word" data-id="${id}">↓ Word individual</button></div></form></div></details>`;
 }).join('');
 return shell(`${pageTitle('ADMINISTRACIÓN DE FACULTAD','Revisión de declaraciones','Seleccione cada servidor, revise su contenido y marque la ficha cuando esté conforme. Los cambios se registran para su verificación posterior en la URH.')}<div class="card"><div class="section-head"><span class="section-mark">✓</span><div><h3>Personal que presentó su declaración</h3><p class="muted tiny">Únicamente se muestran las fichas de esta facultad. Las declaraciones de decanos y directores llegan directamente a la URH.</p></div></div><div class="faculty-review-summary"><b>${checked} de ${rows.length} fichas revisadas</b><button class="btn ghost sm" data-action="faculty-refresh">↻ Actualizar relación</button></div>${who}<div class="callout bluecall">La revisión de las fichas no certifica las funciones informadas. Imprima el oficio con el detalle declarado, para firma del Decanato y remisión a la DGA.</div>${items||'<div class="empty">No hay fichas presentadas pendientes de revisión en esta facultad.</div>'}<div class="divider"></div><button class="btn primary" data-action="faculty-all-word" ${all?'':'disabled'}>↓ Generar oficio con funciones declaradas (Word)</button><p class="hint">El oficio dirigido a la Dirección General de Administración se habilita cuando todas las fichas de la relación están marcadas.</p></div>`,'Revisión de la facultad');
}
function conformityView(){
 if(demo||state.facReviewToken)return facultyReviewerView();
 return shell(`${pageTitle('ADMINISTRACIÓN DE FACULTAD','Conformidad documental','Revise las declaraciones presentadas por el personal de su facultad.')}<div class="card"><div class="section-head"><span class="section-mark">✓</span><div><h3>Relación de fichas del personal</h3></div></div><p>Para proteger los datos de los servidores en computadoras compartidas, la relación nominal de fichas no puede mostrarse en un enlace público. La URH proporciona al administrador designado un enlace directo y revocable para consultar solo su facultad.</p><div class="callout bluecall"><b>Alternativa documental:</b> puede revisar la ficha Word que presenta cada trabajador y firmarla. Las autoridades registran sus necesidades directamente ante la URH.</div></div>`,'Conformidad documental');
}
function facultyReviewInputContent(id){
 const r=state.facReviewRows.find(x=>x.id===id);if(!r)return null;
 const form=document.getElementById('faculty_edit_'+id);if(!form)return null;
 const result=JSON.parse(JSON.stringify(r.content||{}));
 for(const el of form.querySelectorAll('[data-rfield]')){
  const fi=Number(el.dataset.fi),ai=Number(el.dataset.ai),pi=Number(el.dataset.pi),type=el.dataset.rfield;
  const fn=result.functions?.[fi],act=fn?.activities?.[ai],prod=act?.products?.[pi];
  if(type==='function'&&fn)fn.description=U(el.value.trim());
  if(type==='fnnotes'&&fn)fn.notes=U(el.value.trim());
  if(type==='activity'&&act)act.description=U(el.value.trim());
  const fields={prodname:'name',indicator:'indicator',frequency:'frequency',unit:'unit',normal:'normal',peak:'peak',prodnotes:'notes'};
  if(prod&&fields[type])prod[fields[type]]=U(el.value.trim());
 }
 return result;
}
function facultyReviewerName(){const el=document.getElementById('faculty_reviewer_name');if(el)state.facReviewName=U(el.value.trim());return state.facReviewName;}
async function facultyReviewApi(action,body={}){
 if(demo)return {ok:true};
 if(!state.facReviewToken||!configured)throw new Error('La facultad debe abrir su enlace institucional de revisión');
 const response=await fetch(CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/unt-faculty-review',{
  method:'POST',headers:{'Content-Type':'application/json','apikey':CFG.supabaseAnonKey},
  body:JSON.stringify({action,faculty_id:state.selectedFaculty,review_token:state.facReviewToken,...body})});
 const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.error||'No se pudo completar la revisión');return data;
}
async function loadFacultyReview(){
 if(demo){state.facReviewRows=demoRecords().filter(r=>r.faculty_id===state.selectedFaculty&&r.role==='staff'&&r.status==='submitted').map(r=>({...r,receipt_code:r.receipt_code||'DEMO-'+r.id,revision_no:r.revision_no||1,faculty_checked:!!r.faculty_checked}));return}
 const result=await facultyReviewApi('list');state.facReviewRows=result.records||[];
}
async function performFacultyReview(action,id,checked=false){
 try{
  const reviewer=facultyReviewerName(),r=state.facReviewRows.find(x=>x.id===id);
  if(!r)return;if(reviewer.length<5)return notice('Indique los nombres del administrador que revisa.');
  if(action==='mark'&&(r._hasLocalAdds||JSON.stringify(facultyReviewInputContent(id))!==JSON.stringify(r.content)))return notice('Guarde primero las correcciones pendientes antes de marcar la ficha.');
  if(action==='save'){
   const content=facultyReviewInputContent(id),reason=document.querySelector(`#faculty_edit_${id} [name=revision_reason]`)?.value.trim()||'';
   if(JSON.stringify(content)===JSON.stringify(r.content)&&!r._hasLocalAdds)return notice('No se encontraron modificaciones por guardar.');
   if(reason.length<8)return notice('Describa el motivo de la corrección (mínimo ocho caracteres).');
   if(demo){r.content=content;r.revision_no=Number(r.revision_no)+1;r.faculty_checked=false;r.faculty_note=reason;r._hasLocalAdds=false;demoReviewState.set(id,{content:r.content,revision_no:r.revision_no,checked:false});}
   else await facultyReviewApi('save',{record_id:id,revision_no:r.revision_no,reviewer_name:reviewer,content,reason});
   notice('Correcciones registradas y sujetas a verificación por URH.');
  }else{
   if(demo){r.faculty_checked=checked;demoReviewState.set(id,{content:r.content,revision_no:r.revision_no,checked});}
   else await facultyReviewApi('mark',{record_id:id,revision_no:r.revision_no,reviewer_name:reviewer,checked});
   notice(checked?'Ficha marcada como revisada.':'Se retiró la marca de revisión.');
  }
  if(!demo)await loadFacultyReview();render(true);
 }catch(e){notice('No se pudo registrar: '+e.message)}
}
function facultyAddItem(id,action,fi=0,ai=0){
 const reviewer=facultyReviewerName(),r=state.facReviewRows.find(x=>x.id===id);if(!r)return;
 // Cambios nuevos permanecen en la pantalla hasta pulsar Guardar correcciones.
 const content=facultyReviewInputContent(id);if(!content)return;
 if(action==='faculty-add-function')content.functions.push(emptyFunction());
 if(action==='faculty-add-activity')content.functions[fi]?.activities.push({id:ID(),description:'',products:[emptyProduct()]});
 if(action==='faculty-add-product')content.functions[fi]?.activities[ai]?.products.push(emptyProduct());
 r.content=content;r._hasLocalAdds=true;r.faculty_checked=false;state.facReviewName=reviewer;render(true);
 notice('Campo añadido. Guarde las correcciones con una explicación para conservarlas en Supabase.');
}
// V19.3.2: el Word reproduce SOLAMENTE la última versión guardada en Supabase.
// No se exportan modificaciones que el administrador aún no ha registrado.
function facultyHasUnsavedChanges(r){
 const edited=facultyReviewInputContent(r.id);
 return r._hasLocalAdds===true||(edited!==null&&JSON.stringify(edited)!==JSON.stringify(r.content));
}
function facultyWord(id){const r=state.facReviewRows.find(x=>x.id===id);if(!r)return;
 if(facultyHasUnsavedChanges(r))return notice('Primero guarde las modificaciones de esta ficha. El Word debe coincidir con la información registrada.');
 try{downloadBlob(window.UNT_DOCX.buildFicha({faculty:facultyName(state.selectedFaculty),profile:{last_names:r.owner_name,first_names:'',worker_code:r.worker_code,job_title:r.job_title,org_unit:r.org_unit},content:r.content,receipt:r.receipt_code,role:'staff'}),'UNT_OFICIO_AL_DECANATO_'+String(r.worker_code||'').replace(/[^A-Za-z0-9_-]/g,'_')+'.docx');}
 catch(e){notice('No se pudo generar el Word: '+e.message)}
}
async function facultyFinalWord(){
 const reviewer=facultyReviewerName();
 if(reviewer.length<5)return notice('Indique el nombre del administrador que revisó las fichas.');
 if((state.facReviewRows||[]).some(facultyHasUnsavedChanges))return notice('Primero guarde todas las correcciones antes de generar el oficio.');
 try{
  // Evita generar un oficio con marcas antiguas de otra pestaña o navegador.
  if(!demo)await loadFacultyReview();
  const rows=state.facReviewRows||[];
  if(!rows.length)return notice('No existen fichas presentadas para generar el oficio.');
  if(rows.some(r=>r.faculty_checked!==true))return notice('Hay fichas que todavía no han sido revisadas. Actualice su relación.');
  downloadBlob(window.UNT_DOCX.buildOficioFacultad({faculty:facultyName(state.selectedFaculty),administrator:reviewer,records:rows,date:new Date().toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Lima'})}),'UNT_OFICIO_FUNCIONES_DECLARADAS_'+state.selectedFaculty+'.docx');
  notice('Oficio generado a partir de las fichas y revisiones actualizadas.');
 }catch(e){notice('No se pudo actualizar la relación o generar el Word: '+e.message)}
}
async function issueFacultyReviewLink(revoke=false){
 if(state.role!=='urh_admin'||!state.session)return;
 const faculty=document.getElementById('faculty_link_target')?.value||state.filterFaculty;state.filterFaculty=faculty;
 try{const response=await facultyApi(revoke?'revoke-link':'issue-link',{faculty_id:faculty});state.issuedFacultyLink=revoke?'':location.origin+location.pathname+'#faculty='+encodeURIComponent(faculty)+'&review_token='+encodeURIComponent(response.review_token);render(true);notice(revoke?'Enlace de revisión revocado.':'Enlace creado. Entréguelo únicamente al administrador designado.');}
 catch(e){notice('No se pudo gestionar el enlace: '+e.message)}
}

// Indicadores exclusivamente agregados: los borradores no se exponen a los revisores de facultad.
function urhProgressBlock(){
 const rows=demo?D.faculties.map(f=>{const r=seededRecords().filter(x=>x.faculty_id===f.id);return {faculty_id:f.id,roster_expected:null,drafts:2,submitted:r.filter(x=>x.status==='submitted'&&x.role==='staff').length,faculty_reviewed:0,urh_validated:r.filter(x=>x.status==='validated').length,forwarded:0,authorities:r.filter(x=>x.role==='authority').length}}):state.progress||[];
 const total=k=>rows.reduce((n,r)=>n+(Number(r[k])||0),0);
 const data=rows.map(r=>{const name=facultyName(r.faculty_id);const exp=Number(r.roster_expected)||0,done=(Number(r.urh_validated)||0)+(Number(r.forwarded)||0),presented=Number(r.submitted)||0;return `<tr><td><b>${esc(name)}</b></td><td class="number">${exp?exp:'—'}</td><td class="number">${Number(r.drafts)||0}</td><td class="number">${presented}</td><td class="number">${Number(r.faculty_reviewed)||0}</td><td class="number">${Number(r.urh_validated)||0}</td><td class="number">${Number(r.forwarded)||0}</td><td class="number">${Number(r.authorities)||0}</td><td>${exp?'<span class="pill neutral">'+Math.min(100,Math.round(100*done/exp))+' %</span>':'<span class="tiny muted">Sin padrón</span>'}</td></tr>`}).join('');
 return `<div class="card urh-progress" style="margin-top:18px"><div class="section-head"><span class="section-mark">◈</span><div><h3>Consolidación y cobertura por facultad</h3><p class="muted tiny">Conteos agregados; las fichas en borrador no se muestran individualmente. La cobertura porcentual necesita el padrón oficial.</p></div></div>
 <div class="grid four" style="margin:12px 0 17px"><div class="kpi"><div class="label">BORRADORES ACTIVOS*</div><div class="value">${total('drafts')}</div></div><div class="kpi"><div class="label">FICHAS PRESENTADAS</div><div class="value">${total('submitted')}</div></div><div class="kpi"><div class="label">REVISADAS EN FACULTAD</div><div class="value">${total('faculty_reviewed')}</div></div><div class="kpi"><div class="label">VALIDADAS EN URH</div><div class="value">${total('urh_validated')+total('forwarded')}</div></div></div>
 ${state.progressError&&!demo?`<div class="callout redcall">El seguimiento agregado aún no está disponible: ${esc(state.progressError)}. Instale la migración V19.3.0.</div>`:''}
 <div class="table-scroll"><table class="table progress-table"><thead><tr><th>Facultad</th><th>Meta padrón</th><th>Borradores*</th><th>Presentadas</th><th>Revisadas</th><th>Validadas</th><th>Remitidas</th><th>Autoridades</th><th>Cobertura</th></tr></thead><tbody>${data}</tbody></table></div>
 <p class="tiny muted" style="margin-top:12px">* Códigos de trabajador con un borrador no presentado; son cifras de actividad, no identidades verificadas. La misma persona puede haber abierto distintas sesiones. La aprobación definitiva requiere oficio SGDUNT y cotejo URH.</p></div>`;
}
function dashboard(){const records=state.records,validated=records.filter(r=>r.status==='validated').length,forwarded=records.filter(r=>r.status==='forwarded').length,staff=records.filter(x=>x.role==='staff').length,authorities=records.filter(x=>x.role==='authority').length,covered=new Set(records.map(x=>x.faculty_id)).size;return shell(`${pageTitle('CONTROL INSTITUCIONAL','Panel de recepción de las facultades','Consulte todos los registros recibidos, incluidos los de decanos y directores enviados directamente a la URH, y contraste las conformidades impresas.', '<div class="btnrow"><button class="btn ghost" data-action="refresh-urh">↻ Actualizar registros</button><button class="btn primary" data-action="export-excel">↓ Exportar a Excel</button><button class="btn ghost" data-action="export-csv">CSV</button></div>')}<div class="grid four"><div class="kpi"><div class="label">FACULTADES CON REGISTROS</div><div class="value">${covered} / 13</div></div><div class="kpi"><div class="label">REGISTROS VALIDADOS Y REMITIDOS</div><div class="value">${validated+forwarded}</div></div><div class="kpi"><div class="label">PERSONAL ADMINISTRATIVO</div><div class="value">${staff}</div></div><div class="kpi"><div class="label">DECANOS Y DIRECTORES</div><div class="value">${authorities}</div></div></div>${urhProgressBlock()}<div class="card" style="margin-top:18px"><h3>Revisión de personal por facultad</h3><p class="muted tiny">Emita un enlace único y revocable para el administrador de cada facultad. Abre directamente la lista de su facultad; no requiere contraseñas ni códigos enviados por correo. Solo debe entregarse a la persona designada.</p><div class="input-grid">${select('faculty_link_target','FACULTAD',D.faculties.map(x=>({value:x.id,label:x.name.toUpperCase()})),state.filterFaculty)}</div><div class="form-actions"><button class="btn primary" data-action="issue-faculty-link">Generar nuevo enlace de revisión</button><button class="btn ghost" data-action="revoke-faculty-link">Revocar enlace vigente</button></div>${state.issuedFacultyLink?`<div class="callout bluecall"><b>Enlace nuevo (se muestra solo ahora)</b><textarea readonly rows="3" id="issued_faculty_link">${esc(state.issuedFacultyLink)}</textarea><button class="btn ghost sm" data-action="copy-faculty-link">Copiar enlace</button><p class="hint">No publique el enlace en GitHub ni lo envíe a personas no autorizadas.</p></div>`:''}</div><div class="callout bluecall" style="margin-top:18px"><b>Seguimiento:</b> ${validated} ficha(s) validada(s) pendientes de remisión formal · ${forwarded} ficha(s) formalmente remitida(s). La bandeja se actualiza automáticamente cada minuto o al pulsar «Actualizar registros».</div><div class="spacer"></div><div class="grid two"><div class="card"><h3>Fichas validadas por facultad</h3><div class="metric-list">${D.faculties.map(f=>{const count=records.filter(x=>x.faculty_id===f.id).length;return `<div class="metric"><div class="metric-top"><b>${esc(f.name)}</b><strong>${count}</strong></div><div class="mini-bar"><span style="width:${records.length?100*count/records.length:0}%"></span></div></div>`}).join('')}</div></div><div class="card"><h3>Gestión de la información</h3><div class="stack" style="margin-top:20px"><div class="outcome"><b>1 · Personal administrativo</b><p class="subtle" style="margin:0">Completa sus funciones, actividades y productos.</p></div><div class="outcome"><b>2 · Decanos y directores</b><p class="subtle" style="margin:0">Informa necesidades y oportunidades de mejora.</p></div><div class="outcome"><b>3 · Unidad de Recursos Humanos</b><p class="subtle" style="margin:0">Consulta progresivamente los registros validados, y verifica la remisión formal de cada facultad.</p></div></div><div class="callout bluecall" style="margin-top:20px">La URH recibe digitalmente las fichas presentadas. Para las fichas del personal y de administradores verifica el Word firmado y registra la conformidad; las autoridades remiten sus necesidades directamente a la URH.</div></div></div>`,'Panel institucional');}
function recordsView(){return shell(`${pageTitle('URH · CONSULTA','Registros recibidos','Todas las fichas presentadas llegan directamente a la URH. La validación de las fichas del personal requiere conformidad física firmada por Administración de Facultad.')}<div class="card"><div class="table-scroll"><table class="datatable"><thead><tr><th>Persona</th><th>Facultad</th><th>Tipo</th><th>Puesto</th><th>Funciones</th><th>Revisión de facultad</th><th>Estado URH</th><th>Fecha</th><th>Detalle</th></tr></thead><tbody>${state.records.map(r=>`<tr><td>${esc(r.owner_name||'USUARIO')}</td><td>${esc(facultyName(r.faculty_id))}</td><td>${esc(r.role==='authority'?'Autoridad':'Personal administrativo')}</td><td>${esc(r.job_title||'—')}</td><td>${r.content?.functions?.length||0}</td><td>${r.role==='authority'?'Directo a URH':r.faculty_checked?'✓ Revisada':'Pendiente'}</td><td>${statusBadge(r.status,r.role)}</td><td>${niceDate(r.updated_at||r.created_at)}</td><td><button class="btn ghost sm" data-action="open-record" data-id="${esc(r.id)}">Consultar</button></td></tr>`).join('')}</tbody></table></div>${state.records.length?'':'<div class="empty">Todavía no se han recibido registros.</div>'}</div>`,'Registros recibidos');}
function metricsFor(f){const staff=demo?f.staff:state.metrics.find(m=>m.faculty_id===f.id)?.staff_fte;const m=state.metrics.find(x=>x.faculty_id===f.id)||{};let products=state.records.filter(r=>r.faculty_id===f.id).flatMap(r=>r.content.functions).flatMap(fn=>fn.activities).flatMap(a=>a.products);const volumeNorm=products.filter(p=>+p.normal>0).reduce((n,p)=>n+Number(p.normal),0), volumePeak=products.filter(p=>+p.peak>0).reduce((n,p)=>n+Number(p.peak),0);
return {sper:m.students&&staff?m.students/staff:null,per1000:m.students&&staff?1000*staff/m.students:null,school:m.schools&&m.school_staff_fte?m.school_staff_fte/m.schools:null,shared:m.units_served&&m.support_fte?m.units_served/m.support_fte:null,products:null,season:(products.length===1&&volumeNorm&&volumePeak)?100*(volumePeak/volumeNorm-1):null,capacity:m.required_hours&&m.available_hours?m.required_hours/m.available_hours*100:null,backlog:m.deadline_due&&m.overdue!=null?m.overdue/m.deadline_due*100:null,gaps:m.functions_required&&m.functions_uncovered!=null?100*m.functions_uncovered/m.functions_required:null,aligned:m.checked_cases&&m.aligned_cases!=null?100*m.aligned_cases/m.checked_cases:null,external:m.external_recurring??null,cost:m.homogeneous_products&&m.attributable_cost!=null?m.attributable_cost/m.homogeneous_products:null};}
function indicatorView(){const f=D.faculties.find(x=>x.id===state.filterFaculty)||D.faculties[0], nums=metricsFor(f), m=state.metrics.find(x=>x.faculty_id===f.id)||{};return shell(`${pageTitle('ANALÍTICA DE LA URH','Indicadores de capacidad y demanda','Doce indicadores metodológicos. Los valores ausentes no se estiman ni sustituyen con datos inventados.')}<div class="card"><div class="flex space-between"><h3>Unidad de análisis</h3><span class="pill warning">${demo?'EJEMPLO SIN MATRÍCULA':'FUENTES INSTITUCIONALES'}</span></div><div style="max-width:520px;margin-top:17px">${select('filter_faculty','FACULTAD',D.faculties.map(x=>({value:x.id,label:x.name.toUpperCase()})),f.id)}</div><div class="callout bluecall" style="margin-top:17px">Los ratios requieren matrícula del mismo periodo, personal ETC y clasificación homogénea de servicios. Las cifras del padrón referencial no permiten inferir sobredotación o déficit de personal.</div></div><div class="spacer"></div><div class="grid three">${D.ratios.map((v,i)=>`<div class="kpi"><div class="label">${('0'+(i+1)).slice(-2)} · ${esc(v.title)}</div><div class="value">${fmt(nums[v.key])}${nums[v.key]!=null?` <span style="font-size:12px;font-weight:600">${esc(v.unit)}</span>`:''}</div><div class="hint">${esc(v.desc)}</div></div>`).join('')}</div><div class="spacer"></div>${metricForm(m,f)}`,'Indicadores');}
function metricForm(m,f){return `<div class="card"><div class="flex space-between"><div><h3>Fuentes complementarias</h3><p class="subtle">La URH registra datos de referencia para el cálculo de indicadores. Valores no disponibles: dejar vacíos.</p></div><span class="pill">${esc(f.name)}</span></div><form id="metricForm"><div class="input-grid">${[
 ['students','Estudiantes matriculados'],['staff_fte','Administrativos ETC (equivalente a tiempo completo)'],['schools','N.° de escuelas profesionales'],['school_staff_fte','ETC destinados a escuelas'],['units_served','Dependencias atendidas'],['support_fte','ETC de soporte administrativo'],['required_hours','Horas estimadas de demanda'],['available_hours','Horas netas disponibles'],['overdue','Trámites vencidos pendientes'],['deadline_due','Trámites con plazo vencido'],['functions_uncovered','Funciones no atendidas'],['functions_required','Funciones requeridas identificadas'],['aligned_cases','Casos con correspondencia funcional'],['checked_cases','Casos contrastados'],['external_recurring','Servicios externos recurrentes'],['attributable_cost','Costo atribuible (S/)'],['homogeneous_products','Productos homogéneos']
 ].map(([k,t])=>input('metric_'+k,t,m[k]??'','number',{upper:false})).join('')}</div><div class="form-actions right"><button class="btn primary" type="submit">Guardar variables de referencia</button></div></form></div>`;}
function dispatchView(){
 const fac=D.faculties.find(f=>f.id===state.filterFaculty)||D.faculties[0];
 const records=state.records.filter(r=>r.faculty_id===fac.id);
 const ready=records.filter(r=>r.status==='validated');
 const forwarded=records.filter(r=>r.status==='forwarded');
 const dispatches=state.dispatches.filter(d=>d.faculty_id===fac.id);
 return shell(`${pageTitle('DOCUMENTACIÓN INSTITUCIONAL','Proyectos de oficio Word',
  'El proyecto de cada remisión incorpora únicamente las fichas comprendidas en esa remisión. Un consolidado es solo para consulta y no formaliza un nuevo envío.')}
  <div class="card">
   <div class="field" style="max-width:580px">${select('filter_faculty','FACULTAD',D.faculties.map(f=>({value:f.id,label:f.name.toUpperCase()})),fac.id)}</div>
   <p class="subtle" style="margin-top:20px">Fichas validadas pendientes de remitir: <b>${ready.length}</b> · Ya remitidas: <b>${forwarded.length}</b>.
   Cada remisión tiene su propio número de registro y su relación de expedientes.</p>
   <button class="btn primary" data-action="download-office" ${ready.length?'':'disabled'}>↓ Vista preliminar de fichas validadas</button>
   <button class="btn ghost" data-action="download-consolidated" ${records.some(r=>['validated','forwarded'].includes(r.status))?'':'disabled'}>↓ Consolidado de consulta (no remisión)</button>
   <button class="btn ghost" data-action="prepare-partial" ${ready.length?'':'disabled'}>Preparar remisión parcial (URH)</button>
   <div class="divider"></div><h3>Remisiones preparadas y formalizadas</h3>
   ${dispatches.map(d=>`<div class="data-row"><div><b>${esc(d.tracking_code)}</b>
    <small>${esc(dispatchKind(d))} · ${esc(d.status)} · ${d.items_count} fichas${d.snapshot?.previous_dispatches?.length?' · '+d.snapshot.previous_dispatches.length+' antecedente(s)':''}</small></div>
    <div class="actions"><button class="btn ghost sm" data-action="download-dispatch" data-id="${esc(d.id)}">Word de esta remisión</button>
    ${d.status==='prepared'?`<button class="btn primary sm" data-action="forward-dispatch" data-id="${esc(d.id)}">Registrar remisión</button>`:''}</div></div>`).join('')||'<p class="subtle">Sin remisiones para esta facultad.</p>'}
  </div>`,'Oficios Word');
}
function modal(){const d=state.modal;
 if(d.type==='record'){const r=state.records.find(x=>x.id===d.id);if(!r)return '';return `<div class="modalback" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" ><div class="modal-head"><div><span class="eyebrow">INFORMACIÓN RECIBIDA</span><h3>${esc(r.owner_name||'SERVIDOR')}</h3><p class="muted tiny">${esc(facultyName(r.faculty_id))} · ${statusBadge(r.status)}</p></div><button class="modal-close" data-action="close-modal">×</button></div><div class="callout bluecall" style="margin-bottom:18px"><b>Ficha de identificación</b><div class="tiny" style="margin-top:7px">DNI: ${esc(r.profile?.dni||'—')} · Código: ${esc(r.worker_code||'—')} · Puesto: ${esc(r.job_title||'—')}</div><div class="tiny">Unidad de organización: ${esc(r.org_unit||'—')} · Nivel educativo: ${esc(r.profile?.education_level||'—')}</div><div class="tiny">Celular: ${esc(r.profile?.phone||'—')} · Correo institucional: ${esc(r.profile?.institutional_email||'—')} · Correo personal: ${esc(r.profile?.personal_email||'—')}</div><div class="tiny">Domicilio: ${esc(r.profile?.address||'—')}</div><div class="tiny">Títulos: ${esc((r.profile?.academic_titles||[]).map(t=>t.name).join('; ')||'—')} · Grados: ${esc((r.profile?.academic_grades||[]).map(g=>g.level+' '+g.name).join('; ')||'—')}</div></div>${r.content.functions.map((fn,i)=>`<div class="compound"><b>FUNCIÓN ${i+1}</b><p>${esc(fn.description)}</p>${fn.activities.map((a,j)=>`<div class="activity-card activity-layer"><b>ACTIVIDAD ${i+1}.${j+1}</b><p class="tiny">${esc(a.description)}</p>${a.products.map(p=>`<div class="prod-card product-layer"><b>${esc(p.name)}</b><div class="tiny muted">Indicador: ${esc(p.indicator||'NO CONSIGNADO')}</div><div class="tiny muted">Frecuencia: ${esc(p.frequency||'NO INDICADA')} · Habitual: ${esc(p.normal||'—')} · Crítica: ${esc(p.peak||'—')}</div><div class="tiny muted">Intensidad ${p.intensity}/10 · Complejidad ${p.complexity}/10 · Prioridad ${p.priority}/10 · Meses: ${esc((p.months||[]).join(', ')||'NO REGISTRADOS')}</div><div class="tiny muted">Origen: ${esc(p.origin||'')} · Unidad de organización de procedencia: ${esc(p.previous_unit||'—')} · Destino: ${esc(p.next_unit||'—')}</div><div class="tiny muted">Causas: ${esc(p.reason||'—')} · Observaciones: ${esc(p.notes||'—')}</div></div>`).join('')}</div>`).join('')}</div>`).join('')}${r.role==='authority'?`<div class="callout bluecall"><b>Necesidades y oportunidades de mejora</b><pre class="authority-detail">${esc(JSON.stringify(r.content.authority||{},null,2))}</pre></div>`:''}${r.content.observations?`<div class="callout bluecall"><b>Observaciones:</b> ${esc(r.content.observations)}</div>`:''}${state.role==='urh_admin'?`<div class="form-actions"><button class="btn ghost" data-action="download-record-word" data-id="${esc(r.id)}">↓ Descargar Word individual</button></div>`:''}${roleCanReview(r)&&r.status==='submitted'?`<div class="divider"></div><div class="field"><label for="review_note">PRECISIÓN O MOTIVO DE DEVOLUCIÓN</label><textarea id="review_note" rows="3" placeholder="Escriba observaciones verificables, sin cambiar la registro del servidor."></textarea></div>${r.role!=='authority'?`<div class="field"><label for="physical_review_reference">REFERENCIA DEL OFICIO FIRMADO Y EXPEDIENTE SGDUNT</label><input id="physical_review_reference" placeholder="N.º de registro, expediente o cargo físico"/><span class="hint">Coteje el oficio suscrito por el Decanato, la revisión administrativa y el registro de trámite SGDUNT.</span></div>`:''}<div class="form-actions"><button class="btn critical" data-action="review-record" data-id="${esc(r.id)}" data-review="return">Marcar con observaciones</button><button class="btn primary" data-action="review-record" data-id="${esc(r.id)}" data-review="approve">Validar registro ✓</button></div>`:''}</div></div>`;}if(d.type==='prepare-partial'){return `<div class="modalback"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>Remisión parcial excepcional</h3><button class="modal-close" data-action="close-modal">×</button></div><p class="muted">Solo la URH puede autorizar una remisión parcial. Los registros faltantes no se consideran cumplidos; deberá justificar la excepción y continuar su seguimiento.</p><form id="partialDispatchForm" class="stack"><div class="field"><label>JUSTIFICACIÓN INSTITUCIONAL (mín. 20 caracteres)</label><textarea name="reason" minlength="20" maxlength="1500" required rows="4"></textarea></div><button class="btn critical" type="submit">Autorizar y preparar remisión parcial</button></form></div></div>`;}
 if(d.type==='forward'){return `<div class="modalback"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow">REMISIÓN INSTITUCIONAL</span><h3>Registrar remisión digital a URH</h3></div><button class="modal-close" data-action="close-modal">×</button></div><p class="subtle">Antes de remitir, descargue el proyecto de oficio, verifique su contenido y obtenga la firma del Decanato. El registro digital no acredita por sí solo la recepción física.</p><form id="forwardForm"><input type="hidden" name="dispatch_id" value="${esc(d.id)}"/>${input('office_number','NÚMERO DE OFICIO (SI YA FUE ASIGNADO)','', 'text',{required:true,placeholder:'OFICIO N.º ...-2026/UNT'})}${input('physical_reference','REFERENCIA DE DOCUMENTO FÍSICO (OPCIONAL)','', 'text',{placeholder:'REGISTRO / EXPEDIENTE'})}<div class="field" style="margin-top:17px"><label><input type="checkbox" name="confirmation" required style="width:auto;min-height:auto;margin-right:10px">Confirmo que la firma corresponde al oficio y a las fichas incluidas en esta remisión específica.</label></div><div class="form-actions right"><button class="btn primary" type="submit">Registrar remisión →</button></div></form></div></div>`;}
return '';}
function syncFunctionFields(){if(!state.submission||state.nav!=='registro')return;const content=state.submission.content;
content.functions.forEach((f,fi)=>{const desc=$(`[name="fn_desc_${fi}"]`);if(desc)f.description=U(desc.value);const note=$(`[name="fn_note_${fi}"]`);if(note)f.notes=U(note.value);f.activities.forEach((a,ai)=>{const ac=$(`[name="act_${fi}_${ai}"]`);if(ac)a.description=U(ac.value);a.products.forEach((p,pi)=>{const prefix=`prod_${fi}_${ai}_${pi}`;['name','indicator','frequency','product_type','temporality','execution_mode','unit','normal','peak','intensity','complexity','priority','origin','previous_unit','next_unit','reason','notes'].forEach(key=>{const el=$(`[name="${prefix}_${key}"]`);if(!el)return;p[key]=['intensity','complexity','priority'].includes(key)?Number(el.value):['normal','peak','origin','frequency','product_type','temporality','execution_mode'].includes(key)?el.value:U(el.value)})})})});const nn=$('#no_needs_confirmed');if(nn)content.authority.no_needs_confirmed=!!nn.checked;const ob=$('[name="general_observations"]');if(ob)content.observations=U(ob.value);['needs','revisions','outsourcing','difficulties'].forEach(key=>{content.authority[key].forEach((arr,idx)=>{for(let i=0;i<4;i++){const el=$(`[name="need_${key}_${idx}_${i}"]`);if(el)arr[i]=U(el.value)}})})}
function formProfile(){const f=$('#profileForm');if(!f)return null;const raw=Object.fromEntries(new FormData(f));const values={};for(const [k,v] of Object.entries(raw)){values[k]=['institutional_email','personal_email'].includes(k)?String(v).trim().toLowerCase():U(String(v).trim())}delete values.keep_on_device;values.faculty_id=f.elements.faculty_id.value;values.role=state.profile?.role||state.role;values.requested_role=state.role;if(state.role==='authority')values.education_level='SUPERIOR';const level=values.education_level||'';values.higher_detail=level==='SECUNDARIA'?'':(values.higher_detail||'');const titles=$$('[name^="academic_title_"]',f).map((node,i)=>({type:f.elements['title_type_'+i]?.value||(level==='TÉCNICO'?'TÉCNICO':'PROFESIONAL'),name:U(node.value.trim())}));const grades=['SUPERIOR','TÉCNICO'].includes(level)?Array.from({length:$$('[name^="academic_grade_"][name$="_level"]',f).length},(_,i)=>({level:f.elements[`academic_grade_${i}_level`]?.value||'',name:U(f.elements[`academic_grade_${i}_name`]?.value||'')})):[];values.academic_titles=level==='SECUNDARIA'?[]:titles;values.academic_grades=grades;values.professional_title=values.academic_titles.map(t=>t.name).join('\n');const masters=grades.filter(g=>g.level==='MAESTRÍA'),doctors=grades.filter(g=>g.level==='DOCTORADO');values.masters_count=masters.length;values.doctorates_count=doctors.length;values.masters_detail=masters.map(g=>g.name).join('\n');values.doctorates_detail=doctors.map(g=>g.name).join('\n');return values;}
function validateProfile(p){
 // Solo los datos mínimos para asociar la ficha con una facultad son imprescindibles.
 // La URH revisa la integridad del resto; no se bloquean borradores por estudios o títulos incompletos.
 if(!p.last_names?.trim()||!p.first_names?.trim()||!p.worker_code?.trim()){
  notice('Consigne apellidos, nombres y código de trabajador para identificar su ficha.');return false;
 }
 return true;
}
function validateDeclaration(){
 // No bloquear la captura de funciones, actividades, productos ni necesidades.
 // Las omisiones se observarán durante la revisión institucional, no al registrar.
 return '';
}
function fromSubmissionRow(row){return {...row,role:row.role_at_submission||row.role,faculty_id:row.faculty_id,content:row.content||emptyContent(),owner_name:row.owner_name||state.directory?.find(x=>x.user_id===row.owner_id)?.display_name||'USUARIO'}}
async function callRPC(fn,params){if(demo)throw Error('No RPC en demo');const {data,error}=await sb.rpc(fn,params);if(error)throw new Error(error.message);return data}
async function persistProfile(){
 const p=formProfile();if(!p||!validateProfile(p))return false;
 // No se solicita ni se guarda una preferencia adicional del trabajador.
 state.keepOnDevice=false;
 state.profile={...state.profile,...p,role:state.role,faculty_id:state.selectedFaculty};
 state.submission=state.submission||initialSubmission();state.submission.faculty_id=state.selectedFaculty;
 if(demo){notice('Datos ficticios preparados.');return true;}
 try{
  if(!state.recordToken){
   const data=await recordsApi('create',{faculty_id:state.selectedFaculty,role:state.role,profile:state.profile,content:state.submission.content,website:''});
   state.recordToken=data.editToken;state.submission.id=data.id;state.submission.status='draft';state.receipt=data.receipt;state.revision_no=data.revision_no;
  }else{
   if(!await saveDraft(true))throw new Error('Quedan modificaciones pendientes; revise la conexión antes de continuar.');
  }
  notice('Borrador guardado en Supabase. Complete y envíe su ficha antes de cerrar la pestaña.');return true;
 }catch(e){notice('No se pudo crear o actualizar el borrador: '+(e.message||e));
  return false;}
}
async function saveDraft(silent=false){
 // Si ya hay una escritura activa, esperar su resultado y guardar cambios nuevos.
 if(activeSave){await activeSave;if(!state.dirty)return true;}
 syncFunctionFields();if(isLocked())return false;
 const s=state.submission;if(!s||!state.profile)return false;
 s.faculty_id=state.selectedFaculty;
 if(demo){state.records=state.records.filter(x=>x.id!==s.id).concat({...s,role:state.role==='faculty_admin'?'staff':state.role,receipt_code:state.role==='faculty_admin'?'ADM-VISTA-PREVIA':undefined,profile:{...state.profile},owner_name:state.profile.last_names+', '+state.profile.first_names,job_title:state.profile.job_title,worker_code:state.profile.worker_code,org_unit:state.profile.org_unit});if(!silent)notice('Cambios de demostración conservados en la pestaña.');return true;}
 if(!state.recordToken){if(!silent)notice('Complete primero la identificación y continúe.');return false;}
 // Snapshot inmutable: las ediciones posteriores no modifican la petición en curso.
 const generation=editGeneration;
 const profile=JSON.parse(JSON.stringify(state.profile));
 const content=JSON.parse(JSON.stringify(s.content));
 const revision=state.revision_no, recordId=s.id, editToken=state.recordToken;
 clearTimeout(autosaveTimer);state.saveBusy=true;
 activeSave=(async()=>{
  try{
   const data=await recordsApi('save',{record_id:recordId,editToken,profile,content,revision_no:revision});
   if(state.submission?.id!==recordId||state.recordToken!==editToken)return false;
   state.revision_no=data.revision_no;s.updated_at=data.updated_at||new Date().toISOString();
   state.dirty=editGeneration!==generation;
   if(!silent)notice(state.dirty?'Cambios recientes pendientes de sincronizar.':'Borrador guardado en Supabase.');
   return true;
  }catch(e){state.dirty=true;if(!silent)notice('No se pudo guardar: '+(e.message||e));return false;}
 })();
 let ok=false;
 try{ok=await activeSave;}finally{activeSave=null;state.saveBusy=false;queueUnsavedChanges();}
 return ok&&!state.dirty;
}
async function submitDraft(){
 syncFunctionFields();const err=validateDeclaration();if(err){notice(err);return}
 if(!state.profile){notice('Primero complete la identificación.');return}
 if(!await saveDraft(true))return notice('Hay cambios aún pendientes o sin sincronizar. Espere a que se complete el guardado y vuelva a enviar.');
 try{state.loading=true;
  if(demo){state.submission.status='submitted';state.receipt='VISTA-PREVIA';const r=state.records.find(x=>x.id===state.submission.id);if(r)r.status='submitted';}
  else{
   const data=await recordsApi('submit',{record_id:state.submission.id,editToken:state.recordToken,profile:state.profile,content:state.submission.content,revision_no:state.revision_no});
   state.submission.status=data.status;state.receipt=data.receipt;state.revision_no=data.revision_no;state.submission.updated_at=data.updated_at||new Date().toISOString();
  }
  state.nav='resumen';render();notice('Ficha presentada correctamente. Finalice y salga antes de ceder la computadora.');
 }catch(e){notice('No pudo presentarse la ficha: '+(e.message||e));}
 finally{state.loading=false;}
}
async function facultyApi(action,params={}){
  if(demo)return {ok:true};
  if(!configured||!sb)throw new Error('Supabase todavía no está configurado.');
  const {data:{session}}=await sb.auth.getSession();
  if(!session)throw new Error('La revisión de datos ajenos requiere supervisión de la URH en este navegador.');
  const response=await fetch(CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/unt-faculty-supervised',{
    method:'POST',headers:{'Content-Type':'application/json','apikey':CFG.supabaseAnonKey,'Authorization':'Bearer '+session.access_token},
    body:JSON.stringify({faculty_id:params.faculty_id||state.selectedFaculty,action,...params})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||'No se pudo completar la operación');
  return data;
}
async function loadFacultyRecords(){
  if(demo)return;
  if(!state.session){state.records=[];state.dispatches=[];return;}
  const data=await facultyApi('list');
  state.records=(data.records||[]).map(fromSubmissionRow);
  state.dispatches=data.dispatches||[];
  try{state.coverage=(await facultyApi('coverage')).coverage||null}catch(e){state.coverage=null;console.warn('Cobertura no disponible:',e.message)}
  if(state.role==='faculty_admin')syncAdminOwn();
}
function syncAdminOwn(){
 if(state.role!=='faculty_admin')return;
 const record=state.records.find(r=>r.faculty_id===state.selectedFaculty&&String(r.receipt_code||'').startsWith('ADM-')&&institutionalEmail(r.profile?.institutional_email)===institutionalEmail(state.session?.user?.email));
 if(record){state.profile={...record.profile,role:'faculty_admin',faculty_id:state.selectedFaculty};
 state.submission={id:record.id,owner_id:record.owner_id,faculty_id:record.faculty_id,role:'faculty_admin',status:record.status,content:record.content||emptyContent(),updated_at:record.updated_at||record.created_at,review_note:record.review_note};
 state.receipt=record.receipt_code;}
}
function updateRecord(r){state.records=state.records.map(x=>x.id===r.id?r:x)}
async function reviewRecord(id,action,note,physicalReference=''){const r=state.records.find(x=>x.id===id);if(!r)return;if(action==='return'&&!note.trim()){notice('Precise el motivo de la observación.');return}if(action==='approve'&&r.role!=='authority'&&!r.faculty_checked){notice('Primero debe constar la revisión del administrador de facultad.');return;}if(action==='approve'&&r.role!=='authority'&&!physicalReference.trim()){notice('Para validar una ficha del personal, indique la referencia del oficio firmado y expediente SGDUNT.');return;}try{if(demo){r.status=action==='approve'?'validated':'changes_requested';r.review_note=note;r.updated_at=new Date().toISOString();updateRecord(r)}else{await facultyApi('review',{faculty_id:r.faculty_id,record_id:id,decision:action,note,physical_reference:physicalReference.trim()});if(state.role==='urh_admin')await loadRemote();else await loadFacultyRecords()}if(state.role==='faculty_admin')syncAdminOwn();state.modal=null;render();notice(action==='approve'?'Registro validado.':'Registro observado. Coordine la subsanación con la URH, sin abrir fichas ajenas en equipos compartidos.')}catch(e){notice('No se pudo registrar la revisión: '+e.message)}}
function validRecords(){return ownRecordList().filter(x=>x.status==='validated')}
function dispatchKind(d){
 const type=d?.snapshot?.type;
 if(type==='complementaria')return d.snapshot?.partial?'COMPLEMENTARIA PARCIAL':'COMPLEMENTARIA';
 if(type==='parcial'||d?.snapshot?.partial)return 'PARCIAL EXCEPCIONAL';
 return 'INICIAL / INTEGRAL';
}

async function prepareDispatch(partial=false,reason=''){if(state.role==='urh_admin'){try{await facultyApi('prepare',{faculty_id:state.filterFaculty,partial,reason});state.modal=null;await loadRemote();render();notice(partial?'Remisión parcial justificada preparada.':'Remisión preparada para generar oficio Word.')}catch(e){notice('No se pudo preparar la remisión: '+e.message)}return;}const own=ownRecordList().find(x=>String(x.receipt_code||'').startsWith('ADM-'));if(!own||!['validated','forwarded'].includes(own.status)){notice('Antes del oficio, complete y revise también la ficha funcional del administrador.');return;}const n=validRecords();if(!n.length){notice('Primero valide al menos un registro de la facultad.');return}if(!partial&&state.coverage&&Number(state.coverage.pending)>0){notice('La remisión completa requiere que no existan fichas pendientes, observadas o en borrador.');return}try{let d;if(demo){d={id:ID(),faculty_id:state.profile.faculty_id,created_by:state.profile.id,created_at:new Date().toISOString(),tracking_code:'UNT-DEMO-'+new Date().getFullYear()+'-'+String(state.dispatches.length+1).padStart(3,'0'),items_count:n.length,status:'prepared',snapshot:{names:n.map(x=>x.owner_name),records:n.map(x=>({id:x.id,name:x.owner_name,worker_code:x.worker_code||'UNT-000',job_title:x.job_title||'PERSONAL ADMINISTRATIVO',org_unit:x.org_unit||'',profile:x.profile||{},role:x.role,receipt_code:x.receipt_code||'',content:x.content,functions:x.content.functions.length}))}};state.dispatches.push(d);}else{const result=await facultyApi('prepare',{partial,reason});d=result.id;await loadFacultyRecords()}notice('Remisión preparada. Puede descargar el proyecto de oficio para su firma.');render()}catch(e){notice('No se pudo preparar el oficio: '+e.message)}}
async function forwardDispatch(id,officenumber,reference){
 const d=state.dispatches.find(x=>x.id===id);
 if(!d){notice('No se encontró la remisión seleccionada. Actualice la consulta.');return;}
 try{
  if(demo){
   d.status='forwarded';d.office_number=officenumber;d.physical_reference=reference;
   const ids=new Set((d.snapshot?.records||[]).map(x=>x.id));
   state.records.filter(x=>ids.has(x.id)&&x.faculty_id===d.faculty_id&&x.status==='validated').forEach(x=>x.status='forwarded');
  }else{
   // La facultad se obtiene del documento; nunca del filtro o de la última selección del usuario.
   await facultyApi('forward',{faculty_id:d.faculty_id,dispatch_id:id,office_number:officenumber,physical_reference:reference});
   if(state.role==='urh_admin')await loadRemote();
   else await loadFacultyRecords();
  }
  state.modal=null;render();
  notice('Remisión digital registrada. Conserve el cargo del documento físico firmado.');
 }catch(e){notice('No se pudo registrar la remisión: '+e.message)}
}
async function saveMetrics(form){const f=D.faculties.find(x=>x.id===state.filterFaculty);const obj={faculty_id:f.id,period:'2026',...Object.fromEntries([...new FormData(form)].map(([key,value])=>[key.replace('metric_',''),value===''?null:Number(value)]))};try{if(demo){state.metrics=state.metrics.filter(m=>m.faculty_id!==f.id).concat(obj)}else{await callRPC('save_faculty_metrics',{payload:obj});await loadRemote()}notice('Variables de referencia guardadas.');render()}catch(e){notice('No se pudo guardar el indicador: '+e.message)}}
function exportExcel(){try{const data=window.UNT_XLSX.build(state.records,facultyName);downloadBlob(data,'UNT_DIAGNOSTICO_FUNCIONES_PRODUCTOS.xlsx');notice('Archivo Excel generado con resumen y productos detallados.');}catch(e){notice('No se pudo generar Excel: '+e.message)}}
function exportCsv(){const rows=[['FACULTAD','SERVIDOR','PUESTO','CÓDIGO','ESTADO','FUNCIONES','ACTIVIDADES','PRODUCTOS']];state.records.forEach(r=>{const fns=r.content?.functions||[];rows.push([facultyName(r.faculty_id),r.owner_name||'',r.job_title||'',r.worker_code||'',statuses[r.status]?.[0]||r.status,fns.length,fns.reduce((a,f)=>a+f.activities.length,0),fns.reduce((a,f)=>a+f.activities.reduce((b,c)=>b+c.products.length,0),0)])});const csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),'UNT_CONSOLIDADO_FUNCIONAL.csv')}
function downloadDispatchWord(dispatchId,mode='preview'){
 if(!demo&&state.role==='faculty_admin'&&!state.session){
  notice('El Word con fichas identificadas requiere acceso institucional autorizado.');return;
 }
 const dispatch=dispatchId?state.dispatches.find(x=>x.id===dispatchId):null;
 if(dispatchId&&!dispatch){notice('No se encontró la remisión elegida; actualice el listado.');return;}
 const fac=dispatch?.faculty_id || (state.role==='faculty_admin'?state.selectedFaculty:state.filterFaculty);
 if(!D.faculties.some(f=>f.id===fac)){notice('Seleccione una facultad válida.');return;}
 const historical=state.dispatches.filter(d=>d.faculty_id===fac&&d.status==='forwarded');
 const consolidated=mode==='consolidated';
 const source=dispatch
  ?dispatch.snapshot?.records
  :state.records.filter(r=>r.faculty_id===fac&&(consolidated?['validated','forwarded'].includes(r.status):r.status==='validated'));
 if(!Array.isArray(source)){
  notice('La remisión carece de una relación de fichas válida. No es seguro generar el oficio.');return;
 }
 const rows=source.map(r=>({id:r.id,name:r.name||r.owner_name||'',job_title:r.job_title||'',worker_code:r.worker_code||'',org_unit:r.org_unit||'',receipt_code:r.receipt_code||'',role:r.role||'',profile:r.profile||{},content:r.content||emptyContent()}));
 if(!rows.length){notice('No hay fichas aplicables al documento seleccionado.');return;}
 const references=dispatch
  ?(Array.isArray(dispatch.snapshot?.previous_dispatches)?dispatch.snapshot.previous_dispatches:[])
  :consolidated?historical.map(d=>({tracking_code:d.tracking_code,office_number:d.office_number,forwarded_at:d.forwarded_at,items_count:d.items_count,id:d.id})):[];
 const kind=consolidated?'consolidado':dispatch?(dispatch.snapshot?.type||(dispatch.snapshot?.partial?'parcial':'integral')):'preview';
 const obj={faculty:facultyName(fac),tracking:dispatch?.tracking_code||'DOCUMENTO DE CONSULTA SIN REMISIÓN FORMAL',
  records:rows,officeNumber:dispatch?.office_number||'',date:'[DÍA] DE [MES] DE [AÑO]',
  preparedBy:state.role==='urh_admin'?'UNIDAD DE RECURSOS HUMANOS':'ADMINISTRACIÓN DE FACULTAD',
  kind,partial:dispatch?.snapshot?.partial===true,justification:dispatch?.snapshot?.justification||'',
  coverage:dispatch?.snapshot?.coverage||null,previousDispatches:references};
 try{
  const blob=window.UNT_DOCX.buildOffice(obj);
  const prefix=consolidated?'CONSOLIDADO_CONSULTA':dispatch?'PROYECTO_REMISION':'PRELIMINAR_NO_REMISION';
  downloadBlob(blob,prefix+'_'+fac.toUpperCase()+'_UNT.docx');
  notice(consolidated?'Consolidado de consulta descargado: no sustituye los oficios ya remitidos.':'Word descargado para revisión y firma.');
 }catch(e){notice('No se pudo generar el Word: '+e.message)}
}
function downloadPersonalWord(){
 const s=state.submission;if(!s||!state.profile||!['submitted','validated','forwarded'].includes(s.status)){notice('Primero presente el registro.');return;}
 try{
  const blob=window.UNT_DOCX.buildFicha({faculty:facultyName(state.selectedFaculty),profile:state.profile,content:s.content,receipt:state.receipt||s.receipt_code||'VISTA PREVIA',role:state.role});
  downloadBlob(blob,(state.role==='authority'?'UNT_NECESIDADES_':'UNT_OFICIO_AL_DECANATO_')+String(state.profile.worker_code||'REGISTRO').replace(/[^A-Z0-9_-]/gi,'_')+'.docx');
  notice(state.role==='authority'?'Informe Word de necesidades generado.':'Oficio individual Word generado para presentar al Decanato.');
 }catch(e){notice('No se pudo crear el Word: '+e.message)}
}
function downloadRecordWord(id){
 if(state.role!=='urh_admin'||!state.session){notice('Solo URH puede consultar fichas de terceros.');return;}
 const r=state.records.find(x=>x.id===id);if(!r)return;
 try{
  const blob=window.UNT_DOCX.buildFicha({faculty:facultyName(r.faculty_id),profile:r.profile||{},content:r.content||emptyContent(),receipt:r.receipt_code,role:r.profile?.role||r.role});
  downloadBlob(blob,(r.profile?.role==='authority'||r.role==='authority'?'UNT_NECESIDADES_URH_':'UNT_OFICIO_URH_')+String(r.worker_code||'REGISTRO').replace(/[^A-Z0-9_-]/gi,'_')+'.docx');
  notice('Word individual obtenido del registro digital en Supabase.');
 }catch(e){notice('No se pudo generar el Word: '+e.message)}
}
function downloadConformityWord(form){
 try{
  const rows=String(form.elements.entries.value||'').split(/\r?\n/).map(line=>line.split('|').map(x=>x.trim())).filter(row=>row.some(Boolean)).slice(0,100);
  const blob=window.UNT_DOCX.buildActaConformidad({faculty:facultyName(state.selectedFaculty),administrator:form.elements.administrator.value,rows});
  downloadBlob(blob,'UNT_ACTA_CONFORMIDAD_'+state.selectedFaculty.toUpperCase()+'.docx');
  notice('Acta Word generada para revisión, firma y entrega a la URH.');
 }catch(e){notice('No se pudo generar el acta: '+e.message)}
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function loadRemote(){
 if(demo||!state.session)return;
 const uid=state.session.user.id;
 const p=await sb.from('profiles').select('*').eq('id',uid).maybeSingle();
 if(p.error)throw p.error;
 if(!p.data||p.data.role!=='urh_admin')throw new Error('La cuenta no tiene autorización URH.');
 state.profile=normalizedAcademicProfile(p.data);state.role='urh_admin';
 // Paginación: no omitir fichas por el límite de 1000 filas de PostgREST.
 const rows=[];
 for(let offset=0;offset<20000;offset+=500){
   const result=await sb.from('intake_submissions').select('*')
     .in('status',['submitted','changes_requested','validated','forwarded'])
     .order('created_at',{ascending:false}).order('id',{ascending:true})
     .range(offset,offset+499);
   if(result.error)throw result.error;
   const batch=result.data||[];rows.push(...batch);
   if(batch.length<500)break;
   if(offset===19500)throw new Error('Se alcanzó el límite de consulta; contacte al administrador técnico.');
 }
 state.records=rows.map(r=>({...r,role:r.role_at_submission,
   owner_name:r.owner_name||[r.profile?.last_names,r.profile?.first_names].filter(Boolean).join(', '),
   job_title:r.job_title||r.profile?.job_title||'',
   worker_code:r.worker_code||r.profile?.worker_code||'',
   org_unit:r.org_unit||r.profile?.org_unit||'',content:r.content||emptyContent()}));
 // V19.3.0: supervisión agregada sin exponer borradores nominales ni sus contenidos.
 try{const progress=await facultyApi('progress',{faculty_id:'fce'});state.progress=progress.rows||[];state.progressError='';}
 catch(e){state.progress=[];state.progressError=e.message;console.warn('Seguimiento de cobertura pendiente:',e.message)}
 // V19.2.1: controles de conformidad facultativa, para cotejo por la URH.
 try{
  const result=await facultyApi('review-overview',{faculty_id:'fce'});
  const status=new Map((result.checks||[]).map(x=>[x.record_id,x]));
  state.records.forEach(r=>{r.faculty_checked=status.get(r.id)?.checked===true&&Number(status.get(r.id)?.reviewed_revision)===Number(r.revision_no);r.faculty_note=status.get(r.id)?.notes||'';});
 }catch(e){console.warn('Vistos buenos de facultad no disponibles:',e.message)}
 const [metrics,dispatches]=await Promise.all([
   sb.from('faculty_metrics').select('*'),
   sb.from('unt_intake_dispatches').select('*').in('status',['prepared','forwarded']).order('created_at',{ascending:false}).limit(1000)
 ]);
 if(metrics.error)throw metrics.error;
 if(dispatches.error)throw dispatches.error;
 state.metrics=metrics.data||[];state.directory=[];state.dispatches=dispatches.data||[];
}
async function refreshUrh(silent=false){
 if(state.role!=='urh_admin'||!state.session)return;
 try{await loadRemote();if(!silent){notice('Información institucional actualizada.');}render(true);}
 catch(e){if(!silent)notice('No fue posible actualizar los registros: '+e.message);}
}
async function authUrhPassword(email,password){if(!sb)return notice('Servicio de acceso no configurado.');try{const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;const {data:profile,error:perr}=await sb.from('profiles').select('role').eq('id',data.user.id).maybeSingle();if(perr||profile?.role!=='urh_admin'){await sb.auth.signOut();state.session=null;throw new Error('La cuenta no está habilitada como administrador de la URH.')}state.session=data.session;await loadRemote();state.nav='dashboard';state.screen='workspace';render()}catch(e){notice('Acceso no autorizado: '+e.message)}}
async function logout(){
 // También al volver al inicio se borra toda la información de la persona anterior.
 clearTimeout(autosaveTimer);autosaveTimer=null;editGeneration=0;
 try{if(!demo&&state.session&&sb)await sb.auth.signOut()}catch(err){console.warn('Cierre de sesión local',err)}
 purgeLegacyBrowserState();aiSessions={};ai={description:'',respuestas:{},respuestasAnteriores:[],detalleNuevo:'',propuestas:[],preguntas:[],alertas:[],analisis:null,busy:false,error:'',token:'',attempts:0,selected:0,stage:'inicio',open:false,target:{kind:'function',fi:0,ai:0,pi:0}};
 state.screen='faculty';state.nav='registro';state.profile=null;state.session=null;state.submission=null;state.facReviewToken='';state.facReviewRows=[];state.facReviewName='';state.issuedFacultyLink='';
 state.records=demo?demoRecords():[];state.directory=[];state.dispatches=[];state.progress=[];state.progressError='';state.role=null;state.selectedFaculty='';state.captchaToken='';state.recordToken='';state.receipt='';state.step=0;state.revision_no=1;state.dirty=false;state.modal=null;state.authEmail='ssgdr@unitru.edu.pe';state.filterFaculty='fce';
 render();
}
async function selectRole(role){if(!['staff','faculty_admin','authority','urh_admin'].includes(role))return;state.recordToken='';state.receipt='';state.revision_no=1;state.dirty=false;state.role=role;state.nav=role==='urh_admin'?'dashboard':'registro';state.step=0;state.captchaToken='';if(role==='urh_admin'){if(demo){state.profile=sampleProfile('urh_admin');state.records=demoRecords();state.screen='workspace';state.nav='dashboard';}else if(!configured){state.screen='setup'}else if(state.session){try{await loadRemote();state.screen='workspace'}catch(e){state.session=null;state.screen='auth';}}else state.screen='auth';render();return;}if(!state.selectedFaculty){state.screen='faculty';render();return;}if(role==='faculty_admin'){state.profile=demo?sampleProfile(role):emptyProfile(role);state.profile.faculty_id=state.selectedFaculty;state.submission=initialSubmission();state.nav='registro';state.screen='workspace';if(demo){state.submission.content=sampleContent();await loadFacultyReview();}render();return;}state.profile=demo?sampleProfile(role):emptyProfile(role);state.profile.faculty_id=state.selectedFaculty;state.submission=initialSubmission();if(demo){state.submission.content=role==='staff'?sampleContent():{...emptyContent(),functions:[]};}state.screen='workspace';render();}
function render(keepScroll=false){const previousScroll=window.scrollY;let html;if(state.screen==='faculty')html=viewFaculty();else if(state.screen==='landing')html=viewLanding();else if(state.screen==='setup')html=viewSetup();else if(state.screen==='awaiting')html=viewAwaiting();else if(state.screen==='auth')html=viewAuth();else if(state.role==='faculty_admin'){html=state.nav==='conformidad'?conformityView():state.nav==='resumen'?ownSummary():declaration();}else if(state.role==='urh_admin'){html=state.nav==='dashboard'?dashboard():state.nav==='registros'?recordsView():state.nav==='indicadores'?indicatorView():dispatchView();}else{html=state.nav==='resumen'?ownSummary():declaration();}app.innerHTML=html+(state.modal&&state.screen!=='workspace'?modal():'');updateWritingAdvice();document.body.classList.toggle('ai-drawer-open',!!ai.open);if(state.screen==='workspace'&&state.nav==='registro'&&state.step===1&&state.role!=='authority')initAiWidget();document.body.classList.remove('nav-open');if(isLocked()&&state.nav==='registro'){$$('input,select,textarea',app).forEach(el=>{if(!el.closest('.sidebar')&&!el.closest('.topbar'))el.disabled=true})}window.scrollTo({top:keepScroll?previousScroll:0,behavior:'instant'});}
async function nextStep(){if(state.step===0)return;syncFunctionFields();if(state.step===1&&state.role!=='authority'){const err=validateDeclaration();if(err){notice(err);return}}if(state.step<steps().length-1){if(!demo&&state.dirty&&!await saveDraft(true)){notice('No fue posible guardar los cambios; revise su conexión.');return}state.step++;render()}}
async function handleClick(e){const btn=e.target.closest('[data-action],[data-role],[data-nav]');if(!btn)return; if(btn.classList.contains('modalback') && e.target!==btn)return; let role=btn.dataset.role,action=btn.dataset.action,nav=btn.dataset.nav;if(role){selectRole(role);return}if(nav){if(!navItems().some(row=>row[0]===nav))return;syncFunctionFields();state.nav=nav;if(nav==='necesidades')state.step=1;if(nav==='conformidad'&&(demo||state.facReviewToken)){try{await loadFacultyReview()}catch(e){notice(e.message)}}render();return}switch(action){

case 'return-faculty':state.screen='workspace';state.nav='validacion';render();break;
case 'go-home':await logout();break;
case 'go-back':if(state.modal){state.modal=null;}else if(state.nav==='registro'&&state.step>0){syncFunctionFields();state.step--;}else if(state.screen==='workspace'){await logout();return;}else if(state.screen==='landing'){state.screen='faculty';}else {state.screen=state.selectedFaculty?'landing':'faculty';}render();break;
case 'change-faculty':await logout();break;
case 'menu':{
   if(window.matchMedia('(max-width:850px)').matches){const side=$('#sidebar'),isOpen=side?.classList.toggle('open');$('.sidebar-scrim')?.classList.toggle('open',!!isOpen);$('[data-action=menu]')?.setAttribute('aria-expanded',String(!!isOpen));document.body.classList.toggle('nav-open',!!isOpen);}
   else {state.sidebarHidden=!state.sidebarHidden;const shellEl=$('.shell');shellEl?.classList.toggle('sidebar-collapsed',state.sidebarHidden);const button=$('[data-action=menu]');button?.setAttribute('aria-expanded',String(!state.sidebarHidden));const label=button?.querySelector('.menu-caption');if(label)label.textContent=state.sidebarHidden?'Mostrar menú':'Ocultar menú';}
   break;}
case 'close-menu':$('#sidebar')?.classList.remove('open');$('.sidebar-scrim')?.classList.remove('open');$('[data-action=menu]')?.setAttribute('aria-expanded','false');document.body.classList.remove('nav-open');break;
case 'logout':await logout();break;
case 'next-step':await nextStep();break;
case 'prev-step':syncFunctionFields();state.step=Math.max(0,state.step-1);render();break;
case 'save-draft':saveDraft();break;
case 'submit-declaration':submitDraft();break;
case 'add-academic-title':case 'delete-academic-title':case 'add-academic-grade':case 'delete-academic-grade':updateAcademicRows(action,Number(btn.dataset.idx)||0);break;
case 'ai-open':{
  syncFunctionFields();
  const kind=btn.dataset.kind||'function',fi=Number(btn.dataset.fi)||0,act=Number(btn.dataset.ai)||0,pi=Number(btn.dataset.pi)||0;
  saveAiSession();const next={kind,fi,ai:act,pi};
  if(aiTargetKey(next)!==aiTargetKey(ai.target)){const session=aiSessions[aiTargetKey(next)]||{description:'',respuestas:{},respuestasAnteriores:[],detalleNuevo:'',propuestas:[],preguntas:[],alertas:[],analisis:null,attempts:0,selected:0,stage:'inicio'};Object.assign(ai,session,{busy:false,error:'',token:''});}
  ai.target=next;
  const field=kind==='function'?`fn_desc_${fi}`:kind==='activity'?`act_${fi}_${act}`:`prod_${fi}_${act}_${pi}_name`;
  if(!ai.description.trim()&&!ai.propuestas.length){const existing=document.getElementById(field)?.value.trim();if(existing)ai.description=existing;}
  ai.open=true;render(true);document.querySelector('.ai-drawer')?.focus({preventScroll:true});break;
 }
 case 'ai-close':syncAiDraft();syncAiAnswers();saveAiSession();ai.open=false;render(true);document.querySelector(`[data-action="ai-open"][data-kind="${ai.target.kind}"][data-fi="${ai.target.fi}"][data-ai="${ai.target.ai}"][data-pi="${ai.target.pi}"]`)?.focus({preventScroll:true});break;
 case 'ai-generate':syncFunctionFields();await aiGenerate();break;
case 'ai-dontknow':{const el=document.getElementById('ai_answer_'+btn.dataset.idx);if(el){el.value='NO SÉ';ai.respuestas[Number(btn.dataset.idx)]='NO SÉ';el.focus();}break;}
case 'ai-pick':syncAiDraft();ai.selected=Number(btn.dataset.idx);render(true);break;
case 'ai-add-activity':{syncAiDraft();const x=ai.propuestas[ai.selected];if(x){if(x.actividades.length>=25)return notice('Para facilitar la revisión, registra más labores en otra función.');x.actividades.push({actividad:'',productos:[]});render(true);}break;}
case 'ai-remove-activity':{syncAiDraft();const x=ai.propuestas[ai.selected];if(x&&x.actividades.length>1){x.actividades.splice(Number(btn.dataset.idx),1);render(true);}break;}
case 'ai-add-product':{syncAiDraft();const a=ai.propuestas[ai.selected]?.actividades[Number(btn.dataset.idx)];if(a){if(a.productos.length>=12)return notice('Para continuar, agrega otra actividad relacionada.');a.productos.push('');render(true);}break;}
case 'ai-remove-product':{syncAiDraft();const a=ai.propuestas[ai.selected]?.actividades[Number(btn.dataset.idx)];if(a){a.productos.splice(Number(btn.dataset.prod),1);render(true);}break;}
case 'ai-select-option':{syncAiDraft();const selected=Number(btn.dataset.idx);if(Number.isInteger(selected)&&selected>=0&&selected<ai.propuestas.length){ai.selected=selected;render(true);}break;}
case 'ai-apply':applyAiProposal(Number(btn.dataset.idx));break;
case 'ai-apply-all':applyAllAiFunctions();break;
case 'add-function':if(isLocked())return;syncFunctionFields();state.submission.content.functions.push(emptyFunction());render(true);break;
case 'delete-function':if(!isLocked()&&state.submission.content.functions.length>1){syncFunctionFields();state.submission.content.functions.splice(+btn.dataset.fi,1);render(true)}break;
case 'add-activity':if(isLocked())return;syncFunctionFields();state.submission.content.functions[+btn.dataset.fi].activities.push({id:ID(),description:'',products:[emptyProduct()]});render(true);break;
case 'delete-activity':if(!isLocked()){syncFunctionFields();let a=state.submission.content.functions[+btn.dataset.fi].activities;if(a.length>1){a.splice(+btn.dataset.ai,1);render(true)}}break;
case 'add-product':if(isLocked())return;syncFunctionFields();state.submission.content.functions[+btn.dataset.fi].activities[+btn.dataset.ai].products.push(emptyProduct());render(true);break;
case 'delete-product':if(!isLocked()){syncFunctionFields();let p=state.submission.content.functions[+btn.dataset.fi].activities[+btn.dataset.ai].products;if(p.length>1){p.splice(+btn.dataset.pi,1);render(true)}}break;
case 'toggle-month':if(isLocked())return;syncFunctionFields();{let p=state.submission.content.functions[+btn.dataset.fi].activities[+btn.dataset.ai].products[+btn.dataset.pi];p.months=p.months||[];if(p.months.includes(btn.dataset.month))p.months=p.months.filter(x=>x!==btn.dataset.month);else p.months.push(btn.dataset.month);render(true)}break;
case 'add-need':syncFunctionFields();state.submission.content.authority[btn.dataset.need].push(['','','','']);render(true);break;
case 'delete-need':syncFunctionFields();state.submission.content.authority[btn.dataset.need].splice(+btn.dataset.idx,1);render(true);break;
case 'open-record':state.modal={type:'record',id:btn.dataset.id};render();break;
case 'close-modal':state.modal=null;render();break;
case 'review-record':reviewRecord(btn.dataset.id,btn.dataset.review,$('#review_note')?.value||'',$('#physical_review_reference')?.value||'');break;
case 'refresh-urh':refreshUrh();break;


case 'prepare-dispatch':prepareDispatch();break;
case 'prepare-partial':if(state.role!=='urh_admin')return;state.modal={type:'prepare-partial'};render();break;
case 'download-office':downloadDispatchWord();break;
case 'download-personal-word':downloadPersonalWord();break;
case 'download-record-word':downloadRecordWord(btn.dataset.id);break;
case 'download-consolidated':if(state.role==='urh_admin')downloadDispatchWord(null,'consolidated');break;
case 'download-dispatch':downloadDispatchWord(btn.dataset.id);break;
case 'forward-dispatch':state.modal={type:'forward',id:btn.dataset.id};render();break;
case 'export-csv':exportCsv();break;
case 'faculty-refresh':try{await loadFacultyReview();render(true);notice('Relación actualizada.');}catch(e){notice(e.message)}break;
case 'faculty-save':await performFacultyReview('save',btn.dataset.id);break;
case 'faculty-mark':await performFacultyReview('mark',btn.dataset.id,btn.dataset.checked==='true');break;
case 'faculty-word':facultyWord(btn.dataset.id);break;
case 'faculty-all-word':await facultyFinalWord();break;
case 'faculty-add-function':case 'faculty-add-activity':case 'faculty-add-product':facultyAddItem(btn.dataset.id,action,Number(btn.dataset.fi)||0,Number(btn.dataset.ai)||0);break;
case 'issue-faculty-link':await issueFacultyReviewLink(false);break;
case 'revoke-faculty-link':await issueFacultyReviewLink(true);break;
case 'copy-faculty-link':if(state.issuedFacultyLink)navigator.clipboard?.writeText(state.issuedFacultyLink).then(()=>notice('Enlace copiado.'));break;
case 'export-excel':exportExcel();break;
}
if(['add-function','delete-function','add-activity','delete-activity','add-product','delete-product','toggle-month','add-need','delete-need','ai-apply'].includes(action)){scheduleCloudSave();}
}
app.addEventListener('click',handleClick);
document.addEventListener('keydown',e=>{if(e.key==='Tab'&&ai.open){const drawer=$('.ai-drawer');const nodes=$$('button:not([disabled]),textarea:not([disabled]),input:not([disabled]),summary,[tabindex="0"]',drawer).filter(x=>x.offsetParent!==null);if(nodes.length){const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}if(e.key==='Escape'){if(state.modal){state.modal=null;render();return;}if(ai.open){syncAiDraft();syncAiAnswers();saveAiSession();ai.open=false;render(true);return;}const s=$('#sidebar');if(s?.classList.contains('open')){s.classList.remove('open');$('.sidebar-scrim')?.classList.remove('open');$('[data-action=menu]')?.setAttribute('aria-expanded','false');document.body.classList.remove('nav-open');$('[data-action=menu]')?.focus();}}});
app.addEventListener('change',async e=>{if(e.target.matches('input[name=education_level]')){updateAcademicVisibility();return;}});
app.addEventListener('input',e=>{if(e.target.id==='faculty_reviewer_name')state.facReviewName=U(e.target.value);if(e.target.id==='ai_work_desc'){ai.description=e.target.value;const count=$('#ai-char-count');if(count)count.textContent=ai.description.length+'/3500';}if(e.target.id==='ai_more')ai.detalleNuevo=e.target.value;if(e.target.hasAttribute('data-ai-answer'))ai.respuestas[Number(e.target.dataset.aiAnswer)]=e.target.value;if(e.target.hasAttribute('data-ai-field')){syncAiDraft();if(e.target.id==='ai_edit_fn'){const warning=$('.ai-function-alert');if(warning){const advice=functionWritingAdvice(e.target.value);warning.hidden=!advice;warning.textContent=advice?'ⓘ '+advice:'';}}}if(e.target.matches('[type=range]')){const out=document.getElementById('out_'+e.target.name);if(out)out.textContent=e.target.value+'/10';}if(state.nav==='registro'&&state.step>0&&!e.target.closest('.ai-drawer')){syncFunctionFields();scheduleCloudSave();if(/^(fn_desc_\d+|act_\d+_\d+|prod_\d+_\d+_\d+_name)$/.test(e.target.id))scheduleWritingAdvice()}});
app.addEventListener('focusout',e=>{if(/^(fn_desc_\d+|act_\d+_\d+|prod_\d+_\d+_\d+_name)$/.test(e.target.id||''))updateWritingAdvice();});
app.addEventListener('submit',async e=>{e.preventDefault();const form=e.target;if(form.id==='facultySelectionForm'){state.selectedFaculty=form.elements.faculty.value;if(!state.selectedFaculty){notice('Seleccione una facultad para continuar.');return}state.screen='landing';render()}else if(form.id==='profileForm'){if(await persistProfile()){state.step=1;render()}}
else if(form.id==='conformityForm'){downloadConformityWord(form);return;}else if(form.id==='partialDispatchForm'){if(state.role!=='urh_admin')return;await prepareDispatch(true,form.elements.reason.value)}
else if(form.id==='loginForm'){const eMail=form.elements.email.value.trim().toLowerCase();if(state.role==='urh_admin'){if(demo){state.screen='workspace';state.nav='dashboard';render();notice('Acceso de navegación ficticio.');}else await authUrhPassword(eMail,form.elements.password.value)}}else if(form.id==='metricForm'){await saveMetrics(form)}else if(form.id==='forwardForm'){if(!form.elements.confirmation.checked)return notice('Confirme que se ha gestionado la firma.');await forwardDispatch(form.elements.dispatch_id.value,form.elements.office_number.value,form.elements.physical_reference.value)}});
window.addEventListener('beforeunload',e=>{if(!demo&&state.recordToken&&state.dirty&&!isLocked()){e.preventDefault();e.returnValue='';}});
setInterval(()=>{if(!demo&&state.role==='urh_admin'&&state.screen==='workspace'&&['dashboard','registros'].includes(state.nav)&&state.session&&!state.modal){refreshUrh(true)}},60000);
async function init(){
  const fragment=new URLSearchParams(location.hash.slice(1));
  const inviteFaculty=fragment.get('faculty')||'';
  const inviteToken=fragment.get('review_token')||'';
  if(inviteToken){history.replaceState(null,'',location.pathname+location.search);}
  purgeLegacyBrowserState();
 if(!demo&&configured){
  try{
   if(!window.supabase?.createClient){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar el servicio de autenticación.'));document.head.appendChild(script)})}
   purgeLegacyBrowserState();
   sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
   const {data,error}=await sb.auth.getSession();if(error)throw error;
   state.session=data.session;
   if(data.session){
     const {data:profile}=await sb.from('profiles').select('role').eq('id',data.session.user.id).maybeSingle();
     if(profile?.role==='urh_admin'){
       try{state.role='urh_admin';await loadRemote();state.screen='workspace';state.nav='dashboard'}
       catch(e){console.warn(e);state.screen='faculty';state.role=null;}
     }
   }
   sb.auth.onAuthStateChange((event,session)=>{
     state.session=session;
     if(event==='SIGNED_OUT'&&['urh_admin','faculty_admin'].includes(state.role||'')){
       state.session=null;state.screen='faculty';state.role=null;state.profile=null;state.records=[];render();
     }
   });
  }catch(e){console.error(e);notice('No pudo conectarse a Supabase: '+e.message)}
 }
 if(/^[a-z]{2,5}$/.test(inviteFaculty)&&/^[a-f0-9]{64}$/i.test(inviteToken)){
   state.selectedFaculty=inviteFaculty;state.role='faculty_admin';state.screen='workspace';state.nav='conformidad';
   state.facReviewToken=inviteToken;state.profile=emptyProfile('faculty_admin');state.profile.faculty_id=inviteFaculty;
   state.submission=initialSubmission();
   try{await loadFacultyReview()}catch(e){state.facReviewToken='';notice('Enlace de facultad no disponible: '+e.message)}
 }
 render();
}
init();
})();
