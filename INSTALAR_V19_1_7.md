# Instalación rápida — V19.1.7 (solo web)

### 1. GitHub Pages

En el repositorio actual `ssgdr-cmd/diagnostico-puestos-funciones-unt`, subir y reemplazar en la **raíz** los archivos `app.js` e `index.html`. Hacer **Commit changes**. No borres el repositorio ni modifiques `config.js`.

### 2. Supabase Edge Functions (OBLIGATORIO)

En tu proyecto de Supabase: **Edge Functions → `unt-registros` → Code/Edit**. Reemplazar el contenido de `index.ts` por el nuevo archivo `supabase/functions/unt-registros/index.ts` y ejecutar **Deploy updates** o **Deploy function** según la pantalla. Mantener apagada la verificación JWT automática de esta función y conservar las variables `UNT_ALLOWED_ORIGINS` y `UNT_RATE_SALT`. No publicar la clave `service_role` ni otras claves privadas.

### 3. Probar

Abrir `https://ssgdr-cmd.github.io/diagnostico-puestos-funciones-unt/` con Ctrl+F5. Seleccionar facultad y Personal administrativo, completar la identificación y probar «Continuar y guardar borrador» **con datos ficticios**. Prueba recomendada: dejar celular vacío, o ingresar uno con longitud distinta de 9. El sistema debe guardar si los demás campos obligatorios son correctos. Verificar luego en Supabase Table Editor que se creó el registro en `intake_submissions` con `status=draft`. No introducir datos personales reales hasta validar esta prueba.

### Qué ya no se pide

No aparecen «Recepción directa del registro», la casilla para conservar el acceso en el equipo ni verificación OTP. El celular no es obligatorio. El resto del sistema de funciones, actividades, productos y autoasistente se conserva.

### Seguridad

El registro abierto no acredita la identidad del declarante. La URH debe contrastarla antes de validar. La revisión y consulta de fichas ajenas siguen restringidas. La continuidad sin clave solo está disponible dentro de la sesión del navegador que conserva el secreto de edición; no prometemos recuperación en otro equipo.
