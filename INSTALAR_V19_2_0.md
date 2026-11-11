# Instalación desde GitHub Web y Supabase Web — V19.2.0

## 1. Respaldo

Descargue una copia del repositorio y respalde Supabase. Utilice datos ficticios durante el ensayo. No borre la V19.1.9 ni vuelva a crear las tablas desde cero.

## 2. GitHub Web

Abra `ssgdr-cmd/diagnostico-puestos-funciones-unt` → **Add file → Upload files**. Extraiga y suba **el contenido** del ZIP de actualización, respetando las rutas. Confirme el commit.

Revise que la raíz contenga `index.html`, `app.js`, `docx.js` y que las funciones estén dentro de `supabase/functions`. La publicación de Pages debe usar `main` y `/(root)`.

## 3. SQL Editor de Supabase

Después de las migraciones V19 a V19.1.4, ejecute **en este orden** (solo si no se ejecutaron anteriormente):

1. `supabase/migracion_v19_1_9_equipos_compartidos.sql` — manejo de borradores de equipos compartidos.
2. `supabase/migracion_v19_2_0_conformidad_documental.sql` — registro transaccional de la verificación física por URH.

La segunda migración es aditiva: no borra fichas. Se aplica una sola vez y con respaldo previo. Si aparece un error, deténgase y revise antes de repetir.

## 4. Edge Functions — en la web de Supabase

Actualice y despliegue **las dos** funciones con el código del ZIP:

- `unt-registros` — declaraciones públicas, guardado y envío sin contraseña.
- `unt-faculty-supervised` — consulta, revisión y remisión **solo URH**.

En **Settings** de ambas, configure `Verify JWT with legacy secret = OFF`; la segunda valida el JWT de Supabase y el rol `urh_admin` dentro del código. No deshabilite esas verificaciones internas.

En **Edge Functions → Secrets** compruebe `UNT_ALLOWED_ORIGINS=https://ssgdr-cmd.github.io`, `UNT_RATE_SALT` con un secreto aleatorio propio y la configuración privada de acceso a base de datos. No copie valores privados a GitHub. No se necesitan servicios de IA ni correo OTP.

## 5. Único acceso digital: URH

En **Supabase Authentication → Users** debe existir la cuenta institucional autorizada de la URH. Configure o restablezca su contraseña **solo en Supabase**, nunca en `config.js`, GitHub ni un HTML. Asegúrese de que el usuario está habilitado/confirmado en Supabase Auth y que su identificador aparece en `public.profiles` con `role='urh_admin'`. No cree cuentas de acceso para administradores de facultad, servidores, decanos o directores.

> Por seguridad, si una contraseña se ha compartido previamente fuera de la pantalla de autenticación, cámbiela antes de producción.

## 6. Prueba completa con datos ficticios

1. Servidor: ingresa sin cuenta, presenta una ficha, descarga Word y comprueba su código de recepción.
2. Administrador: entra directamente, ve **Conformidad documental**, genera acta Word con la relación que introduce manualmente, firma las fichas y el acta.
3. Decano/director: nivel superior ya elegido, registra grados/títulos y presenta necesidades directamente.
4. URH: inicia sesión, ve las fichas presentadas, incluidas las autoridades, y descarga el Word individual si lo necesita.
5. URH: intenta validar una ficha del personal sin referencia de documento firmado: **debe ser rechazada**. Con referencia y cotejo físico: **debe validarse**.
6. URH: revisa una ficha de autoridad, que no exige firma del administrador de facultad. Compruebe el registro de auditoría de la validación.

## Advertencias operativas

- La recepción digital sin autenticar no acredita la identidad de quien declara. URH deberá verificarla antes de consolidar resultados.
- Los administradores **no pueden consultar información digital de terceros sin autenticarse**. La conformidad que solicitan se realiza sobre documentos impresos y firmados.
- El código de borrador solo permanece durante la pestaña actual, para evitar datos residuales en equipos compartidos. Finalizar y salir limpia la pantalla.
- La prueba HTML incluida no envía datos a Supabase y está identificada como simulación.
