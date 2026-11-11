# FACULTADES UNT — Cambios V19.2.2

**Alcance:** exclusivamente la generación del oficio de información funcional desde el panel de revisión de facultad. Conserva los módulos, roles, conexión de Supabase, sistema de enlaces de revisión, autoasistente local y formularios de V19.2.1.

- Se reemplazó la exportación final «acta y fichas detalladas» por un **oficio editable de información sobre las funciones que el personal declara desempeñar**.
- Destinatario: **Econ. Alberto Luis Cava Carhuayo, Director General de Administración** de la Universidad Nacional de Trujillo (nombre proporcionado para esta instalación).
- Encabezado de Word con **Universidad Nacional de Trujillo / Facultad de [facultad] / «Año de la Esperanza y el Fortalecimiento de la Democracia»**, según D. S. 011-2026-PCM.
- Orden: fecha, número editable de oficio, destinatario, «PRESENTE.-», asunto y cuerpo; relación nominal; información completa con niveles de sangría; espacio de **revisión del administrador**, **firma del Decano** y, al final, **expediente y registro SGDUNT**.
- Anexa por trabajador la función, la actividad, el indicador, el producto/entregable, frecuencia, unidad, volumen y observaciones registradas.
- Tipografía **Arial 11**, idioma **es-PE**, márgenes A4; texto administrativo justificado e información tabulada o anidada alineada a la izquierda.
- La exportación se activa solo después de revisar todas las fichas visibles de esa facultad, como en V19.2.1.
- El oficio señala expresamente que comunica información declarada y **no acredita por sí mismo** funciones, modificación de puestos o atribuciones.
- No se modificaron tablas, políticas, Edge Functions ni secretos. **No requiere una nueva migración SQL ni despliegue de Supabase.**

**Advertencia:** la V19.2.2 presupone que V19.2.1 está correctamente instalada y que `unt-faculty-review` funciona. Las pruebas locales no sustituyen validación con Supabase de ensayo y documentos reales.
