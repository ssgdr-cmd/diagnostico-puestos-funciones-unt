# V19.1.6 — Corrección de acceso directo

- Se retiran del JavaScript las funciones de envío OTP, confirmación OTP, ventanas de código y la pantalla de verificación por correo.
- Personal administrativo, decanos/directores y administradores de facultad **para su propia declaración** ingresan directamente, sin cuenta ni contraseña.
- Se corrige la API `unt-registros` para que el administrador pueda crear su propia ficha sin sesión de correo, con cotejo de padrón y correo previamente autorizado por la URH. La identidad declarada sigue siendo **no verificada**.
- Las fichas antiguas con secreto de edición conservado pueden continuar mediante el token privado, sin solicitar OTP adicional.
- Para **revisar fichas de terceros**, el revisor de facultad usa una cuenta previamente habilitada con contraseña; el aplicativo no envía OTP ni enlaces por correo. La URH conserva su autenticación.
- Se conserva el proyecto: 13 facultades, formularios, asistente local, almacenamiento, supervisión y Word/Excel.
- Se actualiza la versión de caché de `app.js` en `index.html`.
- Se retiran de la vista de URH las instrucciones de un flujo antiguo de recuperación basado en OTP, que ya no puede utilizarse públicamente.

**Advertencia:** el acceso directo implica que el sistema no puede acreditar quién escribió una ficha; la URH debe contrastarla antes de considerarla válida.
