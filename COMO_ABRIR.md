# Puesta en marcha V8 — GitHub Web y Supabase

1. Descomprimir el ZIP. Desde el repositorio nuevo (rama `main`) usar **Add file → Upload files** y arrastrar el contenido, conservando las carpetas. `index.html` debe quedar en raíz. El proyecto ya incluye `config.js` solo con credenciales públicas.
2. Settings → Pages → Deploy from a branch → `main` → `/(root)`.
3. En Supabase, conservar los usuarios y tablas existentes. Si ya se ejecutó V6 y V7, **no repetir** esas migraciones: ejecutar únicamente V7.1 y V7.2, tras revisar el SQL.
4. En Supabase Edge Functions, desplegar `unt-intake` (sin JWT en gateway; valida Turnstile + límites) y `unt-faculty-supervised` (sin JWT en gateway pero valida token Supabase Auth y rol `urh_admin` internamente).
5. Configurar variables secretas en Supabase Functions: `UNT_TURNSTILE_SECRET`, `UNT_RATE_SALT` aleatorio, `UNT_DATABASE_SECRET` opcional si está disponible; NUNCA en GitHub. Supabase facilita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en su entorno de funciones. Restringir acceso a los secretos.
6. Registrar el dominio `ssgdr-cmd.github.io` en Cloudflare Turnstile, crear widget, copiar **Site key pública** a `config.js`, **Secret key** solo a Supabase Secrets como `UNT_TURNSTILE_SECRET`.
7. La contraseña URH se configura en Supabase → Authentication → Users (no en HTML). Se recomienda rotarla dado que se compartió por chat. El correo del perfil existente permanece `ssgdr@unitru.edu.pe`.
8. Pruebas con datos ficticios: seleccionar Ciencias Económicas; comprobar entrada directa de servidor, administrador y autoridad; envío; URH inicia sesión; desde una sesión URH supervisar revisión del administrador, validar, generar Word y comprobar Excel y estados.

**Límite explícito del requisito «sin acceso para administradores»:** un administrador sin autenticación no puede ver de manera segura DNI ni registros personales de terceros. Por ello, la revisión de datos ajenos está condicionada a una sesión URH autorizada, aunque el formulario propio del administrador sea completamente directo.
