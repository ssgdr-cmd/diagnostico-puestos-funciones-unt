"""Ensayo visual autocontenido: inyecta los scripts del proyecto en Chromium,
porque el navegador del entorno bloquea abrir rutas locales/localhost.
La navegación real en GitHub Pages y Supabase requiere otra prueba integral.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1366,'height':850})
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="app" aria-live="polite"></div><div id="toast"></div></body></html>')
 page.add_style_tag(content=(root/'styles.css').read_text())
 page.add_script_tag(content='window.UNT_CONFIG={demo:true,aiMode:"local",orgName:"Universidad Nacional de Trujillo",systemName:"Diagnóstico Facultades"};')
 for name in ['data.js','docx.js','xlsx.js','redaccion-local.js','interpretacion-v17.js','interpretacion-v18.js','app.js']:
  page.add_script_tag(content=(root/name).read_text())
 page.wait_for_timeout(250)
 assert page.locator('#landing_faculty option').count()==14,'Debe mantener las 13 facultades + placeholder'
 assert 'Diagnóstico de' in page.locator('h1').inner_text()
 print('OK portada institucional y 13 facultades')
 page.locator('#landing_faculty').select_option('fce')
 page.locator('#facultySelectionForm button[type=submit]').click()
 page.wait_for_timeout(180)
 assert page.locator('[data-role="staff"]').count()>=1,'Debe ofrecer servidor administrativo'
 page.locator('[data-role="staff"]').first.click()
 page.wait_for_timeout(180)
 assert page.locator('#profileForm').count()==1,'Debe conservar formulario identificación'
 assert page.evaluate('Boolean(window.UNT_LOCAL_ASSISTANT?.generate)'),'Autoasistente no cargado'
 assert not errs,f'Errores JS: {errs[:4]}'
 print('OK navegación servidor, formulario y asistente local')
 # Integración del asistente dentro del formulario, no como portada independiente.
 profile_btn=page.locator('#profileForm button[type="submit"]')
 if profile_btn.count():
  profile_btn.first.click();page.wait_for_timeout(250)
  assistant=page.locator('[data-action="ai-open"]')
  if assistant.count():
   assistant.first.click();page.wait_for_timeout(150)
   assert page.locator('.ai-drawer').count()==1,'No abrió el asistente integrado'
   assert 'IA externa' not in page.locator('.ai-drawer').inner_text()
   print('OK asistente integrado sin opción de IA externa')
   page.locator('[data-action="ai-close"]').last.click()
 # Módulo URH para gestión de revisores.
 page.locator('[data-action="logout"]').first.click();page.wait_for_timeout(180)
 page.locator('[data-role="urh_admin"]').first.click();page.wait_for_timeout(150)
 page.locator('[data-nav="revisores"]').first.click();page.wait_for_timeout(150)
 assert page.locator('#reviewerForm').count()==1,'No existe pantalla de autorizaciones de facultad'
 print('OK módulo URH de accesos de revisores')
 browser.close()
