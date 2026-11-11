"""Pruebas de regresión en Chromium con estado y API simulados. No accede a Supabase real."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]

def script_with_test_hooks():
    src=(root/'app.js').read_text()
    old='init();\n})();'
    assert src.count(old)==1
    return src.replace(old,"""window.__TEST_V1914__={state,render,forwardDispatch,downloadDispatchWord,
      setApi(fn){facultyApi=fn},setRemote(fn){loadRemote=fn},setFaculty(fn){loadFacultyRecords=fn}};
})();""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1366,'height':900},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
    page.add_style_tag(content=(root/'styles.css').read_text())
    page.add_script_tag(content='window.UNT_CONFIG={demo:false};')
    for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js']:
        page.add_script_tag(content=(root/name).read_text())
    page.add_script_tag(content=script_with_test_hooks())
    page.evaluate("""() => {
        const f=window.UNT_DATA.faculties;
        window.testFaculties=[f[0].id,f[1].id];
        const a=window.__TEST_V1914__;
        const fac=f[1].id;
        a.state.selectedFaculty=f[0].id;
        a.state.filterFaculty=f[0].id;
        a.state.role='urh_admin';a.state.screen='workspace';a.state.nav='oficios';
        a.state.session={user:{id:'uid-urh'}};
        const content={functions:[],authority:{needs:[],revisions:[],outsourcing:[],difficulties:[]}};
        a.state.records=[
          {id:'r1',faculty_id:fac,owner_name:'TRABAJADOR UNO',worker_code:'T01',status:'forwarded',content,profile:{}},
          {id:'r2',faculty_id:fac,owner_name:'TRABAJADOR DOS',worker_code:'T02',status:'validated',content,profile:{}},
          {id:'r3',faculty_id:fac,owner_name:'TRABAJADOR TRES',worker_code:'T03',status:'submitted',content,profile:{}}
        ];
        a.state.dispatches=[
          {id:'d-old',faculty_id:fac,tracking_code:'UNT-PREV',status:'forwarded',items_count:1,
           office_number:'OFICIO 001',forwarded_at:'2026-11-01T10:00:00Z',
           snapshot:{type:'parcial',partial:true,records:[{id:'r1',name:'TRABAJADOR UNO',worker_code:'T01',content}] }},
          {id:'d-new',faculty_id:fac,tracking_code:'UNT-NUEVO',status:'prepared',items_count:1,
           snapshot:{type:'complementaria',partial:false,
             previous_dispatches:[{tracking_code:'UNT-PREV',office_number:'OFICIO 001',items_count:1}],
             records:[{id:'r2',name:'TRABAJADOR DOS',worker_code:'T02',content}]}}
        ];
        window.calls=[];window.loads=[];
        a.setApi(async (action,params)=>{window.calls.push({action,params});return {ok:true}});
        a.setRemote(async ()=>window.loads.push('urh'));
        a.setFaculty(async ()=>window.loads.push('facultad'));
        a.render();
        window.docs=[];
        window.UNT_DOCX.buildOffice=(data)=>{window.docs.push(data);return new Blob(['DOCX-TEST'])};
    }""")
    result=page.evaluate("""async () => {
      const a=window.__TEST_V1914__;
      await a.forwardDispatch('d-new','OFICIO 002','EXP-002');
      return {calls:window.calls,loads:window.loads};
    }""")
    assert result['calls'][0]['action']=='forward',result
    assert result['calls'][0]['params']['faculty_id']==page.evaluate('window.testFaculties[1]'),result
    assert result['loads']==['urh'],result
    print('OK URH: la remisión utiliza la facultad del documento y actualiza su panel')
    page.evaluate("""() => {
       const a=window.__TEST_V1914__;
       a.state.filterFaculty=window.testFaculties[1];a.render();
       a.downloadDispatchWord('d-new');
    }""")
    saved=page.evaluate('window.docs.at(-1)')
    assert saved['kind']=='complementaria'
    assert saved['faculty']
    assert [r['id'] for r in saved['records']]==['r2'],saved
    assert saved['previousDispatches'][0]['office_number']=='OFICIO 001'
    print('OK complemento: solo registro nuevo y referencia del oficio anterior')
    page.evaluate("""() => window.__TEST_V1914__.downloadDispatchWord(null,'consolidated')""")
    saved=page.evaluate('window.docs.at(-1)')
    assert saved['kind']=='consolidado' and {r['id'] for r in saved['records']}=={'r1','r2'},saved
    assert saved['previousDispatches'][0]['tracking_code']=='UNT-PREV'
    print('OK consolidado: dos fichas (previamente remitida y nueva), sin crear remisión')
    page.evaluate("""() => window.__TEST_V1914__.downloadDispatchWord()""")
    saved=page.evaluate('window.docs.at(-1)')
    assert saved['kind']=='preview' and [r['id'] for r in saved['records']]==['r2'],saved
    print('OK vista preliminar: incluye solo fichas validadas pendientes de remisión')
    assert not errors,errors
    print('OK sin excepciones de JavaScript en navegador')
    browser.close()
