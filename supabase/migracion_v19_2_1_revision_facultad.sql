-- UNT FACULTADES V19.2.1. Migración aditiva posterior a V19.2.0.
-- Revisión de personal de una facultad mediante enlace único emitido por URH.
-- NO publicar ni guardar enlaces o tokens en GitHub.
-- Ejecutar en un entorno de ensayo y respaldar antes de producción.
BEGIN;
CREATE TABLE IF NOT EXISTS public.unt_faculty_review_links (
 faculty_id text PRIMARY KEY REFERENCES public.faculties(id),
 token_hash text NOT NULL UNIQUE,
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 last_used_at timestamptz
);
ALTER TABLE public.unt_faculty_review_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_faculty_review_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.unt_faculty_review_links TO service_role;

CREATE TABLE IF NOT EXISTS public.unt_faculty_review_checks (
 record_id uuid PRIMARY KEY REFERENCES public.intake_submissions(id),
 faculty_id text NOT NULL REFERENCES public.faculties(id),
 checked boolean NOT NULL DEFAULT false,
 reviewer_name text,
 notes text,
 checked_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS unt_faculty_review_checks_faculty_idx ON public.unt_faculty_review_checks(faculty_id,checked);
ALTER TABLE public.unt_faculty_review_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_faculty_review_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.unt_faculty_review_checks TO service_role;

CREATE TABLE IF NOT EXISTS public.unt_faculty_review_changes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 record_id uuid NOT NULL REFERENCES public.intake_submissions(id),
 faculty_id text NOT NULL REFERENCES public.faculties(id),
 revision_before integer NOT NULL,
 revision_after integer NOT NULL,
 old_content jsonb NOT NULL,
 new_content jsonb NOT NULL,
 change_reason text NOT NULL,
 reviewer_name text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS unt_faculty_review_changes_record_idx ON public.unt_faculty_review_changes(record_id,changed_at);
ALTER TABLE public.unt_faculty_review_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_faculty_review_changes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.unt_faculty_review_changes TO service_role;

CREATE OR REPLACE FUNCTION public.unt_faculty_review_save_v1921(
 p_record uuid, p_faculty text, p_content jsonb,
 p_reason text, p_reviewer text, p_revision integer
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.intake_submissions%ROWTYPE;
BEGIN
 IF p_record IS NULL OR p_faculty IS NULL OR length(trim(coalesce(p_reviewer,''))) < 5 THEN
  RAISE EXCEPTION 'Indique los nombres del administrador que revisa';
 END IF;
 SELECT * INTO v FROM public.intake_submissions WHERE id=p_record AND faculty_id=p_faculty FOR UPDATE;
 IF NOT FOUND OR v.role_at_submission <> 'staff' OR v.status <> 'submitted' THEN
  RAISE EXCEPTION 'La ficha no está disponible para edición de facultad';
 END IF;
 IF v.revision_no IS DISTINCT FROM p_revision THEN
  RAISE EXCEPTION 'La ficha cambió desde su última consulta. Actualice antes de modificar';
 END IF;
 IF jsonb_typeof(p_content) <> 'object' OR jsonb_typeof(p_content->'functions') <> 'array'
 OR length(p_content::text)>100000 THEN
  RAISE EXCEPTION 'Contenido de ficha inválido o demasiado extenso';
 END IF;
 IF p_content->'authority' IS DISTINCT FROM v.content->'authority'
 OR p_content->'observations' IS DISTINCT FROM v.content->'observations' THEN
  RAISE EXCEPTION 'La revisión de facultad solo permite corregir funciones, actividades y productos';
 END IF;
 IF p_content IS NOT DISTINCT FROM v.content THEN RETURN v.revision_no; END IF;
 IF length(trim(coalesce(p_reason,'')))<8 THEN
  RAISE EXCEPTION 'Explique brevemente las correcciones realizadas (mínimo 8 caracteres)';
 END IF;
 PERFORM pg_catalog.set_config('unt.actor_kind','facultad',true);
 UPDATE public.intake_submissions
 SET content=p_content,revision_no=v.revision_no+1,updated_at=now()
 WHERE id=p_record AND faculty_id=p_faculty AND status='submitted';
 INSERT INTO public.unt_faculty_review_changes
 (record_id,faculty_id,revision_before,revision_after,old_content,new_content,change_reason,reviewer_name)
 VALUES(p_record,p_faculty,v.revision_no,v.revision_no+1,v.content,p_content,left(trim(p_reason),1400),left(trim(p_reviewer),150));
 INSERT INTO public.unt_faculty_review_checks(record_id,faculty_id,checked,reviewer_name,notes,checked_at)
 VALUES(p_record,p_faculty,false,left(trim(p_reviewer),150),left(trim(p_reason),1400),null)
 ON CONFLICT(record_id) DO UPDATE SET checked=false,reviewer_name=EXCLUDED.reviewer_name,
 notes=EXCLUDED.notes,checked_at=null,updated_at=now();
 RETURN v.revision_no+1;
END $$;
REVOKE ALL ON FUNCTION public.unt_faculty_review_save_v1921(uuid,text,jsonb,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_faculty_review_save_v1921(uuid,text,jsonb,text,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.unt_faculty_review_mark_v1921(
 p_record uuid,p_faculty text,p_checked boolean,p_reviewer text,p_revision integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.intake_submissions%ROWTYPE;
BEGIN
 IF length(trim(coalesce(p_reviewer,'')))<5 THEN RAISE EXCEPTION 'Indique los nombres del administrador que revisa'; END IF;
 SELECT * INTO v FROM public.intake_submissions WHERE id=p_record AND faculty_id=p_faculty FOR UPDATE;
 IF NOT FOUND OR v.role_at_submission <> 'staff' OR v.status <> 'submitted'
    OR v.revision_no IS DISTINCT FROM p_revision THEN
  RAISE EXCEPTION 'La ficha no está disponible o fue modificada';
 END IF;
 INSERT INTO public.unt_faculty_review_checks(record_id,faculty_id,checked,reviewer_name,checked_at)
 VALUES(p_record,p_faculty,p_checked,left(trim(p_reviewer),150),CASE WHEN p_checked THEN now() ELSE null END)
 ON CONFLICT(record_id) DO UPDATE SET checked=EXCLUDED.checked,reviewer_name=EXCLUDED.reviewer_name,
 checked_at=EXCLUDED.checked_at,updated_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.unt_faculty_review_mark_v1921(uuid,text,boolean,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_faculty_review_mark_v1921(uuid,text,boolean,text,integer) TO service_role;
COMMIT;
