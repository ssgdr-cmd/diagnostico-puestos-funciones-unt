"""Pruebas UI: datos simulados, sin conexión real a Supabase."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
mock_js=r'''
window.UNT_CONFIG={demo:false,supabaseUrl:'https://mock.supabase.co',supabaseAnonKey:'sb_publishable_mock',aiMode:'local'};
window.mock={session:null,otpSent:0,calls:[],events:[]};
window.supabase={createClient:()=>({
 auth:{
  getSession:async()=>({data:{session:window.mock.session},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signOut:async()=>{window.mock.session=null;return {error:null}},
  signInWithOtp:async({email,options})=>{window.mock.otpSent++;window.mock.events.push({kind:'otp',email,create:options.shouldCreateUser});return {error:null}},
  verifyOtp:async({email,token,type})=>{if(token!=='123456'||type!=='email')return {error:new Error('OTP incorrecto')};
   window.mock.session={access_token:'jwt_'+email,user:{id:'uid-review',email,email_confirmed_at:'2026-11-03T12:00:00Z'}};
   return {data:{session:window.mock.session},error:null};}
 }
})};
const fetchOrig=window.fetch.bind(window);
window.fetch=async function(url,opts){
 if(String(url).includes('/functions/v1/')){
  const b=JSON.parse(opts.body);window.mock.calls.push({endpoint:String(url).split('/').pop(),action:b.action,auth:opts.headers.Authorization||'',body:b});
  if(b.action==='list')return new Response(JSON.stringify({ok:true,records:[],dispatches:[]}),{status:200});
  if(b.action==='coverage')return new Response(JSON.stringify({ok:true,coverage:{expected:2,completed:1,missing:1,pending:0,identity_issues:0}}),{status:200});
  if(b.action==='recover_supervised')return new Response(JSON.stringify({ok:true,id:'12345678-1234-1234-1234-123456789000',editToken:'a'.repeat(64),receipt:'UNT-2026-1234',status:'draft'}),{status:200});
  if(b.action==='get')return new Response(JSON.stringify({ok:true,record:{id:b.record_id,receipt_code:'UNT-2026-1234',faculty_id:'fce',profile:{role:'staff',faculty_id:'fce',institutional_email:'prueba@unitru.edu.pe',dni:'12345678',first_names:'ANA',last_names:'PEREZ',worker_code:'UNT-TEST-1'},content:{functions:[],authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}},status:'draft',revision_no:1}}),{status:200});
  return new Response(JSON.stringify({ok:false,error:'Acceso no autorizado'}),{status:403});
 }
 return fetchOrig(url,opts);
};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def build():
  page=browser.new_page(viewport={'width':1280,'height':850}); errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
  page.add_style_tag(content=(root/'styles.css').read_text());page.add_script_tag(content=mock_js)
  for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
   page.add_script_tag(content=(root/name).read_text())
  page.wait_for_timeout(200)
  return page,errors
 # Reviewer OTP: verified browser session and successful faculty API authorization.
 page,errors=build()
 page.locator('#landing_faculty').select_option('fce');page.locator('#facultySelectionForm button[type="submit"]').click()
 page.locator('[data-role="faculty_admin"]').click()
 page.locator('[data-nav="validacion"]').click()
 page.locator('[data-action="faculty-login-open"]').click()
 assert page.locator('#facultyAuthForm').count()==1
 page.locator('#reviewer_email').fill('revisor@unitru.edu.pe');page.locator('#facultyAuthForm button[type="submit"]').click()
 page.wait_for_timeout(200)
 assert page.locator('[data-action="send-identity-code"]').count()==1
 page.locator('[data-action="send-identity-code"]').click();page.wait_for_timeout(150)
 assert page.evaluate('window.mock.otpSent')==1
 assert page.evaluate('window.mock.events[0].create')==False
 page.locator('#identity_code').fill('123456');page.locator('#identityCodeForm button[type="submit"]').click()
 page.wait_for_timeout(350)
 calls=page.evaluate('window.mock.calls')
 assert any(c['action']=='list' and c['auth']=='Bearer jwt_revisor@unitru.edu.pe' for c in calls),calls
 assert any(c['action']=='coverage' for c in calls),calls
 assert '1 de 2 trabajadores' in page.locator('body').inner_text()
 assert not errors,errors
 print('OK revisor OTP: ingreso sin enlace, credenciales autorizadas, cobertura visible')
 page.close()
 # Recovery: grant assumed authorized only by mocked Edge; UI requires OTP and calls server.
 page,errors=build()
 page.locator('[data-action="recover-open"]').click()
 assert page.locator('#recoverSupervisedForm').count()==1
 page.locator('#recoverSupervisedForm [name="faculty_id"]').select_option('fce')
 page.locator('#recoverSupervisedForm [name="worker_code"]').fill('UNT-TEST-1')
 page.locator('#recoverSupervisedForm [name="institutional_email"]').fill('prueba@unitru.edu.pe')
 page.locator('#recoverSupervisedForm button[type="submit"]').click();page.wait_for_timeout(150)
 assert page.locator('[data-action="send-identity-code"]').count()==1
 page.locator('[data-action="send-identity-code"]').click();page.wait_for_timeout(150)
 page.locator('#identity_code').fill('123456');page.locator('#identityCodeForm button[type="submit"]').click();page.wait_for_timeout(350)
 calls=page.evaluate('window.mock.calls');assert any(c['action']=='recover_supervised' for c in calls),calls
 assert any(c['action']=='get' for c in calls),calls
 assert page.locator('.recovery-banner').count()>=1
 assert not errors,errors
 print('OK recuperación supervisada: OTP, rotación de clave simulada y ficha recuperada')
 page.close();browser.close()
