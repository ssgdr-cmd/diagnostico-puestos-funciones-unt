# FACULTADES UNT V19.3.2 — Instalación y validación integral

**Objeto:** registrar declaraciones de servidores de 13 facultades, revisarlas por facultad y documentar la validación final de URH. La demostración HTML usa datos ficticios y **no guarda en Supabase**. El ZIP completo conserva todas las funciones del aplicativo.

## 1. Antes de instalar

- Conservar respaldo de GitHub y de PostgreSQL. El proyecto Supabase mostrado anteriormente corresponde a **PRODUCTION**: ejecutar primero sobre una base de ensayo cuando sea posible.
- No registrar contraseñas ni claves secretas en GitHub, `config.js`, un Word o este documento.
- El acceso al formulario de declaración es directo. El acceso del revisor a fichas de otras personas exige un **enlace privado, exclusivo por facultad, emitido por URH**; es un mecanismo de protección de datos, no un registro de usuario ni OTP. La URH mantiene Supabase Auth.

## 2. Base de datos — aplicar únicamente las migraciones pendientes

Si el proyecto **solo** tiene migraciones hasta V19.1.4, instalar en este orden desde **Supabase → SQL Editor** (una por una, comprobando `Success`):

1. `supabase/migracion_v19_1_9_equipos_compartidos.sql`
2. `supabase/migracion_v19_2_0_conformidad_documental.sql`
3. `supabase/migracion_v19_2_1_revision_facultad.sql`
4. `supabase/migracion_v19_3_0_consolidacion_urh.sql`
5. **`supabase/migracion_v19_3_2_integridad_revision.sql`** (nueva)

Si V19.3.0 ya está aplicada, ejecutar **solo** el punto 5. **No repetir por rutina las migraciones antiguas**. Antes de una ejecución sobre producción, tomar respaldo. Esta migración agrega `reviewed_revision`, preserva las revisiones existentes y reemplaza los procedimientos de revisión, cobertura y validación final, sin borrar fichas.

Se incluye `supabase/VERIFICAR_INSTALACION_V19_3_2.sql`, que solo consulta metadatos para revisar tablas y funciones sin mostrar datos personales.

## 3. GitHub Web

1. Abrir `https://github.com/ssgdr-cmd/diagnostico-puestos-funciones-unt`.
2. **Code → Add file → Upload files**; cargar los archivos *descomprimidos* del ZIP, conservando `supabase/functions/...` y los archivos en la raíz. No subir el ZIP sin descomprimir ni crear una carpeta adicional.
3. Confirmar con `Actualización V19.3.2 – revisión, oficio y validación URH`.
4. Verificar GitHub Pages en `main` y `/(root)` y comprobar que la publicación finalizó en Actions.

## 4. Supabase → Edge Functions

Actualizar desde la vista web `Edge Functions → [nombre] → Code → Deploy updates` estas funciones, utilizando **exactamente** los archivos del ZIP:

- `unt-registros/index.ts`: recepción directa del personal (se conserva la versión ajustada para 400 solicitudes simuladas desde una misma IP).
- `unt-faculty-review/index.ts`: consulta exclusivamente por facultad, revisión de versión exacta, correcciones y marcado.
- `unt-faculty-supervised/index.ts`: acceso de URH a revisiones, agregados y validación documental.

**Importante:** cargar los archivos en GitHub no despliega automáticamente las funciones en Supabase.

En Settings, `Verify JWT with legacy secret` debe permanecer **OFF** para las tres funciones, porque `unt-registros` acepta declarantes sin sesión, `unt-faculty-review` verifica internamente su enlace y `unt-faculty-supervised` comprueba en el código el JWT del usuario URH y su rol. La desactivación del control automático no autoriza operaciones privadas indiscriminadamente.

Secretos de Supabase que deben existir: `UNT_ALLOWED_ORIGINS` con origen `https://ssgdr-cmd.github.io`, `UNT_RATE_SALT` para controles antiabuso por código y una clave **solo de servidor** accesible mediante `SUPABASE_SERVICE_ROLE_KEY` o `UNT_DATABASE_SECRET`. Nunca compartir sus valores. <https://supabase.com/docs/guides/functions/auth-headers>

## 5. Operación

1. El servidor registra y presenta su declaración desde GitHub Pages. La ficha se guarda en `intake_submissions`.
2. URH inicia sesión, selecciona una facultad y emite su enlace confidencial de revisión para el administrador designado.
3. El administrador abre el enlace, consulta **solo fichas presentadas de su facultad**, corrige funciones/actividades/productos/indicadores con motivo y marca cada ficha. Las modificaciones se guardan en `unt_faculty_review_changes`; las marcas se vinculan a la versión vigente.
4. El administrador genera el oficio Word consolidado **solo si todas las fichas presentadas están revisadas**. El sistema actualiza la lista desde Supabase antes de exportar; un Word individual no incorpora correcciones sin guardar.
5. El decano firma el oficio, que se tramita mediante SGDUNT.
6. URH contrasta las fichas digitales y el oficio firmado; registra la referencia documental y efectúa la validación final. La base rechaza la aprobación de una ficha si la marca administrativa corresponde a otra versión. Las declaraciones de autoridades se consultan directamente en URH.

## 6. Verificación previa al uso institucional

Realizar un piloto con **datos ficticios**: crear una ficha, comprobarla en la tabla, consultar desde el enlace de la facultad correcta, probar enlace de facultad incorrecta (debe fallar), corregir una actividad, comprobar el historial, marcar, generar Word, comprobar que una modificación posterior invalida la marca, validar en URH con referencia SGDUNT y consultar el tablero de 13 facultades.

Después realizar pruebas de concurrencia y de respaldo/restitución con los recursos reales disponibles. **Las pruebas locales del ZIP no acreditan 400 conexiones simultáneas en Supabase real.** El almacenamiento de declaraciones textuales de 350–400 servidores es razonable, pero disponibilidad y límites reales dependen del plan y la configuración del proyecto.

## 7. Soporte y decisiones de seguridad

- No usar la versión HTML de demostración para datos reales.
- El enlace del administrador funciona como una credencial; no se publica en sitios ni se comparte fuera del administrador designado. Revocarlo ante pérdida o cambio de responsable.
- Cambiar la contraseña URH anteriormente compartida en una conversación antes del uso institucional.
- El oficio documenta **funciones declaradas**, no modifica automáticamente los documentos de gestión ni certifica atribuciones formales.
