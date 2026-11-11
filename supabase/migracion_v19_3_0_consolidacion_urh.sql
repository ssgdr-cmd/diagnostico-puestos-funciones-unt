-- FACULTADES UNT V19.3.0 · CONSOLIDACIÓN URH Y VALIDACIÓN FINAL.
-- EJECUTAR DESPUÉS DE V19.2.1. En producción, respaldar la base antes.
-- Migración aditiva: no borra fichas ni modifica el contenido declarado.
BEGIN;
CREATE OR REPLACE FUNCTION public.unt_urh_progress_v1930(p_actor uuid)
RETURNS TABLE (
 faculty_id text, roster_expected bigint, drafts bigint, submitted bigint,
 faculty_reviewed bigint, urh_validated bigint, forwarded bigint, authorities bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT f.id,
   (SELECT count(*) FROM public.unt_staff_roster ro
    WHERE ro.faculty_id=f.id AND ro.active=true)::bigint AS roster_expected,
   count(DISTINCT upper(trim(s.worker_code))) FILTER (
    WHERE s.status='draft' AND NOT EXISTS (
      SELECT 1 FROM public.intake_submissions prev
      WHERE prev.faculty_id=s.faculty_id
        AND upper(trim(prev.worker_code))=upper(trim(s.worker_code))
        AND prev.status IN ('submitted','changes_requested','validated','forwarded')
    )
   )::bigint AS drafts,
   count(DISTINCT upper(trim(s.worker_code))) FILTER (
    WHERE s.role_at_submission='staff' AND s.status IN ('submitted','changes_requested','validated','forwarded')
   )::bigint AS submitted,
   count(DISTINCT s.id) FILTER (
    WHERE s.role_at_submission='staff' AND ch.checked=true
      AND s.status IN ('submitted','validated','forwarded')
   )::bigint AS faculty_reviewed,
   count(DISTINCT s.id) FILTER (WHERE s.role_at_submission='staff' AND s.status='validated')::bigint AS urh_validated,
   count(DISTINCT s.id) FILTER (WHERE s.role_at_submission='staff' AND s.status='forwarded')::bigint AS forwarded,
   count(DISTINCT s.id) FILTER (
    WHERE s.role_at_submission='authority' AND s.status IN ('submitted','validated','forwarded')
   )::bigint AS authorities
 FROM public.faculties f
 LEFT JOIN public.intake_submissions s ON s.faculty_id=f.id
 LEFT JOIN public.unt_faculty_review_checks ch ON ch.record_id=s.id AND ch.faculty_id=f.id
 WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=p_actor AND p.role='urh_admin')
 GROUP BY f.id ORDER BY f.id;
$$;
REVOKE ALL ON FUNCTION public.unt_urh_progress_v1930(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_urh_progress_v1930(uuid) TO service_role;

-- Reforzar la aprobación final: marcar revisado en facultad + oficio firmado SGDUNT.
-- La declaración de autoridades llega directamente a la URH sin marca previa de facultad.
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
    RAISE EXCEPTION 'Falta la referencia del oficio firmado y tramitado por SGDUNT';
  END IF;
  -- La marca de revisión es evidencia de control previo, no sustituye el oficio firmado.
  -- Sin esa marca, la URH no puede aprobar una ficha del personal.
  IF p_decision='approve' AND v_row.role_at_submission <> 'authority'
     AND NOT EXISTS (
       SELECT 1 FROM public.unt_faculty_review_checks c
       WHERE c.record_id=p_record AND c.faculty_id=p_faculty AND c.checked=true
     ) THEN
     RAISE EXCEPTION 'Primero debe constar la revisión de la facultad; coteje el oficio firmado y el registro digital';
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

REVOKE ALL ON FUNCTION public.unt_review_document_v1920(uuid,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_review_document_v1920(uuid,text,text,text,text,uuid) TO service_role;
COMMIT;
