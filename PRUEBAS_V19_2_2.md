# Pruebas de V19.2.2

- `node --check app.js` y `node --check docx.js`: superadas.
- Prueba del generador Word con dos servidores, funciones, actividades, indicadores, productos y observaciones: archivo DOCX válido (verificación ZIP).
- Renderización de ejemplo con el renderizador DOCX: encabezado y pies coherentes, sin texto cortado y con jerarquía de sangrías.
- Prueba Chromium del HTML autónomo: navegación a «Administrador de facultad», ficha desplegable, marcado de revisión y descarga real del oficio Word; sin errores JavaScript.
- El HTML local usa datos ficticios y no se conecta a Supabase. **No se ha hecho prueba de base de datos institucional ni certificación de producción.**
