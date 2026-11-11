# FACULTADES UNT V19.1.7 — Formulario simplificado

Esta corrección mantiene el aplicativo integral y su autoasistente local, sin API de IA externa.

- Se retira el recuadro «Recepción directa del registro».
- Se retira la casilla «Permitir continuar desde este dispositivo…».
- El celular pasa a ser opcional y no exige nueve dígitos ni en el navegador ni en la Edge Function.
- Se conserva la información ya consignada por el declarante. No modifica DNI, código de trabajador, facultad ni correo institucional.
- Los borradores se almacenan en Supabase; el token privado de edición queda solo en la sesión del navegador, sin casillas de consentimiento adicionales. Cerrar el navegador puede hacer perder la posibilidad de recuperar ese token; la URH debe gestionar la recuperación autorizada.
- Se simplifica el aviso del borrador para mostrar solo si hay cambios pendientes o guardados.
- Se incrementa `app.js?v=1917` para evitar que GitHub Pages sirva JavaScript anterior desde caché.

**Importante:** actualizar `index.html` y `app.js` en GitHub Pages y `supabase/functions/unt-registros/index.ts` en Supabase Edge Functions. Publicar el backend en GitHub no lo despliega automáticamente en Supabase.

No ejecutar ninguna nueva migración SQL. Se mantienen los controles de acceso a fichas ajenas de la URH.
