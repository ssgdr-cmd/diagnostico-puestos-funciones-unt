-- UNT · FACULTADES · V19.1.2 · Identidad confirmada y cambios de revisores auditados.
-- Requiere migraciones v19_api, v19_1_estabilizacion, v19_1_1_api_local.
-- Migración aditiva: no elimina fichas existentes. Aplicar primero en ensayo.
BEGIN;

-- Identidad autentificada en Supabase Auth; las fichas anteriores quedan NULL
-- y requieren demostrar titularidad del correo al recuperarse.
ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS verified_user_id uuid;
CREATE INDEX IF NOT EXISTS unt_submissions_verified_user_v1912
  ON public.intake_submissions(verified_user_id)
  WHERE verified_user_id IS NOT NULL;

-- El padrón es administrado exclusivamente por la URH, mediante SQL autorizado.
-- Un registro no se admite si no presenta correo UNITRU activo (validado por Edge Function).
-- Se evitan restricciones NOT NULL retroactivas que invaliden padrones existentes incompletos.

-- Historial íntegro de altas, bajas y reactivaciones de revisores.
CREATE TABLE IF NOT EXISTS public.unt_reviewer_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 faculty_id text NOT NULL REFERENCES public.faculties(id),
 reviewer_email text NOT NULL,
 actor_id uuid NOT NULL,
 old_active boolean,
 new_active boolean NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS unt_reviewer_events_faculty_v1912
  ON public.unt_reviewer_events(faculty_id,changed_at DESC);
ALTER TABLE public.unt_reviewer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_reviewer_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.unt_reviewer_events TO service_role;

-- Se ejecuta con el rol service_role, después de comprobar JWT y rol URH en la API.
-- Un cambio y su evento de auditoría se guardan en la MISMA transacción PostgreSQL.
CREATE OR REPLACE FUNCTION public.unt_set_reviewer_v1912(
 p_faculty text,p_email text,p_active boolean,p_actor uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_old boolean; v_has_old boolean;
BEGIN
 IF p_actor IS NULL OR p_active IS NULL OR p_faculty IS NULL
    OR p_email IS NULL OR p_email !~ '^[^@[:space:]]+@unitru[.]edu[.]pe$'
    OR NOT EXISTS(SELECT 1 FROM public.faculties WHERE id=p_faculty)
 THEN RAISE EXCEPTION 'Parámetros de revisor inválidos'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='urh_admin') THEN
   RAISE EXCEPTION 'El actor no es administrador URH';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_faculty||'|'||p_email,0));
 SELECT active INTO v_old FROM public.unt_faculty_reviewers
   WHERE faculty_id=p_faculty AND email=p_email FOR UPDATE;
 v_has_old:=FOUND;
 IF v_has_old AND v_old IS NOT DISTINCT FROM p_active THEN RETURN true; END IF;
 INSERT INTO public.unt_faculty_reviewers(faculty_id,email,active)
  VALUES(p_faculty,p_email,p_active)
 ON CONFLICT(faculty_id,email) DO UPDATE SET active=EXCLUDED.active;
 INSERT INTO public.unt_reviewer_events(faculty_id,reviewer_email,actor_id,old_active,new_active)
  VALUES(p_faculty,p_email,p_actor,CASE WHEN v_has_old THEN v_old ELSE NULL END,p_active);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.unt_set_reviewer_v1912(text,text,boolean,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_set_reviewer_v1912(text,text,boolean,uuid)
 TO service_role;
COMMIT;

-- Comprobación de ensayo (solo lectura):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='intake_submissions' AND column_name='verified_user_id';
-- SELECT proname FROM pg_proc WHERE proname='unt_set_reviewer_v1912';
-- SELECT count(*) FROM public.unt_reviewer_events;
