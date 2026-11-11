# FACULTADES UNT V19.2.2 — Ajuste de recepción para redes compartidas

## Alcance preciso

Se modifica exclusivamente la Edge Function `supabase/functions/unt-registros/index.ts`. No cambian la interfaz, el oficio Word, las tablas, la revisión de facultad, la bandeja URH ni el autoasistente local.

Se eliminan los topes de **20 creaciones por minuto por IP**, **8 por correo declarado** y **120 creaciones por minuto globales** de la función de recepción. Esto evita bloquear a servidores legítimos que comparten IP pública o no indican correo institucional.

Se mantiene la protección **4 intentos por minuto, 24 por hora, por combinación facultad+código de trabajador**. También se conserva el rechazo de un segundo registro ya presentado con igual facultad+código, la longitud máxima de ficha, la validación de estructura, CORS y el token de edición temporal de la pestaña. El registro directo sigue sin OTP.

## Publicación únicamente por la web

1. Verifica que el repositorio contenga ya la V19.2.2. No uses este parche sobre una versión mucho más antigua.
2. En GitHub Web abre `supabase/functions/unt-registros/index.ts`, edita el archivo y sustituye todo por el contenido del archivo incluido en este paquete. Confirma el commit `Ajuste V19.2.2: recepción en red compartida`.
3. En Supabase: **Edge Functions → unt-registros → Code → Edit code**. Sustituye íntegramente el código por el mismo `index.ts` y pulsa **Deploy updates**. GitHub Pages por sí solo NO actualiza la función.
4. Comprueba que la opción **Verify JWT with legacy secret** sigue desactivada para `unt-registros`, como en la instalación de recepción directa. Mantén los orígenes CORS configurados.
5. **No se necesita migración SQL nueva.** Mantén `UNT_RATE_SALT`; sigue utilizándose en el control específico por código.

## Qué prueban los tests incluidos

- 400 códigos distintos por la **misma IP** y sin correo producen 400 creaciones en una simulación de API/Postgres.
- El quinto intento dentro de un minuto con el mismo código genera 429 (antispam individual).
- Siguen pasando el flujo servidor/autoridad/administrador, el asistente y la generación del oficio.

## Lo que NO queda garantizado

No se ha realizado prueba contra la instancia real de Supabase. La simulación no garantiza 400 usuarios **simultáneos** ni disponibilidad ilimitada. El plan Free tiene límites de recursos, invocaciones mensuales, tiempo de ejecución y puede suspender proyectos inactivos. Para aprobar el despliegue, probar con un lote pequeño y ampliar a 20, 50 y 100 creaciones concurrentes (con registros ficticios), midiendo errores, latencias y consistencia en `intake_submissions`, sin exponer información real.

## Procedimiento documental

El administrador revisa las fichas y genera el proyecto de oficio. El documento firmado por el decano, presentado y registrado mediante SGDUNT, es el soporte formal que debe cotejar la URH con el contenido y código de recepción de las fichas. Una marca de revisión en el navegador por sí sola no acredita la identidad del revisor ni la validez institucional del oficio.
