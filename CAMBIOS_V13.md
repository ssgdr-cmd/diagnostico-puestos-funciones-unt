# V13 · Asistente práctico por campo

Esta actualización modifica solo la ayuda contextual integrada en el paso «Funciones, actividades y productos». Conservar la distribución del sistema, los demás formularios, las características de los productos, la exportación Excel y los oficios Word.

## Funcionamiento

**1. Función.** El servidor explica su responsabilidad y el sistema propone exclusivamente la redacción de la función, con el criterio «verbo en infinitivo + objeto de la acción + atributo». No propone actividades ni productos en este paso. Al incorporar el texto, solo se actualiza la descripción de la función elegida y se respetan las actividades/productos que ya estuvieran registrados.

**2. Actividades.** El servidor abre la ayuda de una actividad. El panel muestra automáticamente la función ya escrita, pregunta cómo se cumple y propone tantas acciones diferenciadas como estén sustentadas por la explicación. No genera productos. Se pueden añadir, revisar o eliminar las actividades propuestas antes de incorporarlas.

**3. Productos.** El panel toma como contexto la función y la actividad seleccionadas. Únicamente propone productos o entregables verificables vinculados a esa actividad. Si falta información, solicita una precisión en lugar de inventar un producto.

**Preguntas:** máximo una pregunta de precisión por vez, en un cuadro de texto ancho y alto. Se han eliminado las tres preguntas simultáneas, los campos diminutos y el botón «No cuento con ese dato».

**Vista previa:** utiliza propuestas ilustrativas locales; no es una sesión real de IA. El servicio `supabase/functions/unt-ai-formulacion/index.ts` incorpora las mismas restricciones por campo. La IA real requiere el despliegue en Supabase y configurar la API y Turnstile; no se habilita por subir archivos a GitHub.

## Criterios

- La IA redacta; el servidor confirma hechos y contenido antes de incorporarlos.
- El sistema no infiere periodicidad, cantidad de documentos, volúmenes ni atributos no descritos.
- No se envían DNI, correos ni datos personales al modelo.
- La ausencia de correspondencia entre función, actividad y producto genera avisos orientativos en el formulario sin bloquear el trabajo.
- El acceso a la URH y las reglas de almacenamiento de datos no se modifican en esta versión.
