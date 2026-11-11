# FACULTADES UNT — V19.2.0 · Ingreso directo y conformidad documental

## Alcance

Se conserva el aplicativo completo de las 13 facultades, los formularios, el autoasistente local, los reportes y las funciones de Supabase. No existen servicios externos de IA.

- **Personal administrativo:** se identifica y presenta directamente. Después de presentar, descarga una ficha Word con código de recepción, funciones, actividades, productos y espacio para la firma del administrador de facultad.
- **Administrador de facultad:** ingresa directamente y declara sus funciones; adicionalmente genera **Acta de conformidad documental** desde las fichas impresas recibidas. No tiene acceso digital a registros personales de terceros ni necesita usuario, contraseña u OTP para su trabajo de declaración y conformidad física.
- **Decanos y directores:** envían necesidades directamente a la bandeja digital de la URH. Nivel educativo superior/universitario predeterminado, sin pregunta repetida; grados, títulos y especialidad editables. Pueden descargar su propia declaración Word.
- **URH:** único perfil con acceso digital por correo y contraseña en Supabase Auth. Consulta y revisa todas las fichas presentadas. Para validar personal y administradores exige la referencia del documento físico firmado; para autoridades puede revisar directamente la declaración. Se registra un evento auditable de conformidad documental.

## Privacidad y límites deliberados

Ninguna contraseña de URH se incorpora al repositorio, los HTML, los ZIP ni las capturas. La cuenta de URH debe existir en Supabase Auth y estar vinculada a `profiles.role = urh_admin`. El correo puede figurar como dato público de contacto, pero la contraseña **debe** configurarse y gestionarse exclusivamente en Supabase.

La conformidad física firmada por Administración de Facultad no se presenta como una validación digital automática; la URH realiza el cotejo final y marca el estado validado. No se permite que un usuario anónimo lea o cambie declaraciones de terceros.

## Archivos modificados

- `app.js`: acceso público sin revisor, página de conformidad documental, URH como único revisor digital, Word individual y acta, nivel superior automático para autoridades.
- `docx.js`: `buildFicha` y `buildActaConformidad` en Word Arial 11, español, con firmas y código de recepción.
- `index.html`: versionado de archivos JavaScript para evitar caché.
- `supabase/functions/unt-registros/index.ts`: recepción directa y nivel educativo de autoridades normalizado en servidor.
- `supabase/functions/unt-faculty-supervised/index.ts`: solo URH; validación mediante RPC transaccional con referencia de documento firmado.
- `supabase/migracion_v19_2_0_conformidad_documental.sql`: tabla y función auditadas. Es aditiva.

## Condiciones pendientes antes de producción

Las pruebas del frontend y los Word se realizaron localmente. **No se ejecutó la migración ni una prueba de usuarios reales en el proyecto Supabase institucional**; esos pasos deben verificarse sobre una base de ensayo antes de recibir información personal.
