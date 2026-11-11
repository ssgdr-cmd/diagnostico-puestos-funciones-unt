-- V19.1.9 · Equipos compartidos: borradores antiguos no bloquean una nueva declaración.
-- Mantiene intactos los registros; no elimina información ni abre su lectura pública.
-- Aplicar una vez después de las migraciones V19 a V19.1.4.
BEGIN;
CREATE OR REPLACE FUNCTION public.unt_prevent_duplicate_v191()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_code text;
BEGIN
  v_code := upper(trim(coalesce(NEW.worker_code,'')));
  IF v_code = '' THEN RAISE EXCEPTION 'Código de trabajador obligatorio'; END IF;
  -- Se permiten varios borradores de sesiones interrumpidas; solo uno presentado
  -- para el mismo código y la misma facultad. La URH revisa la identidad.
  IF NEW.status IN ('submitted','changes_requested','validated','forwarded') THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.faculty_id||'|'||v_code,0));
    IF EXISTS (
      SELECT 1 FROM public.intake_submissions s
      WHERE s.faculty_id = NEW.faculty_id
        AND upper(trim(s.worker_code)) = v_code
        AND s.id <> NEW.id
        AND s.status IN ('submitted','changes_requested','validated','forwarded')
    ) THEN
      RAISE EXCEPTION 'Ya existe una declaración presentada para este trabajador y facultad';
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- Ajuste para la ficha propia del administrador: un borrador antiguo tampoco
-- debe reservar permanentemente la única plaza por facultad.
DROP INDEX IF EXISTS public.unt_single_admin_functional_record;
CREATE UNIQUE INDEX unt_single_admin_functional_record
 ON public.intake_submissions(faculty_id)
 WHERE receipt_code LIKE 'ADM-%'
 AND status IN ('submitted','changes_requested','validated','forwarded');
DROP TRIGGER IF EXISTS unt_intake_unique_v191 ON public.intake_submissions;
CREATE TRIGGER unt_intake_unique_v191
BEFORE INSERT OR UPDATE OF worker_code,faculty_id,status
ON public.intake_submissions FOR EACH ROW
EXECUTE FUNCTION public.unt_prevent_duplicate_v191();
REVOKE ALL ON FUNCTION public.unt_prevent_duplicate_v191() FROM PUBLIC,anon,authenticated;
COMMIT;
