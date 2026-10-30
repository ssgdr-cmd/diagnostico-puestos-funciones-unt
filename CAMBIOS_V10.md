# V10 · Asistente conversacional para servidores de las facultades UNT

- Se admite una descripción natural, desordenada, informal y con errores de escritura.
- El asistente pregunta lo que aún no sabe y mantiene las respuestas previas.
- Devuelve un borrador progresivo con 1–3 variantes solo si están justificadas.
- Sin límite fijo de dos actividades: se sugieren las que correspondan a la descripción (hasta 20 por respuesta en backend, 25 editables por propuesta para prevenir abusos).
- Funciones, actividades y productos pueden editarse, añadirse o retirarse directamente antes de incorporar a la ficha.
- Si no se conoce un producto, no se inventa; queda para completar en el formulario definitivo.
- Datos de periodicidad, volumen y estacionalidad siguen a cargo del servidor.
- El modelo solo recibe el relato laboral y las respuestas, no DNI ni domicilio.
- La vista previa es una simulación. Activar la IA real requiere configurar Turnstile, OpenAI y la Edge Function `unt-ai-formulacion` en Supabase.

- La consulta real envía también el borrador modificado para respetar lo que el servidor ya editó cuando pide otra revisión.
