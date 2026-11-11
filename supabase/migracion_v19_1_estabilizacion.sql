-- UNT FACULTADES V19.1: estabilización ADITIVA. EJECUTAR DESPUÉS DE V19.
-- No elimina registros ni modifica credenciales existentes.
BEGIN;
-- Bloqueo transaccional impide que dos solicitudes simultáneas creen dos fichas.
CREATE OR REPLACE FUNCTION public.unt_prevent_duplicate_v191()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_code text;
BEGIN
 v_code := upper(trim(coalesce(NEW.worker_code,'')));
 IF v_code='' THEN RAISE EXCEPTION 'Código de trabajador obligatorio'; END IF;
 -- Solo nuevas fichas y cambios de identidad; las existentes no se invalidan por actualizaciones de contenido.
 IF TG_OP = 'INSERT' OR NEW.worker_code IS DISTINCT FROM OLD.worker_code OR NEW.faculty_id IS DISTINCT FROM OLD.faculty_id THEN
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.faculty_id||'|'||v_code,0));
   IF EXISTS (SELECT 1 FROM public.intake_submissions s
     WHERE s.faculty_id=NEW.faculty_id AND upper(trim(s.worker_code))=v_code
       AND (TG_OP='INSERT' OR s.id<>NEW.id)
       AND (s.edit_token_hash IS NOT NULL OR s.status IN ('submitted','changes_requested','validated','forwarded')))
   THEN RAISE EXCEPTION 'Ya existe una ficha de este trabajador en la facultad (incluidos borradores V19).'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS unt_intake_unique_v191 ON public.intake_submissions;
CREATE TRIGGER unt_intake_unique_v191 BEFORE INSERT OR UPDATE OF worker_code,faculty_id
 ON public.intake_submissions FOR EACH ROW EXECUTE FUNCTION public.unt_prevent_duplicate_v191();
REVOKE ALL ON FUNCTION public.unt_prevent_duplicate_v191() FROM PUBLIC,anon,authenticated;
-- Consulta de duplicados preexistentes para saneamiento manual de URH (no borrar automáticamente).
COMMIT;
-- SELECT faculty_id,upper(trim(worker_code)) codigo,count(*) cantidad
-- FROM public.intake_submissions GROUP BY faculty_id,upper(trim(worker_code)) HAVING count(*)>1;
