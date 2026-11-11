# V19.3.2 — Integridad de revisión, oficio y validación final

Se conserva íntegramente el aplicativo V19.3.1 de las 13 facultades: formulario, educación, autoasistente local sin IA externa, oficios individuales, oficio consolidado DGA y panel URH.

**Ajustes:**

- El Word individual desde la vista del administrador **no exporta correcciones sin guardar**.
- Antes de generar el oficio consolidado, el navegador **vuelve a cargar de Supabase** la relación presentada y las marcas de revisión. No admite fichas sin marcar.
- Una marca de revisión queda asociada a la `revision_no` precisa. Cambios posteriores invalidan la marca.
- La revisión por facultad **solo puede alterar el arreglo de funciones** (incluye actividades, indicadores y productos); no permite sustituir datos personales, necesidades de autoridades ni otras secciones.
- Los totales del tablero URH dejan de contar marcas de versiones anteriores como fichas revisadas.
- El oficio consolidado incluye el número de versión por ficha para facilitar el cotejo documental.
- Se mantiene `unt-registros` sin límite general por IP compartida, con protección puntual por código de trabajador.

**Dependencia:** nueva migración `migracion_v19_3_2_integridad_revision.sql`. Para producción se necesitan `unt-faculty-review` y `unt-faculty-supervised` desplegadas y el rol URH configurado.

**Alcance de las pruebas:** sintaxis y pruebas funcionales locales simuladas, prueba de interfaz con generación de Word, 400 creaciones simuladas y comprobaciones estructurales. No se realizó acceso a la instancia Supabase real ni carga concurrente real.
