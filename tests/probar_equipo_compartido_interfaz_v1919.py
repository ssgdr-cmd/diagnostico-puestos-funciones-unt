"""Prueba de interfaz con storage simulado (sin red ni datos reales)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
MOCK=r'''
const fakeStore=()=>{const mem=new Map();return {getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)}};
Object.defineProperty(window,'localStorage',{configurable:true,value:fakeStore()});
Object.defineProperty(window,'sessionStorage',{configurable:true,value:fakeStore()});
localStorage.setItem('unt.v19.resume','{"token":"OLD_TOKEN","id":"old"}');
sessionStorage.setItem('unt.v19.resume','{"token":"OLD_SESSION","id":"old"}');
localStorage.setItem('unt.faculty','fce');
localStorage.setItem('sb-qozxijrcadbegqubmden-auth-token','OLD_AUTH');
window.UNT_CONFIG={demo:false,supabaseUrl:'https://qozxijrcadbegqubmden.supabase.co',supabaseAnonKey:'sb_publishable_example',aiMode:'local'};
window.supabase={createClient:(url,key,options)=>{window.authOptions=options.auth;return {auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>{},signOut:async()=>({error:null})}}}};
window.unt_calls=[];window.fetch=async (url,opts)=>{
 if(String(url).includes('/functions/v1/unt-registros')){
  const b=JSON.parse(opts.body);window.unt_calls.push(b);
  if(b.action==='create')return new Response(JSON.stringify({ok:true,id:'12345678-1234-1234-1234-123456789012',editToken:'a'.repeat(64),receipt:'UNT-TEST',status:'draft',revision_no:1}),{status:200});
  if(b.action==='save')return new Response(JSON.stringify({ok:true,id:b.record_id,receipt:'UNT-TEST',status:'draft',revision_no:b.revision_no+1}),{status:200});
  if(b.action==='submit')return new Response(JSON.stringify({ok:true,id:b.record_id,receipt:'UNT-TEST',status:'submitted',revision_no:b.revision_no+1}),{status:200});
  return new Response(JSON.stringify({ok:false,error:'unexpected action'}),{status:400});
 }
 return new Response('{}',{status:200});
};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for role in ['staff','authority','faculty_admin']:
  page=browser.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
  page.add_style_tag(content=(ROOT/'styles.css').read_text())
  page.add_script_tag(content=MOCK)
  for f in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
   page.add_script_tag(content=(ROOT/f).read_text())
  page.wait_for_timeout(200)
  assert page.locator('#landing_faculty').count()==1,errors
  assert page.get_by_text('Recuperar ficha existente').count()==0
  keys=page.evaluate('({local:localStorage.getItem("unt.v19.resume"),session:sessionStorage.getItem("unt.v19.resume"),faculty:localStorage.getItem("unt.faculty"),auth:localStorage.getItem("sb-qozxijrcadbegqubmden-auth-token")})')
  assert all(v is None for v in keys.values()),(role,keys)
  assert page.evaluate('window.authOptions.persistSession') is False
  assert page.locator('#landing_faculty').input_value()==''
  page.select_option('#landing_faculty','fce');page.locator('#facultySelectionForm button[type=submit]').click()
  page.locator(f'[data-role="{role}"]').first.click()
  assert page.locator('#profileForm').count()==1
  assert page.locator('[data-action="recover-open"]').count()==0
  page.fill('#last_names','PEREZ');page.fill('#first_names','ANA');page.fill('#worker_code','SHARED-'+role)
  page.locator('#profileForm button[type=submit]').click();page.wait_for_timeout(250)
  assert page.locator('#profileForm').count()==0,(role,page.locator('#toast').inner_text())
  assert page.evaluate('window.unt_calls.map(x=>x.action)')[0]=='create'
  assert page.evaluate('localStorage.getItem("unt.v19.resume")') is None
  assert page.evaluate('sessionStorage.getItem("unt.v19.resume")') is None
  assert page.evaluate('localStorage.getItem("unt.faculty")') is None
  page.locator('[data-action="logout"]').first.click();page.wait_for_timeout(180)
  assert page.locator('#landing_faculty').count()==1
  assert page.locator('#landing_faculty').input_value()==''
  page.select_option('#landing_faculty','fce');page.locator('#facultySelectionForm button[type=submit]').click();page.locator('[data-role="staff"]').first.click()
  assert page.locator('#last_names').input_value()==''
  assert page.locator('#first_names').input_value()==''
  assert page.locator('#worker_code').input_value()==''
  assert not errors,(role,errors)
  print('OK',role,'no recovery button, no persisted credentials, clean next user')
  page.close()
 browser.close()
