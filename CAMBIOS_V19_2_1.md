# FACULTADES UNT · V19.2.1 — Revisión de facultad

## Mejoras funcionales

- Corrección proporcional del formulario de títulos: el tipo ocupa aproximadamente **34 %** y la denominación **66 %**; en pantallas pequeñas se apilan sin cortar el texto.
- Nuevo campo opcional **indicador de medición** en cada producto/entregable de cada actividad. Se conserva en el registro y se incluye en la ficha Word.
- Administrador de facultad: visualización desplegable de **servidores de su propia facultad** que hayan presentado sus fichas (excluye autoridades y otras facultades).
- Edición detallada de descripción de funciones y actividades, productos, indicadores, frecuencias, unidades y volúmenes. Posibilidad de agregar funciones, actividades y productos. La modificación exige una breve justificación y conserva la versión anterior en la tabla de auditoría.
- Marca de **revisado** por ficha, que puede retirarse; la generación del Word detallado se habilita cuando todas las fichas de la relación están marcadas.
- Word consolidado con relación nominal, funciones, actividades, indicadores, productos, detalle de demanda y espacio para firma; **Arial 11**. El archivo no equivale a validación institucional definitiva.
- URH: emisión y revocación de **enlaces individuales por facultad**, con secreto aleatorio de 256 bits y expiración a 30 días; consultables desde el enlace sin correo, contraseña ni OTP. La URH conserva su inicio de sesión privado.
- URH puede consultar la marca de revisión de facultad en su bandeja de registros.
- Se recuperaron los archivos gráficos originales del escudo UNT y favicons que faltaban en el paquete V19.2.0.

## Precisión de seguridad

Un repositorio público no puede exponer nombres, códigos y funciones editables de terceros sin un mecanismo de autorización. Se optó por un **enlace directo exclusivo, emitido por la URH**, sin pantalla de login para facultades. Quien reciba ese enlace puede consultar la facultad; por ello debe custodiarse y revocarse si se comparte indebidamente. La conformidad documental requiere firma física y la URH valida después.

## Alcance de pruebas

- Pruebas en navegador Chromium **con registros ficticios**: listados, edición de indicador, control de cambios sin guardar, marca, generación de Word y formulario educativo.
- Word probado con `python-docx` y renderizado visualmente; se verifica Arial 11.
- Comprobación de sintaxis de JavaScript y análisis de sintaxis TypeScript. 
- **Pendiente**: ejecución de migración y pruebas integrales de la API con Supabase de ensayo y revisión de sus políticas RLS. No se certifica como producción.
