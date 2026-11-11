# FACULTADES UNT 2026 · V19.3.2

Aplicativo institucional de diagnóstico de puestos y funciones de las 13 facultades de la Universidad Nacional de Trujillo.

**Arquitectura:** GitHub Pages (interfaz HTML, formularios, redacción local, Word y Excel) + Supabase (PostgreSQL, Edge Functions, auditoría y acceso privado URH). Sin servicios externos de IA.

## Proceso institucional

1. El servidor administrativo declara directamente funciones, actividades, indicadores y productos. Descarga un oficio individual al Decanato.
2. El administrador recibe de URH un enlace confidencial de revisión limitado a su facultad. Consulta las **fichas presentadas**, registra correcciones justificadas, marca la versión revisada y genera el oficio consolidado dirigido a la DGA. El oficio se firma por el decano y se tramita mediante SGDUNT.
3. Decanos y directores comunican sus necesidades directamente a URH.
4. URH consulta fichas, control de revisiones, consolidación por facultad y valida documentalmente una ficha solo cuando coinciden la revisión de su versión y la referencia del oficio SGDUNT. La URH es el único módulo con usuario y contraseña.

**Privacidad:** no se permite recuperar borradores desde computadoras compartidas. Los enlaces de facultad son credenciales privadas revocables y no equivalen a una autenticación personal del administrador; la firma física del decano y el expediente SGDUNT son la evidencia formal.

## Instalación

Comenzar con `INSTALAR_V19_3_2_FINAL.md`. Si V19.3.0 ya está instalada en Supabase, aplicar únicamente `supabase/migracion_v19_3_2_integridad_revision.sql` y actualizar las funciones que cambiaron. Si la base es anterior, aplicar las dependencias en orden.

## Archivos principales

- `index.html`, `styles.css`, `app.js`, `data.js`, `docx.js`, `xlsx.js`
- `supabase/functions/unt-registros/index.ts`: ingreso directo y almacenamiento
- `supabase/functions/unt-faculty-review/index.ts`: revisión por facultad
- `supabase/functions/unt-faculty-supervised/index.ts`: supervisión y validación URH
- `supabase/migracion_v19_3_2_integridad_revision.sql`: control de versión revisada y auditoría
- `supabase/VERIFICAR_INSTALACION_V19_3_2.sql`: diagnóstico de solo lectura

## Verificación

Pruebas locales y simuladas satisfactorias para formularios, marcado, Word y rutas de autorización. Se conserva prueba de 400 creaciones simuladas desde la misma IP, **no una prueba de carga sobre 400 usuarios simultáneos en Supabase real**. La liberación a 13 facultades requiere ensayo sobre entorno Supabase con respaldo, rol URH, CORS y funciones desplegadas.
