# FACULTADES UNT V19.1.9 — Equipos compartidos

## Correcciones

- Se eliminó el botón **Recuperar ficha existente**, toda la pantalla asociada y la recuperación desde la interfaz pública.
- La ficha y su clave temporal de edición ya **no se guardan en `localStorage` ni en `sessionStorage`**. La aplicación elimina al iniciar las claves de versiones anteriores, incluidas las credenciales de autenticación de este proyecto guardadas anteriormente.
- Las sesiones de la URH y revisores ya no persisten en el navegador después de cerrarlo; se mantiene la autenticación protegida para consultar información de terceros.
- Se incorporó el botón **Finalizar y salir**, que limpia los datos del declarante y permite que la siguiente persona use el mismo equipo.
- El registro y los avances permanecen en Supabase, pero el declarante debe **presentar la ficha en la misma sesión**. Si cierra la pestaña antes de presentar, no podrá reabrirla por sí mismo.
- Se ajustó también el índice de la ficha propia de administrador para que un borrador abandonado no bloquee otra presentación.
- Se desactivaron los endpoints de recuperación en `unt-registros` y `unt-faculty-supervised`. El token se conserva **solo en memoria de la pestaña**, para guardar mientras esta sigue abierta.
- La migración V19.1.9 permite crear una ficha nueva cuando existe un borrador abandonado del mismo código; sigue evitando duplicar declaraciones presentadas.
- No se alteraron los campos educativos, las 13 facultades, el autoasistente local ni las exportaciones Word y Excel.

## Criterio institucional

El formulario no prueba por sí mismo la identidad del declarante. La URH coteja el registro recibido antes de validarlo. Las fichas observadas o ya presentadas se corrigen mediante actuación institucional, no reabriendo información sensible en navegadores compartidos.

La migración es aditiva: no elimina fichas anteriores. Los borradores abandonados seguirán en la base hasta que la URH determine un procedimiento de depuración y conservación; esta actualización no los elimina automáticamente.
