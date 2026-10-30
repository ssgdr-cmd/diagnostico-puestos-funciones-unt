# Guía de instalación V14 – Solo GitHub Web + Supabase Web

## Parte A. Publicar o actualizar la interfaz (GitHub)

1. Descomprima el ZIP; no cargue el archivo ZIP directamente al repositorio.
2. Abra `https://github.com/ssgdr-cmd/diagnostico-puestos-funciones-unt` → rama `main` → **Add file → Upload files**.
3. Arrastre **el contenido** de la carpeta V14 para reemplazar los archivos existentes, manteniendo `index.html`, `app.js`, `styles.css`, `assets/` y `supabase/` en las rutas indicadas. **No borre `config.js`** si ya tiene bien configuradas la URL y la clave pública.
4. Confirme con `Actualización V14 - alertas de función y API IA` → **Commit changes**.
5. En `Settings → Pages`, compruebe `Deploy from a branch → main → /(root)`. La URL del sitio es `https://ssgdr-cmd.github.io/diagnostico-puestos-funciones-unt/`.

## Parte B. Habilitar IA real (no basta GitHub)

**B1. Comprobación de base:** en Supabase → SQL Editor ejecute solo esta consulta, que no modifica datos:

```sql
select to_regclass('public.intake_rate_counters') as contadores;
```

Si devuelve `NULL`, revise antes la migración `supabase/migracion_v6_acceso_simple.sql` y su compatibilidad con el esquema existente. No ejecute de nuevo `schema.sql` ni replique migraciones ya aplicadas.

**B2. Turnstile:** en Cloudflare Turnstile configure el hostname `ssgdr-cmd.github.io`, copie la **site key** (pública) a `turnstileSiteKey` de `config.js` y la **secret key** a Supabase → Edge Functions → Secrets bajo `UNT_TURNSTILE_SECRET`.

**B3. Secretos:** en Supabase → Edge Functions → Secrets registre `OPENAI_API_KEY` (clave de OpenAI API, no de ChatGPT), `UNT_RATE_SALT` (cadena aleatoria larga), y `UNT_DATABASE_SECRET` (clave secreta de Supabase para el lado servidor, solo si resulta necesaria; nunca en GitHub). Opcionalmente: `OPENAI_MODEL=gpt-4.1-mini`. No comparta valores privados en capturas.

**B4. Despliegue:** Supabase → Edge Functions → **Deploy a new function → Via Editor**. Nombre `unt-ai-formulacion`. Copie el archivo `supabase/functions/unt-ai-formulacion/index.ts` desde la pestaña Raw de GitHub y péguelo íntegro. Presione **Deploy**. En la configuración de la función establezca **Verify JWT = OFF** porque el formulario se usa sin cuentas individuales; esto exige mantener activos Turnstile y la limitación de consultas que aplica el servidor. Si ya existe la función, elija **Edit code → Deploy updates**.

**B5. Verificación:** con datos ficticios, pruebe por separado ayuda de función, actividad y producto. La IA real no funcionará si faltan Turnstile, los secretos, los contadores o el despliegue. No reciba datos identificables reales hasta verificar la recepción y los permisos del resto del sistema.

## Qué hace la alerta

- Si se escribe «Me encargo de trámites», mostrará una sugerencia sobre el verbo inicial; podrá continuar normalmente.
- Si se escribe «Gestionar», solicitará precisar el objeto cuando exista texto suficiente para analizarlo.
- Si se escribe «Gestionar la documentación administrativa de la facultad para asegurar la tramitación oportuna», no se prevé alerta estructural.
- La relación entre función, actividad y producto se evalúa orientativamente; no bloquea ni reemplaza la validación institucional.

Las comprobaciones anteriores son locales. Para evaluar semánticamente una descripción, debe estar activo el servicio de IA.

## Fuentes técnicas

- Supabase: https://supabase.com/docs/guides/functions/quickstart-dashboard
- Supabase: https://supabase.com/docs/guides/functions/auth
- OpenAI: https://developers.openai.com/api/docs/models/gpt-4.1-mini
- OpenAI: https://developers.openai.com/api/docs/guides/structured-outputs
