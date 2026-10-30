# Comprobaciones V13 · simulación local

Se probó con Chromium en la vista previa independiente y datos ficticios, en anchos de 390, 768, 1440 y 1920 píxeles:

- El asistente para FUNCIÓN solo muestra una función editable; no genera actividades ni productos.
- Incorporar una función preserva las actividades y los productos previamente registrados.
- Al trabajar ACTIVIDADES, el panel muestra la función de referencia y propone cinco actividades a partir de un relato ilustrativo; no genera productos en esa etapa.
- PRODUCTO utiliza la actividad de referencia; incorporar resultados no elimina el producto existente.
- Ante una descripción insuficiente se muestra una pregunta única en una caja de ancho completo (relación entre ancho y contenedor comprobada en cuatro resoluciones).
- No se observaron errores de JavaScript ni desbordamientos horizontales en los recorridos comprobados.

**Alcance:** pruebas locales con motor simulado. No se ha verificado en producción la comunicación con la API de OpenAI, las migraciones de Supabase ni el flujo institucional completo de recepción y validación. La apariencia en navegadores específicos de TV o vehículos no fue comprobada físicamente.
