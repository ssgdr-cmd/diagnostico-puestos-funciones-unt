# Pruebas V19.1.9 — Equipos compartidos

Pruebas locales, sin conexión al Supabase institucional:

- `node tests/probar_equipos_compartidos_v1919.cjs`: `get` y `recover_supervised` rechazados, los tres perfiles pueden crear/guardar/presentar; un borrador abandonado no bloquea una nueva declaración; una presentada continúa bloqueando duplicados.
- `python tests/probar_equipo_compartido_interfaz_v1919.py`: Chromium con API y almacenamiento simulados; verifica eliminación del botón, borrado de claves legadas, Supabase Auth sin persistencia, formulario vacío al salir para los tres perfiles.
- `python tests/probar_interfaz_educacion_y_registro_v1918.py`: campos Técnico/Superior, grados, títulos, guardado, decanos.
- `node tests/probar_motor_local.cjs`: 5/5 escenarios de autoasistente.
- `node tests/probar_autoguardado.cjs`: cambios concurrentes.
- `node tests/probar_documentos_v1914.cjs`: cuatro documentos Word.

No son pruebas reales de políticas de PostgreSQL ni de un despliegue operativo de Supabase. Es necesario ejecutar un piloto con datos ficticios en el proyecto institucional.
