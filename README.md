# UNT · Diagnóstico de Puestos y Funciones de Facultades (V13)

Aplicativo web institucional con **panel de asistencia de redacción integrado y contextual**. El usuario registra las funciones, actividades y productos mediante el formulario ordinario y, cuando necesita orientación, abre el panel junto al campo en el que está trabajando.

El asistente se comunica con `unt-ai-formulacion` a través de Supabase Edge Functions; el ejemplo HTML independiente reproduce interacciones simuladas y no consulta al modelo.

## Perfil y continuidad funcional

Se conservan los cuatro perfiles, la estructura de formularios, la selección de facultad, el panel URH, la exportación a Excel y los proyectos de oficio Word. El acceso a datos identificados de otras personas continúa protegido mediante una sesión autorizada de URH.

## Archivos principales

- `index.html`, `app.js`, `styles.css`, `data.js`, `docx.js`, `xlsx.js`: aplicación web.
- `config.js`: únicamente URL y clave pública de Supabase y sitekey pública de Turnstile.
- `VISTA_PREVIA_INDEPENDIENTE.html`: evaluación de la interfaz con información ficticia.
- `supabase/functions/unt-ai-formulacion/index.ts`: servicio de asistencia y apoyo específico para función, actividad o producto.
- `GUIA_ACTIVAR_ASISTENTE_IA.md`: pasos para activar la integración real.
- `CAMBIOS_V11.md`: alcance de la actualización.

## Seguridad

Nunca publicar contraseñas ni secretos de OpenAI, Turnstile ni Supabase. La recepción pública y los flujos de autorización deben probarse antes de registrar datos personales reales.


## Actualización V12

El menú lateral se puede ocultar para ampliar la ficha. Las ayudas automáticas de redacción son **orientativas y locales**; advierten sobre estructura y posible falta de correspondencia sin bloquear el registro. La Edge Function de IA recibe el contexto de función y actividad para formular preguntas y construir sugerencias más específicas. Consulte `CAMBIOS_V12.md`.


## Actualización V13

El asistente trabaja un campo a la vez: **función → actividades → productos**. La etapa de función no redacta anticipadamente actividades; estas se construyen con base en la función y el trabajo explicado. Los productos se sugieren a partir de la actividad correspondiente. Se muestra una sola pregunta de precisión cuando resulta imprescindible y se utiliza todo el ancho del panel. Consulte `CAMBIOS_V13.md`.
