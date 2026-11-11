"""Prueba de la interfaz OTP con servicios simulados: NO usa datos reales ni Supabase de producción."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
mock_js=r'''
window.UNT_CONFIG={demo:false,supabaseUrl:'https://mock.supabase.co',supabaseAnonKey:'sb_publishable_mock',aiMode:'local'};
window.mock={session:null, otpSent:0, lastEmail:'',calls:[],getResponse:null};
window.supabase={createClient:()=>({
 auth:{
   getSession:async()=>({data:{session:window.mock.session},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}}),
   signInWithOtp:async({email})=>{window.mock.otpSent++;window.mock.lastEmail=email;return {error:null};},
   verifyOtp:async({email,token})=>{if(token!=='123456')return {error:new Error('Código incorrecto')};
    window.mock.session={access_token:'jwt_verified',user:{id:'uid-1',email,email_confirmed_at:'2026-11-03T12:00:00Z'}};
    return {data:{session:window.mock.session},error:null};}
 }
})};
const originalFetch=window.fetch.bind(window);
window.fetch=async function(url,opts){
 if(String(url).includes('/functions/v1/unt-registros')){
  const b=JSON.parse(opts.body);window.mock.calls.push({action:b.action,auth:opts.headers.Authorization||'',email:b.profile?.institutional_email});
  if(b.action==='create')return new Response(JSON.stringify({ok:true,id:'12345678-1234-1234-1234-123456789000',editToken:'a'.repeat(64),receipt:'UNT-2026-1234',status:'draft',revision_no:1}),{status:200});
  if(b.action==='get')return new Response(JSON.stringify({ok:true,record:{id:b.record_id,receipt_code:'UNT-2026-1234',faculty_id:'fce',profile:{role:'staff',faculty_id:'fce',institutional_email:'prueba@unitru.edu.pe',dni:'12345678'},content:{functions:[],authority:{}},status:'draft',revision_no:1}}),{status:200});
  return new Response(JSON.stringify({ok:true,receipt:'UNT-2026-1234',revision_no:2,status:'draft',updated_at:new Date().toISOString()}),{status:200});
 }
 return originalFetch(url,opts);
};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900})
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8" /></head><body><div id="app"></div><div id="toast"></div></body></html>')
 page.add_style_tag(content=(root/'styles.css').read_text())
 page.add_script_tag(content=mock_js)
 for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
  page.add_script_tag(content=(root/name).read_text())
 page.wait_for_timeout(200)
 page.locator('#landing_faculty').select_option('fce')
 page.locator('#facultySelectionForm button[type="submit"]').click()
 page.locator('[data-role="staff"]').click()
 fields={'last_names':'PEREZ RAMIREZ','first_names':'MARIA LUISA','dni':'12345678','worker_code':'UNT-TEST-9','job_title':'ASISTENTE ADMINISTRATIVO','address':'TRUJILLO URBANA','phone':'987654321','institutional_email':'prueba@unitru.edu.pe','personal_email':'prueba@example.com','org_unit':'SECRETARIA ACADEMICA'}
 for k,v in fields.items():page.locator(f'#profileForm [name="{k}"]').fill(v)
 page.locator('#profileForm [name="education_level"][value="SECUNDARIA"]').check()
 page.locator('#profileForm button[type="submit"]').click()
 page.wait_for_timeout(150)
 assert page.locator('[data-action="send-identity-code"]').count()==1,'Debe solicitar verificación institucional'
 assert page.evaluate('window.mock.calls.length')==0,'No debe crear fichas antes de verificar el correo'
 page.locator('[data-action="send-identity-code"]').click()
 page.wait_for_timeout(150)
 assert page.evaluate('window.mock.otpSent')==1
 assert page.locator('#identityCodeForm').count()==1
 page.locator('#identity_code').fill('123456')
 page.locator('#identityCodeForm button[type="submit"]').click()
 page.wait_for_timeout(350)
 calls=page.evaluate('window.mock.calls')
 assert len(calls)==1 and calls[0]['action']=='create' and calls[0]['auth']=='Bearer jwt_verified',calls
 assert page.locator('.recovery-banner').count()==1,'El borrador debe ofrecer recuperación tras verificar'
 print('OK verificación OTP, bloqueo de creación anónima y guardado autenticado')
 assert not errs,errs[:5]
 browser.close()
