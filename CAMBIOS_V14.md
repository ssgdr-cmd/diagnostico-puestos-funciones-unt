# V14 · Alertas no restrictivas y servicio de IA para GitHub + Supabase

Se parte íntegramente de la V13. Se preservan los cuatro perfiles, formularios, reportes Word y Excel, escudo y navegación adaptativa.

- **Función:** aviso no restrictivo ante verbo no formulado en infinitivo, objeto poco definido o falta de atributo/alcance. Se muestra bajo el campo al escribir y en el borrador sugerido por la IA. Los avisos son heurísticos y no constituyen dictámenes definitivos.
- **Actividad y producto:** mantienen las advertencias de posible incoherencia con el campo del nivel superior.
- **API:** conserva el flujo por campo, con salidas estructuradas JSON, Turnstile, control de intentos, CORS y secretos del servidor. Modelo predeterminado revisado a `gpt-4.1-mini`, compatible con Responses y salidas estructuradas; el modelo es configurable como secreto `OPENAI_MODEL`.
- **Seguridad:** nunca se publica `OPENAI_API_KEY` ni contraseñas en GitHub; se impide enviar DNI/celulares/correos en la descripción funcional.

La consulta real al modelo no se puede verificar sin desplegar la función y configurarla con credenciales institucionales. La vista previa funciona con ejemplos ficticios.
