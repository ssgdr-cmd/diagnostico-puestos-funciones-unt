# UNT · V13 — Activación del asistente de redacción con IA

## 1. Qué incluye esta actualización

El nuevo panel contextual de apoyo con IA está integrada en el PASO 2 — Funciones, actividades y productos, tanto para personal administrativo como para administradores de facultad que consignen su propio trabajo. Los decanos/directores conservan su registro de necesidades y no reciben sugerencias de funciones personales.

El trabajador describe sus tareas en lenguaje sencillo y recibe únicamente la propuesta para el campo solicitado: función, actividad o producto. También puede responder preguntas aclaratorias, insertar una alternativa en su formulario y editarla antes de enviarla. La IA **no completa periodicidad, volumen, meses ni índices de valoración**: esos datos continúan a cargo del servidor. La asistencia se presenta como vía guiada principal, con captura manual disponible si la IA no está habilitada y no altera los perfiles, la URH, los informes Word/Excel ni las funciones existentes de la V8.

## 2. Sustituir la web en GitHub desde un navegador

1. Abra su repositorio `ssgdr-cmd/diagnostico-puestos-funciones-unt` y la rama `main`.
2. Suba desde **Add file → Upload files** los archivos de la V13 (contenido de la carpeta, NO el ZIP). GitHub actualizará archivos con la misma ruta. **Conserve las claves privadas fuera de GitHub**.
3. Confirme el commit `Integración del asistente IA para formulación funcional V13`.
4. Compruebe **Settings → Pages → main / (root)**.
5. Confirme que `config.js` contenga la URL y la clave *publishable* de Supabase ya autorizadas. El campo público `turnstileSiteKey` se completará en el paso 3. No cambie `demo:false`.

**No borre la base ni vuelva a ejecutar `schema.sql`**. El asistente reutiliza la función de control de intentos `intake_count_attempt` del esquema de recepción V6. Si falta, complete antes la migración autorizada de recepción; no ejecute migraciones destructivas sin revisarlas.

## 3. Activar Turnstile (también necesario para recibir fichas sin usuario)

1. Cree un widget en `https://dash.cloudflare.com/` → Turnstile → Add widget.
2. Nombre sugerido `UNT - Registro de facultades` y hostname `ssgdr-cmd.github.io`. Elija modo **Managed** o **Non-interactive**.
3. Copie el **sitekey** (público) a `turnstileSiteKey` de `config.js` en GitHub, guardándolo mediante commit.
4. Copie el **secret key** (privado) a Supabase → Edge Functions → Secrets, con el nombre `UNT_TURNSTILE_SECRET`. Nunca lo pegue en GitHub.

La opción «Ayúdame a redactar con IA» exige la verificación de Turnstile; sin ella el botón explica que aún no está habilitada, aunque continúa disponible el registro manual.

## 4. Crear clave API de OpenAI

1. En la **plataforma API de OpenAI** cree un proyecto y su API key, con presupuesto y límites apropiados. La suscripción personal a ChatGPT **no** cubre por sí sola el consumo de API.
2. Vaya a **Supabase → Edge Functions → Secrets** y guarde:

| Nombre en Supabase | Valor | ¿Público? |
| --- | --- | --- |
| `OPENAI_API_KEY` | Clave API de su proyecto de OpenAI | NO |
| `UNT_TURNSTILE_SECRET` | Secret key de Turnstile | NO |
| `UNT_RATE_SALT` | Frase aleatoria larga y exclusiva para hashes de control | NO |
| `UNT_DATABASE_SECRET` | Clave **secret** del proyecto Supabase, si su despliegue la necesita y dispone de autorización | NO |
| `OPENAI_MODEL` (opcional) | `gpt-4.1-mini` (modelo verificado y compatible con salidas estructuradas) | No sensible |

`SUPABASE_URL` y algunas credenciales del servidor pueden estar disponibles automáticamente en Edge Functions. Se respeta la configuración existente de otros servicios. **No vuelva a pegar claves sensibles en el código**.

## 5. Desplegar la función desde Supabase Web

