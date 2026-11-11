# Instalación V19.3.1 — GitHub Web

**Base:** V19.3.0. No reemplazar una instalación anterior que todavía no tenga las migraciones y las funciones de V19.3.0 configuradas.

1. Descargue y descomprima `UNT_FACULTADES_V19_3_1_ACTUALIZACION_GITHUB.zip`.
2. Desde el repositorio GitHub, use **Add file → Upload files** para subir el contenido de la actualización conservando sus nombres y rutas. Confirme el reemplazo de `app.js`, `styles.css`, `docx.js` e `index.html`.
3. Registre el commit: `V19.3.1 — mejoras de redacción y oficios por servidor`.
4. Verifique que **Actions → pages build and deployment** haya concluido correctamente. Después cargue la página con **Ctrl + F5**.
5. Pruebe con datos ficticios el formulario del servidor, la descarga del oficio individual, la lista de revisión de facultad y la generación del oficio a la DGA.

**No hay que ejecutar SQL ni actualizar las funciones de Supabase para aplicar este cambio de interfaz y generación Word.** La conexión a la base de datos de producción debe evaluarse de forma independiente.

## Validación documental
- **Oficio individual**: destinado al Decanato. No incorpora líneas de conformidad del administrador ni apartados de cotejo de URH.
- **Oficio consolidado**: destinado a la DGA, firmado por el Decanato y generado después de revisar la relación de servidores.

La demostración HTML funciona con datos ficticios y nunca escribe información en Supabase.
