-- Consulta de SOLO LECTURA. No muestra fichas ni datos personales.
SELECT 'Tabla fichas' AS componente,
       to_regclass('public.intake_submissions') IS NOT NULL AS disponible
UNION ALL
SELECT 'Tabla enlaces facultad',to_regclass('public.unt_faculty_review_links') IS NOT NULL
UNION ALL
SELECT 'Tabla revisiones',to_regclass('public.unt_faculty_review_checks') IS NOT NULL
UNION ALL
SELECT 'Historial de correcciones',to_regclass('public.unt_faculty_review_changes') IS NOT NULL
UNION ALL
SELECT 'Oficios cotejados',to_regclass('public.unt_document_verifications') IS NOT NULL
UNION ALL
SELECT 'Columna versión revisada',EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='unt_faculty_review_checks' AND column_name='reviewed_revision'
)
UNION ALL
SELECT 'RPC guardar revisión',to_regprocedure('public.unt_faculty_review_save_v1921(uuid,text,jsonb,text,text,integer)') IS NOT NULL
UNION ALL
SELECT 'RPC marcar revisión',to_regprocedure('public.unt_faculty_review_mark_v1921(uuid,text,boolean,text,integer)') IS NOT NULL
UNION ALL
SELECT 'RPC validar URH',to_regprocedure('public.unt_review_document_v1920(uuid,text,text,text,text,uuid)') IS NOT NULL
UNION ALL
SELECT 'RPC tablero URH',to_regprocedure('public.unt_urh_progress_v1930(uuid)') IS NOT NULL;
