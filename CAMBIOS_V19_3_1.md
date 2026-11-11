# FACULTADES UNT · V19.3.1 — Ajustes de interfaz y oficios individuales

## Interfaz institucional
- UNIVERSIDAD NACIONAL DE TRUJILLO se presenta en una sola línea y con mayor jerarquía visual que Dirección General de Administración.
- Se elimina de la página de elección de perfil el texto redundante sobre correo, OTP, revisión y validación institucional.
- Se retira la advertencia sobre computadoras compartidas del formulario de identificación.
- El mensaje de revisión y envío queda en «Verifique la información antes de presentarla».
- La función se define como una responsabilidad general de **carácter continuo**.
- El aviso bajo el botón del oficio del administrador se reduce al requisito de marcar todas las fichas.

## Exportación Word
- El registro individual de personal administrativo y de administradores se exporta como **oficio dirigido al decano de la facultad**, con asunto y cuerpo informativo.
- Encabezado repetido de Word: UNIVERSIDAD NACIONAL DE TRUJILLO / FACULTAD DE … / denominación del año.
- Se eliminan del oficio individual los textos de código de recepción digital, estado de recepción, conformidad del administrador, revisión de URH y advertencia de validez.
- Se mantiene el detalle por función, actividad, producto, indicador y magnitudes declaradas, con sangrías jerarquizadas y Arial 11.
- El oficio individual concluye con la firma del servidor.
- Las autoridades conservan el informe de necesidades con encabezado de facultad, sin secciones de verificación URH.
- El oficio consolidado preparado por Administración de Facultad **permanece dirigido al Director General de Administración**; no se cambió su procedimiento ni su control de revisión.

## Alcance
Solo se modifican `app.js`, `styles.css`, `docx.js` e `index.html`. No requieren migraciones SQL ni actualizaciones de funciones Edge de Supabase.

**Precaución:** este cambio no prueba conexión, permisos ni guardado en una instancia real de Supabase.