1. Entre a Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Cree la función con nombre **`unt-ai-formulacion`**.
3. Abra en GitHub el archivo `supabase/functions/unt-ai-formulacion/index.ts` y use **Raw** para copiar todo.
4. Reemplace el código del editor por el archivo completo y pulse **Deploy function**.
5. En la configuración de esa función, configure **Verify JWT = off / false**, ya que los servidores no tienen cuenta. El servicio sigue protegido por **Turnstile, restricciones de origen y límites por IP**; no deshabilite esos controles.
6. Si despliega mediante CLI, ya está declarado `verify_jwt = false` en `supabase/config.toml`.

La función usa el endpoint Responses API de OpenAI con salida JSON estructurada. El modelo por defecto es `gpt-4.1-mini`, configurable con `OPENAI_MODEL`, con `store:false`. Establece un límite aproximado de 5 consultas/minuto y 20/hora por dirección de origen a través del contador del esquema V6. **Estos límites técnicos deben comprobarse contra tráfico real antes de abrir el acceso institucional.**

## 6. Prueba funcional previa al uso real

Con el sitio de GitHub Pages abierto y con **datos ficticios**:

1. Seleccione **Ciencias Económicas → Personal administrativo**.
2. Complete una identificación ficticia y avance a **Funciones y productos**.
3. Pulse «Ayúdame a redactar con IA» y describa, sin datos personales: «Recibo solicitudes de estudiantes, reviso sus requisitos, las registro y las derivo a la unidad competente».
4. Complete Turnstile y solicite alternativas. Compruebe que aparezcan una propuesta correspondiente al campo solicitado, con una pregunta puntual si falta información, sin errores de consola.
5. Pulse «Incorporar función», «Incorporar actividades» o «Incorporar productos», según el campo. Compruebe que no se borró ninguna función que existía y que puede editar la incorporada.
6. Complete manualmente unidad de medida, frecuencia y demás información. **No envíe fichas reales** hasta probar el circuito de recepción, validación y consulta URH del aplicativo completo.

### Precauciones

- El asistente no necesita DNI, nombres, dirección, celular ni correo. No los escriba en las descripciones.
- Las propuestas son sugerencias y pueden ser inexactas: el servidor confirma el contenido y el control institucional posterior continúa.
- El HTML de vista previa usa **respuestas ficticias predeterminadas** para probar la interfaz; no consulta a OpenAI.
- No se realizó una prueba de extremo a extremo contra una cuenta OpenAI ni contra el Supabase real del usuario. Para comprobarla, hay que instalar las claves y desplegar la función.
- El servidor no entrega al modelo las fichas completas ni los demás campos de identificación.

### Documentación oficial

- https://supabase.com/docs/guides/functions/quickstart-dashboard
- https://supabase.com/docs/guides/functions/secrets
- https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-4.1-mini


## Cambios de interfaz V11

El asistente se abre desde un acceso ubicado junto a cada función, actividad y producto. No requiere rutas adicionales ni un segundo aplicativo. Para actualizar desde la V10, sustituya los archivos del frontend por los de esta entrega y despliegue de nuevo la función `unt-ai-formulacion`. Mantenga los secretos en el servidor.

## 7. Contexto y advertencias V12

Al abrir el apoyo desde una actividad o producto, el sistema le muestra la función o actividad ya registradas y las envía al servicio de IA exclusivamente como contexto funcional. La IA debe preservar las relaciones antes de generar nuevas propuestas; el trabajador confirma cada una. Las advertencias que aparecen bajo los campos se calculan localmente en el navegador, no envían información y nunca bloquean el formulario.

## Prueba de la nueva secuencia V13

1. Desde **Función**, describa la responsabilidad. La salida debe contener solo una función editable.
2. Incorpore la función. Debe respetar las actividades y productos existentes.
3. Desde **Actividad**, abra el apoyo y compruebe que usa automáticamente la función registrada. La propuesta debe contener solamente actividades, sin productos.
4. Desde **Producto**, abra el apoyo y compruebe que lee la función y actividad, y propone resultados verificables, sin cambiar las descripciones previas.
5. Si falta información, debe aparecer **solo una pregunta de precisión**.

No reutilice datos personales reales durante las pruebas.
