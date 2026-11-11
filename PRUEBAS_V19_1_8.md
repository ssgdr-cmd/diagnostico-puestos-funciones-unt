# Pruebas V19.1.8

Pruebas locales realizadas (no incluyen una sesión en el Supabase institucional):

- `node --check app.js`: sin errores de sintaxis.
- Transpilación de `supabase/functions/unt-registros/index.ts` con TypeScript: sin errores.
- `node tests/probar_registro_flexible_v1918.cjs`: tres perfiles (`staff`, `authority`, `faculty_admin`), creación, guardado y presentación, persistencia de dos grados y un título, control de rol privilegiado y de origen.
- `python tests/probar_interfaz_educacion_y_registro_v1918.py`: Chromium con red simulada, selector Técnico/Superior, grado de bachiller técnico, grados Bachiller/Maestría, título, guardado por tres perfiles y circuito de necesidades + presentación de autoridad.
- `node tests/probar_motor_local.cjs`: 5/5 pruebas existentes de redacción contextual.
- `node tests/probar_autoguardado.cjs`: prueba de cambios concurrentes.
- `node tests/probar_documentos_v1914.cjs`: cuatro casos de exportación Word.

Los scripts antiguos V19.1.5–V19.1.7 que exigían bloqueo del registro sin padrón fueron archivados en `tests/legacy/historico_v1915_v1917`, ya que esa política fue sustituida expresamente en esta versión. Su resultado anterior no debe confundirse con una prueba fallida de la política V19.1.8.

Pendiente de validar en producción: respuesta efectiva del Supabase existente, índices/triggers con registros previos, CORS, autorización por facultad y exportación con fichas reales anonimizadas.
