# INSTALACIÓN V19.1.8 — Solo GitHub Web y Supabase Web

**IMPORTANTE:** no elimine el repositorio, no reemplace `config.js` y no vuelva a ejecutar las migraciones anteriores.

## 1. Actualizar GitHub Pages

1. Descargue `UNT_FACULTADES_V19_1_8_ACTUALIZACION_GITHUB.zip` y descomprímalo.
2. En su repositorio `ssgdr-cmd/diagnostico-puestos-funciones-unt`, abra **Code → Add file → Upload files**.
3. Arrastre todo el contenido del ZIP, sin incluir la carpeta contenedora. Debe reemplazar `app.js`, `index.html` y `supabase/functions/unt-registros/index.ts`. Los archivos de documentación/prueba son adicionales.
4. En el mensaje de commit escriba `V19.1.8 - Estudios y registro funcional sin bloqueos innecesarios`. Pulse **Commit changes**.
5. Compruebe que la rama es `main` y que Pages utiliza `main / (root)`.

## 2. Actualizar la función que guarda en Supabase

**Subir el archivo TypeScript a GitHub NO actualiza automáticamente la función de Supabase.**

1. En Supabase abra **Edge Functions → unt-registros → Code**.
2. Abra en GitHub el archivo `supabase/functions/unt-registros/index.ts` ya actualizado, use **Copy raw file**.
3. Edite `index.ts` en Supabase, reemplace íntegramente el código anterior y pulse **Deploy updates**.
4. Mantenga la configuración ya validada de `UNT_ALLOWED_ORIGINS`, `UNT_RATE_SALT` y los secretos de base de datos. No muestre ni copie aquí secretos reales.
5. Si la función pública de registro utiliza autorización propia por token privado de edición, mantenga **Verify JWT with legacy secret** en OFF; el acceso URH y de revisores sigue validándose por la API correspondiente.

## 3. Probar con datos ficticios

1. Abra `https://ssgdr-cmd.github.io/diagnostico-puestos-funciones-unt/` y presione **Ctrl + F5**.
2. Elija una facultad y **Personal administrativo**. Registre apellidos, nombres y un código de prueba que no coincida con un trabajador real; seleccione **Técnico**. Compruebe que aparezcan especialidad, grado técnico y título.
3. Repita con **Superior / universitario** y compruebe que pueda añadir **Bachiller**, **Maestría**, **Doctorado** y títulos, sin que sean obligatorios.
4. Repita con **Decanos y directores**: guarde un borrador, agregue una necesidad, continúe y presente la ficha ficticia.
5. Repita con **Administrador de facultad**, sin utilizar credenciales de revisión. La ficha propia no debe concederle permisos para consultar registros ajenos.
6. En Supabase Table Editor, compruebe que las fichas de prueba se hayan guardado realmente en `public.intake_submissions`. Documente los códigos usados y coordine su eliminación posterior con la URH.

## Si falla

- Abra **Supabase → Edge Functions → unt-registros → Logs** y compruebe el error y la fecha, sin compartir datos personales.
- Confirme que el editor de la función contenga la cabecera `V19.1.8`.
- Si la respuesta es `409`, podría existir una ficha previa con el mismo código/facultad. No borre registros sin comprobar antes su procedencia.
- Si sale `Failed to fetch`, compruebe el despliegue de la función y `UNT_ALLOWED_ORIGINS`, no el nivel educativo.

**Seguridad:** permitir la captura sin OTP no permite consultar o validar expedientes ajenos. Un servidor puede guardar una declaración sin que su identidad haya sido acreditada. El cotejo de padrón, la validación y las decisiones de URH siguen siendo procesos separados.
