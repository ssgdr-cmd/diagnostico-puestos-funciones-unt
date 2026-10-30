# Versión 11 · Asistente contextual de redacción

La sección **Funciones, actividades y productos** conserva el formulario institucional. El asistente de IA ya no ocupa la parte superior ni muestra tarjetas de ejemplos seleccionables.

- Un acceso discreto se ubica junto a cada **función**, **actividad** y **producto**.
- La ayuda se abre en un **panel lateral derecho** en computadora y a pantalla completa en móvil.
- La referencia de descripción utiliza redacción cuidada; aparece plegada y no se puede copiar automáticamente a la ficha.
- El servidor expone las labores, recibe preguntas concretas y revisa un borrador editable con las actividades y los productos que correspondan.
- No se limita el número de actividades a dos; el servicio permite hasta veinte actividades sustentadas por respuesta.
- Los cambios dentro del asistente se conservan por campo al cambiar de un campo a otro.
- La incorporación contextual **no sobrescribe los registros previos**: en funciones ocupadas añade una nueva función; en actividades agrega acciones a la función pertinente; en productos preserva los existentes.
- Se mantienen los perfiles de servidores, administradores de facultad, autoridades y el acceso URH, así como Word, Excel y diseño UNT.

## Operación real

La vista previa es ficticia. Para respuestas reales se requiere desplegar la función `unt-ai-formulacion` en Supabase, configurar los secretos `OPENAI_API_KEY`, `UNT_TURNSTILE_SECRET`, `UNT_RATE_SALT` y habilitar la clave pública de Turnstile en `config.js`. No agregar claves privadas a GitHub.

Los formularios públicos, la validación de expedientes y su consulta institucional dependen de la configuración y verificación del backend de Supabase. Publicar el ZIP en GitHub Pages **no habilita por sí solo** el tratamiento de información real.
