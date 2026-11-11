-- UNT FACULTADES V19.3.2 · Integridad de revisión y oficio.
-- Instalar DESPUÉS de V19.3.0. Migración aditiva sobre la base existente.
-- Conservar copia de seguridad antes de aplicar en producción.
-- NO crea usuarios, códigos ni verificaciones de correo para los declarantes.
BEGIN;
ALTER TABLE public.unt_faculty_review_checks
 ADD COLUMN IF NOT EXISTS reviewed_revision integer;
-- Preservar las revisiones existentes si corresponden a la versión actual registrada.
UPDATE public.unt_faculty_review_checks c
SET reviewed_revision = s.revision_no
FROM public.intake_submissions s
WHERE c.record_id=s.id AND c.faculty_id=s.faculty_id
  AND c.checked=true AND c.reviewed_revision IS NULL;

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
 IF (p_content - 'functions') IS DISTINCT FROM (v.content - 'functions') THEN
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
 notes=EXCLUDED.notes,checked_at=null,reviewed_revision=null,updated_at=now();
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
 INSERT INTO public.unt_faculty_review_checks(record_id,faculty_id,checked,reviewer_name,checked_at,reviewed_revision)
 VALUES(p_record,p_faculty,p_checked,left(trim(p_reviewer),150),CASE WHEN p_checked THEN now() ELSE null END,CASE WHEN p_checked THEN v.revision_no ELSE null END)
 ON CONFLICT(record_id) DO UPDATE SET checked=EXCLUDED.checked,reviewer_name=EXCLUDED.reviewer_name,
 checked_at=EXCLUDED.checked_at,reviewed_revision=EXCLUDED.reviewed_revision,updated_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.unt_faculty_review_mark_v1921(uuid,text,boolean,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_faculty_review_mark_v1921(uuid,text,boolean,text,integer) TO service_role;

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
         AND c.reviewed_revision=v_row.revision_no
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
    WHERE s.role_at_submission='staff' AND ch.checked=true AND ch.reviewed_revision=s.revision_no
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
COMMIT;
