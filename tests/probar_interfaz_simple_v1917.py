"""Prueba local simulada: confirma acceso de servidor sin modales OTP."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
mock=r'''
window.UNT_CONFIG={demo:false,supabaseUrl:'https://demo.supabase.co',supabaseAnonKey:'sb_publishable_demo',aiMode:'local'};
window.mock={session:null,calls:[],otp:0};
window.supabase={createClient:()=>({auth:{
 getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}}),
 signInWithOtp:async()=>{window.mock.otp++;return {error:null}}}})};
const originalFetch=window.fetch.bind(window);
window.fetch=async (url,opts)=>{
 if(String(url).includes('/functions/v1/unt-registros')){
 const b=JSON.parse(opts.body);window.mock.calls.push({action:b.action,auth:opts.headers.Authorization||''});
 if(b.action==='create')return new Response(JSON.stringify({ok:true,id:'12345678-1234-1234-1234-123456789000',editToken:'a'.repeat(64),receipt:'UNT-2026-TEST',status:'draft',revision_no:1}),{status:200});
 if(b.action==='get')return new Response(JSON.stringify({ok:true,record:{id:b.record_id,receipt_code:'UNT-2026-TEST',faculty_id:'fce',profile:{role:'staff',faculty_id:'fce',institutional_email:'prueba@unitru.edu.pe',dni:'12345678'},content:{functions:[],authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}},status:'draft',revision_no:1}}),{status:200});
 return new Response(JSON.stringify({ok:true,receipt:'UNT-2026-TEST',revision_no:2,status:'draft',updated_at:new Date().toISOString()}),{status:200});
 }
 return originalFetch(url,opts);
};
'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':900});err=[];page.on('pageerror',lambda e:err.append(str(e)))
 page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
 page.add_style_tag(content=(root/'styles.css').read_text())
 page.add_script_tag(content=mock)
 for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
  page.add_script_tag(content=(root/name).read_text())
 page.wait_for_timeout(150)
 page.locator('#landing_faculty').select_option('fce');page.locator('#facultySelectionForm button[type="submit"]').click();page.locator('[data-role="staff"]').click()
 fields={'last_names':'PEREZ RAMIREZ','first_names':'MARIA LUISA','dni':'12345678','worker_code':'UNT-TEST-9','job_title':'ASISTENTE ADMINISTRATIVO','address':'TRUJILLO URBANA','phone':'','institutional_email':'prueba@unitru.edu.pe','personal_email':'prueba@example.com','org_unit':'SECRETARIA ACADEMICA'}
 for k,v in fields.items():page.locator(f'#profileForm [name="{k}"]').fill(v)
 page.locator('#profileForm [name="education_level"][value="SECUNDARIA"]').check()
 assert page.get_by_text('Recepción directa del registro').count()==0
 assert page.locator('[name="keep_on_device"]').count()==0
 assert page.locator('[name="phone"]').get_attribute('required') is None
 page.locator('#profileForm button[type="submit"]').click();page.wait_for_timeout(300)
 assert page.locator('[data-action="send-identity-code"]').count()==0, 'No debe aparecer OTP para servidor'
 assert page.evaluate('window.mock.otp')==0,'Nunca debe enviar OTP a servidor'
 calls=page.evaluate('window.mock.calls');assert calls and calls[0]['action']=='create' and not calls[0]['auth'],calls
 assert page.locator('.save-status').count()==1,'Debe indicar el estado del guardado en el aplicativo'
 assert page.locator('#app').inner_text().find('CÓDIGO DE VERIFICACIÓN')==-1
 page.screenshot(path='/mnt/data/UNT_FACULTADES_V19_1_7_FORMULARIO_SIMPLE.png',full_page=False)
 page.locator('[data-action="recover-open"]').count() # not always visible inside workspace
 # Segundo recorrido: el administrador puede declarar sin OTP, pero no revisar terceros sin autorización.
 admin=b.new_page(viewport={'width':1200,'height':840})
 admin.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
 admin.add_style_tag(content=(root/'styles.css').read_text());admin.add_script_tag(content=mock)
 for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
  admin.add_script_tag(content=(root/name).read_text())
 admin.wait_for_timeout(120)
 admin.locator('#landing_faculty').select_option('fce');admin.locator('#facultySelectionForm button[type="submit"]').click();admin.locator('[data-role="faculty_admin"]').click()
 for k,v in fields.items():admin.locator(f'#profileForm [name="{k}"]').fill(v)
 admin.locator('#profileForm [name="education_level"][value="SECUNDARIA"]').check()
 admin.locator('#profileForm button[type="submit"]').click();admin.wait_for_timeout(200)
 assert admin.evaluate('window.mock.otp')==0,'La declaración del administrador tampoco requiere OTP'
 assert admin.evaluate('window.mock.calls')[0]['action']=='create'
 admin.locator('[data-nav="validacion"]').first.click();admin.wait_for_timeout(150)
 assert admin.locator('#facultyAuthForm').count()==1, 'La revisión de terceros debe permanecer protegida'
 admin.close()
 print('OK V19.1.7 formulario: celular opcional, sin recuadro ni casilla, registro directo, sin OTP')
 assert not err,err
 b.close()
