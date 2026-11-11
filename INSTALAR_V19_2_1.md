# Instalación V19.2.1 · GitHub Web + Supabase Web

**Requisito:** respaldar base de datos y repositorio, trabajar primero en Supabase de ensayo. La API no usa ningún modelo de IA externo; el autoasistente es local.

## 1. Aplicativo publicado en GitHub Pages

Desde GitHub Web, abrir `ssgdr-cmd/diagnostico-puestos-funciones-unt` → **Add file → Upload files**. Extraer primero el ZIP de **actualización** y subir su contenido conservando directorios, incluida `.github` si Windows muestra archivos ocultos. Escribir `V19.2.1: revisión de facultad y Word detallado` y confirmar. **No reemplazar el archivo `config.js` de producción** (no forma parte del ZIP de actualización).

La rama `main` y la carpeta `/(root)` se mantienen en Settings → Pages. No crear un repositorio nuevo.

## 2. Migraciones SQL en Supabase

En SQL Editor, ejecutar cada archivo íntegro **una sola vez**, después de un respaldo, deteniéndose ante cualquier error:

- Si tu proyecto quedó en V19.1.4: ejecutar primero `supabase/migracion_v19_1_9_equipos_compartidos.sql`.
- Ejecutar a continuación `supabase/migracion_v19_2_0_conformidad_documental.sql`.
- Ejecutar por último **`supabase/migracion_v19_2_1_revision_facultad.sql`**.

Si las versiones anteriores ya están instaladas, ejecutar solo la última. La nueva migración crea tablas de enlaces, marcas de revisión y cambios, y dos funciones RPC, sin eliminar fichas previas. Confirma con SQL Editor que se crearon `unt_faculty_review_links`, `unt_faculty_review_checks` y `unt_faculty_review_changes`.

## 3. Despliegue de funciones desde Supabase Web

Abrir **Edge Functions → unt-faculty-supervised → Code** y reemplazar `index.ts` con `supabase/functions/unt-faculty-supervised/index.ts` de este paquete. Pulsar **Deploy updates**.

Abrir **Edge Functions → Deploy a new function → Via Editor**, colocar como nombre `unt-faculty-review`, pegar el archivo `supabase/functions/unt-faculty-review/index.ts` y pulsar **Deploy function**.

En Settings de **ambas funciones**, dejar **Verify JWT with legacy secret = OFF**. El código verifica dentro del servidor las credenciales de URH y los enlaces únicos de facultad, respectivamente. La función `unt-registros` sigue con las correcciones V19.2.0 y no necesita modificarse en esta actualización.

En Edge Function Secrets, debe existir `UNT_ALLOWED_ORIGINS` con `https://ssgdr-cmd.github.io`. La función necesita las credenciales privadas habituales de Supabase, pero **nunca deben publicarse en GitHub ni en el navegador**.

Opcionalmente, si ya configuraste GitHub Actions con `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_ID`, la acción de despliegue actualizada también publica `unt-faculty-review`, después de aplicar la migración. No activar simultáneamente otro despliegue.

## 4. Revisión del administrador sin OTP

1. La persona autorizada de URH inicia sesión en el módulo privado.
2. En **Panel institucional**, sección «Revisión de personal por facultad», selecciona una facultad y pulsa «Generar nuevo enlace de revisión».
3. La URH copia el enlace generado y lo entrega por un canal institucional controlado al administrador designado. **No insertarlo en GitHub, redes sociales o espacios públicos.** Un nuevo enlace invalida el anterior.
4. El administrador abre el enlace directamente. No escribe usuario, contraseña ni OTP. Solo ve fichas **presentadas** del personal de esa facultad. Las autoridades se remiten directamente a la URH.
5. Despliega cada ficha, lee y, si corresponde, corrige. Explica las modificaciones en «Motivo de los cambios» y guarda antes de marcarla.
6. Marca ✓ las fichas verificadas. Cuando todas estén marcadas, descarga el Word detallado, lo imprime, firma y remite a la URH.
7. La URH contrasta documento firmado con información digital y realiza la validación definitiva. Las marcas de facultad **no equivalen a aprobación URH**.

**Importante para computadoras compartidas:** terminar con «Finalizar y salir», cerrar la pestaña y retirar las hojas impresas. El enlace está protegido por un secreto y su posesión permite acceder a los registros de esa facultad; si se filtró, la URH debe pulsar «Revocar enlace vigente» y emitir uno nuevo.

## 5. Prueba de aceptación

Ejecutar con datos ficticios: servidor registra ficha con indicador → URH genera enlace para esa facultad → administrador abre, edita y guarda con motivo → marca la ficha → obtiene Word detallado → URH visualiza la marca y verifica el Word firmado. Intentar acceso a otra facultad y comprobar que se rechaza. Comprobar también que el administrador **no vea datos de DNI, teléfono y domicilio en su listado**.

La vista HTML incluida en la entrega está **aislada de Supabase**. Simula el procedimiento para que puedas inspeccionarlo antes de publicar.
