"""Recorrido funcional UI de DEMO, sin Supabase real."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 c=b.new_context(accept_downloads=True,viewport={'width':1450,'height':920})
 page=c.new_page(); errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app"></div><div id="toast"></div></body></html>')
 page.add_style_tag(content=(root/'styles.css').read_text())
 page.add_script_tag(content="window.UNT_CONFIG={demo:true,aiMode:'local'};")
 for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
  page.add_script_tag(content=(root/name).read_text())
 page.select_option('#landing_faculty','fce')
 page.locator('#facultySelectionForm button[type=submit]').click()
 page.locator('[data-role=faculty_admin]').click()
 page.locator('[data-nav=conformidad]').click()
 print('review item count',page.locator('.faculty-review-item').count())
 assert page.locator('.faculty-review-item').count()>0
 page.locator('#faculty_reviewer_name').fill('ADMINISTRADOR DE PRUEBA')
 # Force a changed field without saving: Word individual should be blocked.
 first=page.locator('.faculty-review-item').first
 first.locator('summary').click()
 textarea=first.locator('[data-rfield=function]').first
 original=textarea.input_value()
 textarea.fill('FUNCIÓN MODIFICADA SIN GUARDAR')
 first.locator('[data-action=faculty-word]').click()
 assert 'Primero guarde las modificaciones' in page.locator('#toast').inner_text()
 # Revert, mark all loaded demo records as reviewed
 textarea.fill(original)
 for _ in range(page.locator('[data-action=faculty-mark][data-checked="true"]').count()):
  page.locator('[data-action=faculty-mark][data-checked="true"]').first.click()
 assert page.locator('[data-action=faculty-mark][data-checked="true"]').count()==0
 with page.expect_download(timeout=10000) as dl:
  page.locator('[data-action=faculty-all-word]').click()
 assert dl.value.suggested_filename.endswith('.docx')
 # Descarga válida, no se conserva información ficticia en el repositorio
 print('WORD',dl.value.suggested_filename)
 print('errors',errors)
 assert not errors
 # No se generan capturas permanentes desde la prueba automatizada.
 c.close();b.close()
