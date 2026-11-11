# FACULTADES UNT — Cambios V19.1.8

Corrección puntual sobre la V19.1.7, sin sustituir el aplicativo institucional y sin incorporar inteligencia artificial externa.

## Cambios comprobables

- Se conectó el selector **Secundaria / Técnico / Superior-universitario** con el desplegable dinámico de los estudios.
- En educación **técnica**, se puede describir la especialidad, registrar el grado de **bachiller técnico** cuando corresponda y añadir títulos técnicos.
- En educación **superior**, se puede describir la carrera y agregar uno o varios grados (bachiller, maestría, doctorado u otros) y títulos profesionales. Cada título tiene tipo y denominación.
- La captura de grados y títulos es opcional y no bloquea el guardado si el servidor todavía no cuenta con alguno o requiere completar su denominación.
- Se evitó que al borrar el último grado o título el aplicativo lo recree por error desde información heredada.
- El formulario de decanos y directores ya no supone automáticamente que cuentan con educación superior. Cada autoridad selecciona el nivel que corresponda.
- Las declaraciones de decanos, directores y administradores de facultad se pueden guardar **sin depender de un padrón cargado** ni de la existencia previa de correos autorizados. La URH contrastará los datos declarados al revisar.
- Se retiraron restricciones de campos complementarios para crear un borrador; se conservan como mínimos apellidos, nombres y código de trabajador para individualizar la ficha.
- Se relajaron las restricciones de contenidos incompletos al presentar la declaración para que la URH pueda revisarlos y, si procede, observarlos. No equivale a validación institucional.
- La API admite corregir DNI y correo declarado desde el mismo borrador, manteniendo inmóviles facultad, código y perfil.
- La revisión de otros expedientes continúa requiriendo autorización; no se habilitaron accesos administrativos anónimos.
- No hay OTP, envío de códigos por correo ni proveedor de IA generativa. Se conserva el autoasistente local.

## Compatibilidad

- No se agregan tablas ni columnas: **no requiere nuevas migraciones SQL** tras V19.1.4.
- Modifica `app.js`, `index.html` y `supabase/functions/unt-registros/index.ts`.
- Los datos académicos se conservan en el JSONB `profile` de `intake_submissions`.

## Limitaciones conocidas

- La identidad de un declarante público no queda verificada por presentar la ficha. La URH debe contrastarla antes de validar.
- El índice antiguo `unt_single_admin_functional_record` sigue limitando a una ficha marcada `ADM-` por facultad. Si ya existe una, la URH deberá solucionar la duplicidad o recuperar la ficha original.
- Los registros presentados no deben tratarse automáticamente como evidencia validada.
- Las pruebas realizadas no sustituyen la verificación de permisos, datos y red en el Supabase desplegado.
