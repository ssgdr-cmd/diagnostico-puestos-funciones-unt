from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for role in ('staff','faculty_admin','authority'):
        print('START',role,flush=True)
        ctx=browser.new_context(accept_downloads=True,viewport={'width':1360,'height':900})
        page=ctx.new_page(); errs=[]
        page.on('pageerror',lambda e: errs.append(str(e)))
        page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
        page.add_style_tag(content=(root/'styles.css').read_text())
        page.add_script_tag(content="window.UNT_CONFIG={demo:true,aiMode:'local'};")
        for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
            page.add_script_tag(content=(root/name).read_text())
        page.select_option('#landing_faculty','fce')
        page.locator('#facultySelectionForm button[type="submit"]').click()
        assert page.locator('form#facultyAuthForm').count()==0
        assert page.get_by_text('La revisión de fichas ajenas se realiza únicamente').count()==0
        page.locator(f'[data-role="{role}"]').first.click()
        assert page.locator('#profileForm').count()==1,role
        if role=='authority':
            assert page.locator('input[name="education_level"][value="SUPERIOR"]').count()==1
            assert page.locator('input[readonly][value*="SUPERIOR"]').count()>=1
            assert page.locator('input[name="education_level"][type="radio"]').count()==0
            page.locator('[data-action="add-academic-grade"]').click()
            page.locator('[name="academic_grade_0_level"]').select_option('BACHILLER')
            page.locator('[name="academic_grade_0_name"]').fill('DERECHO')
        page.locator('#last_names').fill('PÉREZ ROMERO')
        page.locator('#first_names').fill('ANA MARÍA')
        page.locator('#worker_code').fill('UNT-011')
        print('SUBMIT PROFILE',role,flush=True);page.locator('#profileForm button[type="submit"]').click()
        page.wait_for_timeout(150)
        assert page.locator('#profileForm').count()==0,role+' no avanzó: '+page.locator('#toast').inner_text()
        if role=='faculty_admin':
            print('CONFORMITY OPEN',flush=True);page.locator('[data-nav="conformidad"]').click()
            assert page.locator('#conformityForm').count()==1
            assert page.locator('input[type="password"]').count()==0
            page.locator('input[name="administrator"]').fill('ADMINISTRADOR PRUEBA')
            page.locator('textarea[name="entries"]').fill('UNT-2026-0001 | UNT-001 | PÉREZ ROMERO, ANA MARÍA')
            with page.expect_download() as dl:
                print('CONFORMITY DOWNLOAD CLICK',flush=True);page.locator('#conformityForm button[type="submit"]').click()
            download=dl.value
            assert download.suggested_filename.endswith('.docx')
            page.screenshot(path=str(root/'V1920_conformidad.png'),full_page=True)
            page.locator('[data-nav="registro"]').click()
        # Return to review step with actual demo content from fixtures
        print('NEXTSTEPS',role,flush=True)
        for i in range(2):
            page.locator('[data-action="next-step"]').click()
            page.wait_for_timeout(100)
        assert page.locator('[data-action="submit-declaration"]').count()==1,role
        print('SEND DECLARATION',role,flush=True);page.locator('[data-action="submit-declaration"]').click()
        page.wait_for_timeout(100)
        assert page.locator('[data-action="download-personal-word"]').count()==1,role
        with page.expect_download() as dl:
            print('DOWNLOAD PERSONAL',role,flush=True);page.locator('[data-action="download-personal-word"]').click()
        assert dl.value.suggested_filename.endswith('.docx')
        page.screenshot(path=str(root/f'V1920_{role}_submitted.png'),full_page=True)
        assert not errs,(role,errs)
        results.append(role+' OK')
        ctx.close()
    browser.close()
print(' / '.join(results))
