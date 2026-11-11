from playwright.sync_api import sync_playwright
import json, uuid
URL='http://127.0.0.1:8878/'
records={}
def route_api(route,request):
    payload=request.post_data_json if request.method=='POST' else {}
    action=payload.get('action'); rid=payload.get('record_id')
    if action=='create':
        rid=str(uuid.uuid4());data={'ok':True,'id':rid,'editToken':'a'*64,'receipt':'UNT-TEST','status':'draft','revision_no':1}
        records[rid]={'profile':payload['profile'],'content':payload['content'],'role':payload['role'],'revision_no':1}
    elif action=='save':
        assert rid in records
        records[rid]['profile']=payload['profile'];records[rid]['content']=payload['content'];records[rid]['revision_no']+=1
        data={'ok':True,'id':rid,'receipt':'UNT-TEST','status':'draft','revision_no':records[rid]['revision_no']}
    elif action=='submit':
        records[rid]['profile']=payload['profile'];records[rid]['content']=payload['content'];records[rid]['status']='submitted';records[rid]['revision_no']+=1
        data={'ok':True,'id':rid,'receipt':'UNT-TEST','status':'submitted','revision_no':records[rid]['revision_no']}
    else: data={'ok':False,'error':'Not mocked'}
    route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'http://127.0.0.1:8878'},body=json.dumps(data))
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for role in ['staff','faculty_admin','authority']:
    context=browser.new_context(viewport={'width':1350,'height':900})
    page=context.new_page()
    console_errors=[]
    page.on('pageerror',lambda e:console_errors.append(str(e)))
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
    from pathlib import Path
    root=Path(__file__).resolve().parents[1]
    page.add_style_tag(content=(root/'styles.css').read_text())
    mock_js=r"""
      window.UNT_CONFIG={demo:false,supabaseUrl:'https://sample.supabase.co',supabaseAnonKey:'sb_publishable_demo',aiMode:'local'};
      window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})}})};
      window.frontendCalls=[];
      window.fetch=async (url,opt)=>{
        if(String(url).includes('/functions/v1/unt-registros')){
          const b=JSON.parse(opt.body);window.frontendCalls.push(b);
          if(b.action==='create')return new Response(JSON.stringify({ok:true,id:'12345678-1234-1234-1234-'+String(window.frontendCalls.length).padStart(12,'0'),editToken:'a'.repeat(64),receipt:'UNT-TEST',status:'draft',revision_no:1}),{status:200});
          if(b.action==='save')return new Response(JSON.stringify({ok:true,id:b.record_id,status:'draft',revision_no:b.revision_no+1}),{status:200});
          if(b.action==='submit')return new Response(JSON.stringify({ok:true,id:b.record_id,status:'submitted',receipt:'UNT-TEST',revision_no:b.revision_no+1}),{status:200});
          return new Response(JSON.stringify({ok:false,error:'not mocked'}),{status:400});
        }
        return new Response('{}',{status:200});
      };
    """
    page.add_script_tag(content=mock_js)
    for file in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
        page.add_script_tag(content=(root/file).read_text())
    page.wait_for_timeout(150)
    page.select_option('#landing_faculty','fce')
    page.locator('#facultySelectionForm button[type=submit]').click()
    page.locator(f'[data-role="{role}"]').first.click()
    assert page.locator('#profileForm').count()==1,role
    page.fill('#last_names','PEREZ')
    page.fill('#first_names','ANA')
    page.fill('#worker_code',f'TEST-{role}')
    # technical dynamic dropdown including Bachiller Técnico
    page.locator('input[name="education_level"][value="TÉCNICO"]').check()
    assert page.locator('#academic_extra').is_visible(),role
    page.fill('#higher_detail','CONTABILIDAD')
    page.locator('[data-action="add-academic-grade"]').click()
    assert page.locator('[name="academic_grade_0_level"]').count()==1,role
    page.select_option('[name="academic_grade_0_level"]','BACHILLER TÉCNICO')
    page.fill('[name="academic_grade_0_name"]','CONTABILIDAD')
    page.locator('[data-action="add-academic-title"]').click()
    page.fill('[name="academic_title_0"]','TÉCNICO EN CONTABILIDAD')
    # switch university: should display degrees and permit several
    page.locator('input[name="education_level"][value="SUPERIOR"]').check()
    assert page.locator('[name="academic_grade_0_level"]').count()==1,role
    page.select_option('[name="academic_grade_0_level"]','BACHILLER')
    page.fill('[name="academic_grade_0_name"]','ECONOMÍA')
    page.locator('[data-action="add-academic-grade"]').click()
    page.select_option('[name="academic_grade_1_level"]','MAESTRÍA')
    page.fill('[name="academic_grade_1_name"]','GESTIÓN PÚBLICA')
    page.fill('#higher_detail','ECONOMÍA')
    if role=='staff':
      page.screenshot(path='/mnt/data/UNT_FACULTADES_V19_1_8_EDUCACION.png',full_page=True)
    page.locator('#profileForm button[type=submit]').click()
    page.wait_for_timeout(400)
    assert page.locator('#profileForm').count()==0,'Profile failed: '+role+' '+page.locator('#toast').inner_text()
    calls=page.evaluate('window.frontendCalls')
    assert calls and calls[0]['action']=='create',role
    row=calls[0]
    assert row['profile']['education_level']=='SUPERIOR',row['profile']
    assert len(row['profile']['academic_grades'])==2,row['profile']
    assert row['profile']['academic_titles'][0]['name']=='TÉCNICO EN CONTABILIDAD'
    if role=='authority':
      assert page.get_by_text('Necesidades funcionales de la unidad').count()>0
      page.locator('[data-action="add-need"][data-need="needs"]').click()
      page.locator('[name="need_needs_0_0"]').fill('ATENCIÓN ADMINISTRATIVA NECESARIA')
      page.locator('[data-action="save-draft"]').first.click()
      page.wait_for_timeout(400)
      calls=page.evaluate('window.frontendCalls')
      assert any(c['action']=='save' and c['content']['authority']['needs'][0][0]=='ATENCIÓN ADMINISTRATIVA NECESARIA' for c in calls),calls
    if role=='authority':
      page.locator('[data-action="next-step"]').last.click()
      page.wait_for_timeout(150)
      page.locator('[data-action="next-step"]').last.click()
      page.wait_for_timeout(150)
      assert page.locator('[data-action="submit-declaration"]').count()==1,'Authority review view missing submit'
      page.locator('[data-action="submit-declaration"]').click()
      page.wait_for_timeout(250)
      calls=page.evaluate('window.frontendCalls')
      assert any(c['action']=='submit' for c in calls),calls
    assert not console_errors,(role,console_errors)
    print('OK',role,'niveles → grados/títulos → guardado',len(calls))
    context.close()
  browser.close()
