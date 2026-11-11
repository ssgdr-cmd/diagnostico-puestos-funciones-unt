# Instalación V19.2.2 — Solo GitHub Web

## Antes de actualizar

1. Conserva una copia del repositorio y una copia de los Word previos. Si tu repositorio aún está en V19.1.7, **no** instales solamente este parche: primero instala V19.2.1 con sus migraciones y APIs, siguiendo `INSTALAR_V19_2_1.md`.
2. Asegúrate de que la V19.2.1 ya permite al administrador abrir su enlace de revisión, ver los servidores y marcarlos como revisados.

## Actualización sobre V19.2.1

1. Abre el repositorio GitHub `ssgdr-cmd/diagnostico-puestos-funciones-unt` → **Code** → **Add file** → **Upload files**.
2. Descomprime el ZIP de actualización V19.2.2; carga el contenido (no el ZIP ni la carpeta contenedora) sobre la raíz del repositorio, respetando las rutas `index.html`, `app.js` y `docx.js`.
3. Confirma la sustitución con un commit: `V19.2.2: oficio informativo a DGA y anexo funcional`.
4. GitHub Pages sigue en `main / (root)`. Entra a Actions y verifica que la publicación se complete.
5. Abre la página, fuerza recarga con Ctrl+F5. Como administrador autorizado, revisa las fichas y marca todas. Pulsa **«Generar oficio con funciones declaradas (Word)»**.
6. Abre el Word en Microsoft Word, completa el N.° de oficio y los datos de **expediente** y **registro SGDUNT**, revisa el detalle y tramítalo para firma del Decanato.

## Supabase

**No ejecutar SQL nuevo ni redeplegar Edge Functions:** esta actualización modifica únicamente el texto y formato de los Word generados en el navegador. Los permisos, autenticación URH, enlaces de facultad, API y almacenamiento de datos permanecen como en V19.2.1.

## Prueba sin publicar

Abrir `UNT_FACULTADES_V19_2_2_PRUEBA_OFICIO.html` con Chrome. Es una demostración **sin conexión a Supabase**. Elegir facultad, entrar como administrador, abrir «Revisión del personal», desplegar una ficha y marcarla revisada. Descargar el Word. Los nombres de prueba son ficticios.

## Seguridad documental

El Word es un **proyecto editable**, no un oficio firmado ni una validación de funciones. Verifica destinatario, número de oficio, firma y datos SGDUNT antes de remitirlo. Nunca incluyas contraseñas, tokens ni claves privadas en GitHub.
