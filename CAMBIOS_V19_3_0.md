# CAMBIOS · V19.3.0

- Conserva las 13 facultades, la interfaz institucional, formularios y motor de redacción local.
- Añade panel URH por facultad: borradores activos agregados, fichas presentadas, revisadas por facultad, validadas por URH, remitidas y declaraciones de autoridades.
- Calcula porcentajes de cobertura solo cuando existe un padrón activo cargado.
- Endurece la validación final: requiere marca de revisión de facultad más referencia del oficio firmado y expediente SGDUNT; solo URH autenticada puede aprobar. Autoridades: recepción directa en URH.
- No muestra individualmente borradores al administrador de facultad ni en el tablero; el servidor conserva el acceso de edición únicamente en la pestaña actual.
- Mejora el HTML de prueba de modo que las marcas ficticias persistan al cambiar de perfil dentro de esa vista, sin guardar datos en el navegador.
- Mantiene la API que elimina limitaciones compartidas por IP y conserva antiabuso puntual por código de trabajador.
- No introduce servicios de IA externos, OTP ni cuentas para los declarantes.
- Nueva migración: `supabase/migracion_v19_3_0_consolidacion_urh.sql`; nueva acción `progress` en `unt-faculty-supervised`.
