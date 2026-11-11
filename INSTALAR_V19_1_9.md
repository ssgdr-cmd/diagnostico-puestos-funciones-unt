# Instalación V19.1.9 — SOLO GitHub Web y Supabase Web

**No borrar repositorios ni bases de datos.** Haz una copia de seguridad antes de modificar producción.

1. **Supabase → SQL Editor**: ejecuta una sola vez `supabase/migracion_v19_1_9_equipos_compartidos.sql`, después de V19.1.4. Es necesaria para que un borrador abandonado (incluida la ficha de administrador) no impida que otro usuario inicie de cero en una computadora compartida. **No elimina datos**.
2. **GitHub Web → Code → Add file → Upload files**: carga los archivos del ZIP de actualización, conservando sus rutas. Sustituye `app.js`, `index.html` y los documentos nuevos. Confirma con `Commit changes`.
3. **Supabase → Edge Functions → unt-registros → Code**: sustituye `index.ts` por el del ZIP y despliega la actualización.
4. **Supabase → Edge Functions → unt-faculty-supervised → Code**: si la función ya está desplegada, actualiza su `index.ts` y despliega los cambios. Esta función protege la validación de expedientes ajenos.
5. **Abre GitHub Pages con Ctrl + F5** y prueba con datos ficticios: servidor, decano y administrador; crea/guarda una ficha, pulsa «Finalizar y salir» y confirma que el siguiente servidor empieza con el formulario vacío.

## Lo que ya no existe

No hay recuperación pública, contraseña de ficha, OTP ni botón «Continuar desde este dispositivo». No se recupera automáticamente un expediente de otra persona.

## Importante

- Se mantiene el guardado en la API mientras la pestaña esté abierta.
- **No cierres la pestaña antes de presentar**: por protección de datos de equipos compartidos, el borrador no será accesible desde el mismo navegador al volver.
- Si una ficha ya fue presentada, la URH debe revisar cualquier duplicidad o subsanación. El servidor no puede consultar fichas anteriores a partir del código de trabajador.
- La autorización de revisores y URH sigue protegida; no se publican expedientes ni claves privadas.
- Esta entrega pasó pruebas locales con una API simulada, pero debe probarse con Supabase real antes de usar información institucional.
