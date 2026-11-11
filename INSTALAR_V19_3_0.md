# Instalar FACULTADES UNT V19.3.0 desde el navegador

**Importante:** la demostración HTML separada NO almacena datos en Supabase. El ZIP del aplicativo sí incluye código real, pero su funcionamiento integral depende del backend y del rol URH existentes. No copie contraseñas, `service_role`, tokens ni secretos en GitHub.

## A. Respaldo y migraciones

1. Haga una copia de seguridad de la base y del repositorio. Pruebe primero en un proyecto de ensayo; el proyecto Supabase compartido anteriormente está identificado como **PRODUCTION**.
2. En `SQL Editor`, si su proyecto ya llegó a **V19.1.4**, instale **en este orden**:
   - `supabase/migracion_v19_1_9_equipos_compartidos.sql`
   - `supabase/migracion_v19_2_0_conformidad_documental.sql`
   - `supabase/migracion_v19_2_1_revision_facultad.sql`
   - `supabase/migracion_v19_3_0_consolidacion_urh.sql`
   Si las anteriores ya se aplicaron, ejecutar **únicamente** la nueva V19.3.0. **No vuelva a ejecutar migraciones históricas indiscriminadamente.**
3. Compruebe que existen `unt_faculty_review_links`, `unt_faculty_review_checks`, `unt_document_verifications` y `unt_staff_roster`. El padrón debe ser cargado por URH para mostrar cobertura porcentual (no se inventan metas).

## B. GitHub Pages

1. Mantenga el repositorio `ssgdr-cmd/diagnostico-puestos-funciones-unt`. Suba el contenido **descomprimido** del ZIP completo a la **raíz**, no el ZIP ni una carpeta contenedora.
2. Verifique que `index.html`, `app.js`, `styles.css`, `docx.js` y `supabase/functions` estén en sus rutas.
3. Verifique que `config.js` contiene solo `supabaseUrl`, la **clave publicable** (`sb_publishable_...`) y `demo:false`. **No publique claves secretas.**
4. GitHub → Settings → Pages: rama `main`, `/(root)`; conserve HTTPS.

## C. Edge Functions (Supabase)

Despliegue desde Supabase Dashboard → Edge Functions → función → Code → Deploy updates, o use la acción manual `.github/workflows/desplegar-api-supabase.yml` con los secretos GitHub adecuados.

Funciones necesarias:
- `unt-registros` (**recepción directa**, verificación JWT automática OFF; control de solicitudes repetidas por código, no por IP compartida).
- `unt-faculty-review` (**revisor por enlace único**; `verify_jwt=false`, autorización interna por huella SHA-256, facultad y caducidad).
- `unt-faculty-supervised` (**URH autenticada**; `verify_jwt=false` en el gateway porque el handler verifica `auth.getUser` y rol `urh_admin` antes de cualquier lectura o escritura).

La función `unt-ai-formulacion` permanece deshabilitada; no requiere ningún proveedor externo de IA.

Secretos en Supabase → Edge Functions → Secrets:
- `UNT_ALLOWED_ORIGINS=https://ssgdr-cmd.github.io` (origen, sin la ruta `/diagnostico-puestos-funciones-unt/`).
- `UNT_RATE_SALT`: valor aleatorio privado para antiabuso. No se publica en el repositorio.
- `UNT_DATABASE_SECRET` **solo si es necesario**: clave privada de servidor, nunca dentro de `config.js` ni del HTML. El código existente admite `SUPABASE_SERVICE_ROLE_KEY` del entorno legado si está disponible. Consulte los secretos predeterminados que ofrece el proyecto.

## D. Operación sin contraseñas para declarantes

- El servidor entra directamente y presenta. **No se le exige OTP, contraseña ni correo validado.**
- El administrador designado recibe de URH un enlace directo (URH → Panel institucional → seleccionar facultad → Generar nuevo enlace de revisión → copiar). **Ese enlace ES una credencial confidencial de acceso a las fichas de la facultad**; no se pega en GitHub ni se publica.
- Desde el mismo enlace el administrador revisa/corrige fichas, marca las revisadas y genera el oficio. La validación final requiere oficio firmado por el decano y su referencia SGDUNT.
- URH accede con su usuario de Supabase Auth y rol `urh_admin` en `public.profiles`. Nunca utilizar una contraseña incluida en el código.

## E. Validación antes de liberar

1. Presentar una ficha ficticia desde GitHub Pages y comprobar el registro en Supabase.
2. Ver esa ficha solo en la lista del administrador de su facultad; comprobar que otra facultad no ve esos datos.
3. Corregir una actividad y comprobar el historial `unt_faculty_review_changes`.
4. Marcar revisada, generar oficio y comprobar que contiene función, actividad, producto e indicador.
5. En URH, comprobar estadísticas de borradores y fichas presentadas sin revelar datos de borradores individuales.
6. Intentar aprobar sin revisión de facultad: **debe rechazarse**. Después, marcar revisión, indicar referencia del oficio firmado y aprobar: debe registrarse la validación.
7. En paralelo, verificar una declaración de decano: debe ir directa a URH sin exigir revisión de facultad.
8. Probar accesos con dos facultades, distintos administradores y uso de equipos compartidos. Ensayar el volumen de uso representativo en horario institucional, sin hacerlo sobre datos reales.

**Los ZIP y la vista HTML no ejecutan automáticamente estas operaciones ni pueden probar el Supabase de su cuenta sin su despliegue.**
