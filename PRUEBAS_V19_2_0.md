# Pruebas V19.2.0

- Sintaxis del frontend y generador Word mediante `node --check`: correcta.
- Transpilación TypeScript de `unt-registros` y `unt-faculty-supervised`: 0 diagnósticos.
- Chromium/Playwright (datos ficticios): servidores, administradores y autoridades avanzan, presentan y descargan Word sin OTP; acta de conformidad sin autenticación.
- Motor autoasistente contextual local: 5/5 pruebas existentes.
- Autoguardado concurrente: prueba local superada.
- Documentos de remisión histórica: 4/4 pruebas existentes.
- Ficha y acta Word: ZIP DOCX íntegro; apertura y renderización visual en LibreOffice comprobadas con Arial 11 y firmas.

**No se ha probado la operación contra Supabase real ni la política del usuario URH en producción.** Requiere validación institucional antes del uso con información personal real.
