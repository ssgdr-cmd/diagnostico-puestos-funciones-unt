# INSTALACIÓN — FACULTADES UNT V19.1.6, acceso directo sin correos ni códigos

## A. Actualizar utilizando únicamente GitHub Web

Ya existe un repositorio de la cuenta `ssgdr-cmd`. **No eliminarlo.**

1. Hacer una copia de seguridad (Code → Download ZIP) del repositorio actual.
2. Descargar y descomprimir `UNT_FACULTADES_V19_1_6_ACTUALIZACION_GITHUB.zip`.
3. Abrir el repositorio → **Code → Add file → Upload files**. Seleccionar los archivos y carpetas **que están dentro** de la carpeta descomprimida; no subir el ZIP como un único archivo ni crear una carpeta contenedora en la raíz.
4. Sustituir `app.js` e `index.html` de la raíz. Confirmar que el nuevo `index.html` carga `app.js?v=1916`.
5. Sustituir `supabase/functions/unt-registros/index.ts` respetando su carpeta; GitHub debe mostrar la ruta completa.
6. Confirmar con **Commit changes**. Ejemplo: `FACULTADES UNT V19.1.6 - acceso directo, sin OTP`.
7. En Settings → Pages, confirmar Source `Deploy from a branch`, Branch `main`, Folder `/(root)`.
8. Abrir la URL del sitio y recargar con **Ctrl+F5**. Comprobar que se ve la portada de 13 facultades.

**La actualización en GitHub Pages SOLO modifica la interfaz estática.** Si el backend anterior exigía OTP, la creación/guardado todavía puede fallar hasta actualizar Supabase según B.

## B. Actualizar el backend de Supabase

El backend es **Supabase Edge Functions**, no un servicio externo de IA.

- Desplegar la versión incluida en `supabase/functions/unt-registros/index.ts` dentro del **mismo proyecto Supabase** que usa `config.js`.
- Si el repositorio tiene `.github/workflows/desplegar-api-supabase.yml`, ejecutar manualmente **Actions → Desplegar API FACULTADES UNT → Run workflow**. El repositorio debe tener los secretos `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_ID` configurados por el responsable técnico. Si el flujo no aparece, crear el archivo mediante GitHub Web o utilizar la opción de edición/despliegue disponible en el panel de Edge Functions de Supabase.
- No colocar jamás `service_role`, `UNT_DATABASE_SECRET` ni otras claves privadas en `config.js`, documentos públicos ni repositorio.
- En los secretos del proyecto Supabase, `UNT_ALLOWED_ORIGINS` debe contener el origen **`https://ssgdr-cmd.github.io`**, sin la ruta del repositorio; `UNT_RATE_SALT` debe contener un valor aleatorio privado.
- Para el cotejo institucional, `UNT_REQUIRE_ROSTER=true` exige que `unt_staff_roster` esté cargado y actualizado. La declaración del administrador exige padrón habilitado y correo autorizado en `unt_faculty_reviewers`, sin necesitar OTP.
- La función pública `unt-registros` puede aceptar peticiones sin JWT solo porque aplica controles propios por acción, secreto aleatorio de edición, límite de solicitudes y cotejo opcional con padrón. **No trasladar esa política a tablas de datos ni a la función de revisión.**
- La función protegida `unt-faculty-supervised` exige una sesión Supabase Auth y autorización de la URH/revisor; utiliza cuentas de revisión existentes con contraseña. No se debe habilitar acceso anónimo a datos de terceros.

**No enviar correos OTP:** el código frontend no llama `signInWithOtp`, `verifyOtp` ni muestra ventanas de verificación. La URH y los revisores usan cuentas creadas y habilitadas previamente por el administrador de Supabase. Si la política de Auth solicita verificar correos durante la creación de esas cuentas, prehabilitarlas por el procedimiento administrativo autorizado; este aplicativo no envía mensajes.

## C. Control mínimo de aceptación (con datos ficticios)

1. Entrar a las 13 facultades, sin error de JavaScript.
2. Probar **Personal administrativo** y continuar hasta identificación sin ventana OTP.
3. Probar **Decano o director** sin ventana OTP.
4. Probar **Administrador de facultad**: su declaración propia es directa; la API coteja el padrón/autorización, no exige OTP.
5. Crear un borrador, guardarlo y recargar el mismo navegador. Comprobar que no se pierden cambios.
6. Presentar la ficha y comprobar su estado en Supabase.
7. Con una cuenta de revisor habilitada, verificar que únicamente accede a su facultad. Ningún tercero anónimo debe poder descargar fichas.
8. Revisar permisos de URH, remisiones Word y registros de auditoría.

## D. Limitaciones y protección de datos

- **Sin correo OTP se simplifica la presentación, pero no se acredita electrónicamente la identidad.** La URH debe verificar el padrón y las declaraciones mediante procedimiento institucional.
- No se puede garantizar recuperación desde otro navegador sin una credencial o una intervención supervisada; no ofrecer búsqueda pública por DNI o código de trabajador.
- No se han ejecutado migraciones ni pruebas contra el Supabase de la UNT desde este paquete. El código se entrega **listo para ensayo**, no certificado para producción.
