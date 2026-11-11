# Pruebas V19.2.1

**Verificado localmente:**

- Los 13 nombres de facultades aparecen en la portada y el escudo UNT carga.
- El selector de «tipo de título» ocupa 315 px frente a 612 px de la denominación en una pantalla de 1440 px.
- Se conserva el acceso directo de servidores y autoridades sin OTP.
- La revisión de facultad muestra únicamente los registros ficticios del personal de la facultad seleccionada.
- No puede marcarse una ficha si se han escrito correcciones que no se guardaron.
- Se puede guardar un indicador nuevo y, posteriormente, marcar la ficha.
- Word de conformidad generado y abierto: fuente Normal **Arial 11 pt**, con función, actividad, producto e indicador nuevo; renderizado visualmente.
- `app.js` y `docx.js`: sintaxis correcta. TypeScript de las funciones nuevas/modificadas: sin errores de transpilación.

**Pendiente de aceptación real:** migración SQL V19.2.1 y prueba de emisión/revocación de enlaces, listado, edición concurrente, auditoría, permisos RLS y conformidad con usuarios reales autorizados en un Supabase de ensayo. No divulgar información institucional hasta completar estas pruebas.
