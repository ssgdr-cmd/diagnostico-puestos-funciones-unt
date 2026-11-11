-- UNT V19.2.0 · CONFORMIDAD DOCUMENTAL — MIGRACIÓN ADITIVA.
-- Ejecutar una sola vez tras V19.1.9, con copia de seguridad de producción.
-- No elimina registros anteriores. El acceso digital a fichas de terceros
-- corresponde exclusivamente a usuarios URH autenticados.
BEGIN;
CREATE TABLE IF NOT EXISTS public.unt_document_verifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id uuid NOT NULL REFERENCES public.intake_submissions(id),
  faculty_id text NOT NULL REFERENCES public.faculties(id),
  document_reference text NOT NULL,
  verified_by uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(record_id)
);
ALTER TABLE public.unt_document_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_document_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.unt_document_verifications TO service_role;

CREATE OR REPLACE FUNCTION public.unt_review_document_v1920(
  p_record uuid,
  p_faculty text,
  p_decision text,
  p_note text,
  p_document_reference text,
  p_actor uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.intake_submissions%ROWTYPE;
  v_document text := trim(coalesce(p_document_reference,''));
BEGIN
  IF p_actor IS NULL OR p_record IS NULL OR p_faculty IS NULL
     OR p_decision NOT IN ('approve','return') THEN
    RAISE EXCEPTION 'Parámetros inválidos';
  END IF;
  -- La función Edge autentica al usuario, pero el RPC vuelve a comprobar
  -- su adscripción real a URH: un parámetro cliente no puede otorgar acceso.
  IF NOT EXISTS (SELECT 1 FROM public.profiles
       WHERE id=p_actor AND role='urh_admin') THEN
    RAISE EXCEPTION 'Solo URH puede validar digitalmente registros';
  END IF;
  SELECT * INTO v_row FROM public.intake_submissions
    WHERE id=p_record AND faculty_id=p_faculty FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'submitted' THEN
    RAISE EXCEPTION 'Ficha no disponible para revisión';
  END IF;
  IF p_decision='return' AND length(trim(coalesce(p_note,'')))<8 THEN
    RAISE EXCEPTION 'Indique una observación verificable';
  END IF;
  IF p_decision='approve' AND v_row.role_at_submission <> 'authority'
     AND length(v_document)<4 THEN
    RAISE EXCEPTION 'Falta la referencia del Word firmado por la Administración de Facultad';
  END IF;
  PERFORM pg_catalog.set_config('unt.actor_kind','urh',true);
  PERFORM pg_catalog.set_config('unt.actor_id',p_actor::text,true);
  UPDATE public.intake_submissions SET
    status=CASE WHEN p_decision='approve' THEN 'validated' ELSE 'changes_requested' END,
    review_note=CASE WHEN p_decision='return' THEN left(trim(p_note),1400) ELSE NULL END,
    reviewed_by=p_actor,reviewed_at=now(),updated_at=now()
  WHERE id=p_record AND faculty_id=p_faculty AND status='submitted';
  IF p_decision='approve' AND v_row.role_at_submission <> 'authority' THEN
    INSERT INTO public.unt_document_verifications
      (record_id,faculty_id,document_reference,verified_by)
    VALUES(p_record,p_faculty,left(v_document,160),p_actor);
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.unt_review_document_v1920(uuid,text,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unt_review_document_v1920(uuid,text,text,text,text,uuid)
  TO service_role;
COMMIT;
