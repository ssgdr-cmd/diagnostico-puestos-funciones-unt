-- FACULTADES UNT V19.1.3. EJECUTAR DESPUES de V19, V19.1, V19.1.1 y V19.1.2.
-- ADITIVA: mantiene las fichas, roles y tablas anteriores. Ensayar con respaldo.
BEGIN;

-- Las autorizaciones no exponen datos ni códigos de recuperación al personal URH.
CREATE TABLE IF NOT EXISTS public.unt_recovery_grants_v1913 (
 record_id uuid PRIMARY KEY REFERENCES public.intake_submissions(id),
 faculty_id text NOT NULL REFERENCES public.faculties(id),
 authorized_by uuid NOT NULL,
 reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
 approved_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS unt_grants_expiration_v1913 ON public.unt_recovery_grants_v1913(expires_at);
ALTER TABLE public.unt_recovery_grants_v1913 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_recovery_grants_v1913 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.unt_recovery_grants_v1913 TO service_role;

CREATE TABLE IF NOT EXISTS public.unt_dispatch_decisions_v1913 (
 dispatch_id uuid PRIMARY KEY REFERENCES public.unt_intake_dispatches(id),
 faculty_id text NOT NULL REFERENCES public.faculties(id),
 actor_id uuid NOT NULL,
 is_partial boolean NOT NULL,
 justification text,
 expected_count integer NOT NULL CHECK (expected_count >= 1),
 covered_count integer NOT NULL CHECK (covered_count >= 0),
 missing_count integer NOT NULL CHECK (missing_count >= 0),
 pending_count integer NOT NULL CHECK (pending_count >= 0),
 authorized_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT is_partial OR length(btrim(coalesce(justification,'')))>=20)
);
ALTER TABLE public.unt_dispatch_decisions_v1913 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_dispatch_decisions_v1913 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.unt_dispatch_decisions_v1913 TO service_role;

-- Cobertura = TODO el padrón activo, no solo los formularios recibidos.
CREATE OR REPLACE FUNCTION public.unt_faculty_coverage_v1913(p_faculty text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_expected integer; v_completed integer; v_missing integer; v_pending integer; v_valid integer; v_identity_issues integer;
BEGIN
 SELECT count(*) INTO v_expected FROM public.unt_staff_roster r
 WHERE r.faculty_id=p_faculty AND r.active=true;
 SELECT count(*) INTO v_completed FROM public.unt_staff_roster r
 WHERE r.faculty_id=p_faculty AND r.active=true
 AND EXISTS (SELECT 1 FROM public.intake_submissions s WHERE s.faculty_id=r.faculty_id
   AND upper(btrim(s.worker_code))=upper(btrim(r.worker_code)) AND lower(btrim(s.profile->>'institutional_email'))=lower(btrim(r.institutional_email)) AND s.status IN ('validated','forwarded'));
 SELECT count(*) INTO v_missing FROM public.unt_staff_roster r
 WHERE r.faculty_id=p_faculty AND r.active=true
 AND NOT EXISTS (SELECT 1 FROM public.intake_submissions s WHERE s.faculty_id=r.faculty_id AND upper(btrim(s.worker_code))=upper(btrim(r.worker_code)));
 SELECT count(*) INTO v_pending FROM public.unt_staff_roster r
 WHERE r.faculty_id=p_faculty AND r.active=true AND r.institutional_email IS NOT NULL AND btrim(r.institutional_email)<>''
 AND EXISTS (SELECT 1 FROM public.intake_submissions s WHERE s.faculty_id=r.faculty_id AND upper(btrim(s.worker_code))=upper(btrim(r.worker_code))
    AND s.status IN ('draft','submitted','changes_requested'))
 AND NOT EXISTS (SELECT 1 FROM public.intake_submissions s WHERE s.faculty_id=r.faculty_id AND upper(btrim(s.worker_code))=upper(btrim(r.worker_code))
    AND s.status IN ('validated','forwarded'));
 SELECT count(*) INTO v_identity_issues FROM public.unt_staff_roster r
 WHERE r.faculty_id=p_faculty AND r.active=true
 AND (r.institutional_email IS NULL OR btrim(r.institutional_email)='' OR
      EXISTS (SELECT 1 FROM public.intake_submissions s WHERE s.faculty_id=r.faculty_id
        AND upper(btrim(s.worker_code))=upper(btrim(r.worker_code))
        AND lower(btrim(s.profile->>'institutional_email')) IS DISTINCT FROM lower(btrim(r.institutional_email))));
 SELECT count(*) INTO v_valid FROM public.intake_submissions s WHERE s.faculty_id=p_faculty AND s.status='validated';
 RETURN jsonb_build_object('expected',v_expected,'completed',v_completed,'missing',v_missing,'pending',v_pending,'identity_issues',v_identity_issues,'validated_available',v_valid);
END $$;
REVOKE ALL ON FUNCTION public.unt_faculty_coverage_v1913(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_faculty_coverage_v1913(text) TO service_role;

-- El permiso de recuperación lo concede solo URH después de verificar identidad fuera de la aplicación.
-- Es específico de la ficha; nunca revela códigos ni edita sus datos.
CREATE OR REPLACE FUNCTION public.unt_authorize_recovery_v1913(
 p_faculty text,p_worker_code text,p_actor uuid,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.intake_submissions%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR length(btrim(coalesce(p_reason,'')))<20 OR length(btrim(coalesce(p_worker_code,'')))<1 THEN
  RAISE EXCEPTION 'Identificación y justificación son obligatorias'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='urh_admin') THEN
  RAISE EXCEPTION 'Únicamente la URH puede autorizar recuperaciones'; END IF;
 SELECT * INTO v_row FROM public.intake_submissions
 WHERE faculty_id=p_faculty AND upper(btrim(worker_code))=upper(btrim(p_worker_code))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.unt_staff_roster r WHERE r.faculty_id=p_faculty
      AND upper(btrim(r.worker_code))=upper(btrim(v_row.worker_code)) AND r.active=true
      AND lower(btrim(r.institutional_email))=lower(btrim(v_row.profile->>'institutional_email')))
 THEN RAISE EXCEPTION 'La ficha no existe o su titular no está activo en el padrón'; END IF;
 INSERT INTO public.unt_recovery_grants_v1913(record_id,faculty_id,authorized_by,reason,approved_at,expires_at,consumed_at)
 VALUES (v_row.id,p_faculty,p_actor,left(btrim(p_reason),1000),now(),now()+interval '24 hours',NULL)
 ON CONFLICT (record_id) DO UPDATE SET faculty_id=EXCLUDED.faculty_id,authorized_by=EXCLUDED.authorized_by,
 reason=EXCLUDED.reason,approved_at=now(),expires_at=EXCLUDED.expires_at,consumed_at=NULL;
 INSERT INTO public.unt_intake_events(record_id,faculty_id,actor_kind,actor_id,action,old_status,new_status,note)
 VALUES(v_row.id,p_faculty,'urh',p_actor,'recovery_authorized',v_row.status,v_row.status,left(btrim(p_reason),1000));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.unt_authorize_recovery_v1913(text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_authorize_recovery_v1913(text,text,uuid,text) TO service_role;

-- Genera NUEVO hash y consume autorización al mismo tiempo. El secreto se genera
-- en la Edge Function, NUNCA se guarda en SQL y se entrega solo al titular autenticado.
CREATE OR REPLACE FUNCTION public.unt_recover_with_grant_v1913(
 p_faculty text,p_worker_code text,p_email text,p_actor uuid,p_new_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.intake_submissions%ROWTYPE; v_grant public.unt_recovery_grants_v1913%ROWTYPE;
DECLARE v_actor_email text;
BEGIN
 IF p_actor IS NULL OR p_new_hash IS NULL OR p_new_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Solicitud de recuperación incorrecta'; END IF;
 SELECT lower(email) INTO v_actor_email FROM auth.users WHERE id=p_actor AND email_confirmed_at IS NOT NULL;
 IF NOT FOUND OR v_actor_email IS NULL OR v_actor_email<>lower(btrim(p_email)) THEN
  RAISE EXCEPTION 'Identidad autenticada no coincide'; END IF;
 SELECT * INTO v_row FROM public.intake_submissions
  WHERE faculty_id=p_faculty AND upper(btrim(worker_code))=upper(btrim(p_worker_code))
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR lower(btrim(v_row.profile->>'institutional_email'))<>v_actor_email OR
    (v_row.verified_user_id IS NOT NULL AND v_row.verified_user_id<>p_actor) THEN
  RAISE EXCEPTION 'Ficha no corresponde al titular verificado'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.unt_staff_roster r WHERE r.faculty_id=p_faculty
 AND upper(btrim(r.worker_code))=upper(btrim(p_worker_code)) AND r.active=true
 AND lower(btrim(r.institutional_email))=v_actor_email) THEN
  RAISE EXCEPTION 'El titular no consta activo en el padrón'; END IF;
 SELECT * INTO v_grant FROM public.unt_recovery_grants_v1913 WHERE record_id=v_row.id FOR UPDATE;
 IF NOT FOUND OR v_grant.consumed_at IS NOT NULL OR v_grant.expires_at<=now() THEN
  RAISE EXCEPTION 'Solicite autorización de recuperación vigente a la URH'; END IF;
 UPDATE public.intake_submissions SET edit_token_hash=p_new_hash,verified_user_id=p_actor,updated_at=now()
 WHERE id=v_row.id;
 UPDATE public.unt_recovery_grants_v1913 SET consumed_at=now() WHERE record_id=v_row.id;
 INSERT INTO public.unt_intake_events(record_id,faculty_id,actor_kind,actor_id,action,old_status,new_status,note)
 VALUES(v_row.id,p_faculty,'declarante',p_actor,'recovered_supervised',v_row.status,v_row.status,'Código privado anterior invalidado');
 RETURN jsonb_build_object('id',v_row.id,'receipt',v_row.receipt_code,'status',v_row.status);
END $$;
REVOKE ALL ON FUNCTION public.unt_recover_with_grant_v1913(text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_recover_with_grant_v1913(text,text,text,uuid,text) TO service_role;

-- Revisión fuerte de cobertura, en una ÚNICA transacción con la remisión y su auditoría.
CREATE OR REPLACE FUNCTION public.unt_prepare_dispatch_v1913(
 p_faculty text,p_actor uuid,p_partial boolean DEFAULT false,p_reason text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_is_urh boolean;v_email text;v_counts jsonb;v_expected integer;v_complete integer;v_missing integer;v_pending integer;
DECLARE v_snapshot jsonb;v_count integer;v_id uuid;
BEGIN
 IF p_actor IS NULL OR p_faculty IS NULL OR NOT EXISTS(SELECT 1 FROM public.faculties WHERE id=p_faculty) THEN
  RAISE EXCEPTION 'Datos de remisión incorrectos'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='urh_admin') INTO v_is_urh;
 IF NOT v_is_urh THEN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_actor AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL OR NOT EXISTS (SELECT 1 FROM public.unt_faculty_reviewers
     WHERE faculty_id=p_faculty AND email=v_email AND active=true) THEN
   RAISE EXCEPTION 'Revisor no autorizado para esta facultad'; END IF;
 END IF;
 IF coalesce(p_partial,false) AND (NOT v_is_urh OR length(btrim(coalesce(p_reason,'')))<20) THEN
   RAISE EXCEPTION 'Solo la URH puede autorizar remisiones parciales con justificación'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('unt-remision|'||p_faculty,0));
 IF EXISTS (SELECT 1 FROM public.unt_intake_dispatches WHERE faculty_id=p_faculty AND status='prepared') THEN
   RAISE EXCEPTION 'Ya existe una remisión preparada pendiente'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.intake_submissions WHERE faculty_id=p_faculty AND receipt_code LIKE 'ADM-%'
    AND status IN ('validated','forwarded')) THEN
   RAISE EXCEPTION 'La ficha del administrador debe estar validada por URH'; END IF;
 v_counts:=public.unt_faculty_coverage_v1913(p_faculty);
 v_expected:=(v_counts->>'expected')::integer;v_complete:=(v_counts->>'completed')::integer;
 v_missing:=(v_counts->>'missing')::integer;v_pending:=(v_counts->>'pending')::integer;
 IF v_expected<1 THEN RAISE EXCEPTION 'Padrón activo vacío: no es posible verificar cobertura'; END IF;
 IF NOT coalesce(p_partial,false) AND (v_complete<>v_expected OR v_missing>0 OR v_pending>0) THEN
   RAISE EXCEPTION 'Cobertura incompleta: esperados %, cubiertos %, sin ficha %, pendientes %',v_expected,v_complete,v_missing,v_pending;
 END IF;
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',id,'name',owner_name,'worker_code',worker_code,
 'job_title',job_title,'org_unit',org_unit,'role',role_at_submission,'profile',profile,'content',content)
 ORDER BY created_at),'[]'::jsonb) INTO v_count,v_snapshot
 FROM public.intake_submissions WHERE faculty_id=p_faculty AND status='validated';
 IF v_count<1 THEN RAISE EXCEPTION 'No existen nuevas fichas validadas para remitir'; END IF;
 IF EXISTS (SELECT 1 FROM public.intake_submissions s WHERE s.faculty_id=p_faculty AND s.status='validated'
   AND NOT EXISTS(SELECT 1 FROM public.unt_staff_roster r WHERE r.faculty_id=p_faculty AND r.active=true
   AND upper(btrim(r.worker_code))=upper(btrim(s.worker_code))
   AND lower(btrim(r.institutional_email))=lower(btrim(s.profile->>'institutional_email')))) THEN
   RAISE EXCEPTION 'Existen fichas validadas sin identidad vigente en el padrón. URH debe regularizarlas antes de remitir';
 END IF;
 INSERT INTO public.unt_intake_dispatches(faculty_id,tracking_code,items_count,snapshot)
 VALUES(p_faculty,'UNT-'||p_faculty||'-'||replace(pg_catalog.gen_random_uuid()::text,'-',''),v_count,
 jsonb_build_object('records',v_snapshot,'coverage',v_counts,'partial',coalesce(p_partial,false),'justification',CASE WHEN p_partial THEN left(p_reason,1500) ELSE NULL END))
 RETURNING id INTO v_id;
 INSERT INTO public.unt_dispatch_decisions_v1913
 (dispatch_id,faculty_id,actor_id,is_partial,justification,expected_count,covered_count,missing_count,pending_count)
 VALUES(v_id,p_faculty,p_actor,coalesce(p_partial,false),CASE WHEN p_partial THEN left(btrim(p_reason),1500) ELSE NULL END,
 v_expected,v_complete,v_missing,v_pending);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.unt_prepare_dispatch_v1913(text,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_prepare_dispatch_v1913(text,uuid,boolean,text) TO service_role;

-- Impide que un cliente antiguo eluda el control de cobertura de la versión actual.
CREATE OR REPLACE FUNCTION public.unt_prepare_intake_dispatch(p_faculty text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Versión anterior deshabilitada. Utilice preparación V19.1.3 con verificación de cobertura'; END $$;
REVOKE ALL ON FUNCTION public.unt_prepare_intake_dispatch(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_prepare_intake_dispatch(text) TO service_role;

-- Revisión: refuerzo de roles, facultad y prohibición absoluta de autovalidación.
CREATE OR REPLACE FUNCTION public.unt_review_intake_v1911(
 p_record uuid,p_faculty text,p_decision text,p_note text,p_actor uuid,p_is_urh boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.intake_submissions%ROWTYPE;v_next text;v_actor_email text;v_real_urh boolean;
BEGIN
 IF p_record IS NULL OR length(btrim(coalesce(p_faculty,'')))<2 OR p_actor IS NULL
 OR p_decision NOT IN ('approve','return') THEN RAISE EXCEPTION 'Parámetros de revisión inválidos'; END IF;
 IF p_decision='return' AND length(btrim(coalesce(p_note,'')))<8 THEN RAISE EXCEPTION 'Observación demasiado corta'; END IF;
 SELECT lower(email) INTO v_actor_email FROM auth.users WHERE id=p_actor AND email_confirmed_at IS NOT NULL;
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='urh_admin') INTO v_real_urh;
 IF v_actor_email IS NULL THEN RAISE EXCEPTION 'Correo institucional no verificado'; END IF;
 IF coalesce(p_is_urh,false) IS DISTINCT FROM v_real_urh THEN RAISE EXCEPTION 'Rol institucional inconsistente'; END IF;
 IF NOT v_real_urh AND NOT EXISTS(SELECT 1 FROM public.unt_faculty_reviewers
 WHERE faculty_id=p_faculty AND email=v_actor_email AND active=true) THEN
 RAISE EXCEPTION 'No está autorizado para revisar esta facultad'; END IF;
 SELECT * INTO v_row FROM public.intake_submissions WHERE id=p_record AND faculty_id=p_faculty FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'submitted' THEN RAISE EXCEPTION 'Ficha no disponible para revisión'; END IF;
 IF v_row.verified_user_id=p_actor OR lower(btrim(v_row.profile->>'institutional_email'))=v_actor_email THEN
 RAISE EXCEPTION 'No se permite validar ni observar la propia ficha'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.unt_staff_roster r WHERE r.faculty_id=p_faculty
 AND upper(btrim(r.worker_code))=upper(btrim(v_row.worker_code)) AND r.active=true
 AND lower(btrim(r.institutional_email))=lower(btrim(v_row.profile->>'institutional_email'))) THEN
 RAISE EXCEPTION 'El trabajador y su correo no están vigentes en el padrón institucional'; END IF;
 IF v_row.receipt_code LIKE 'ADM-%' AND NOT v_real_urh THEN
 RAISE EXCEPTION 'La ficha del administrador solo puede ser revisada por URH'; END IF;
 v_next:=CASE WHEN p_decision='approve' THEN 'validated' ELSE 'changes_requested' END;
 PERFORM pg_catalog.set_config('unt.actor_kind',CASE WHEN v_real_urh THEN 'urh' ELSE 'facultad' END,true);
 PERFORM pg_catalog.set_config('unt.actor_id',p_actor::text,true);
 UPDATE public.intake_submissions SET status=v_next,
 review_note=CASE WHEN p_decision='return' THEN left(btrim(p_note),1400) ELSE NULL END,
 reviewed_by=p_actor,reviewed_at=now(),updated_at=now()
 WHERE id=p_record AND faculty_id=p_faculty AND status='submitted';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.unt_review_intake_v1911(uuid,text,text,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_review_intake_v1911(uuid,text,text,text,uuid,boolean) TO service_role;

-- La URH no puede habilitar como revisor un correo que todavía no tiene cuenta Auth confirmada.
CREATE OR REPLACE FUNCTION public.unt_set_reviewer_v1912(
 p_faculty text,p_email text,p_active boolean,p_actor uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old boolean;v_has_old boolean;
BEGIN
 IF p_actor IS NULL OR p_active IS NULL OR p_faculty IS NULL OR p_email IS NULL
 OR p_email !~ '^[^@[:space:]]+@unitru[.]edu[.]pe$'
 OR NOT EXISTS(SELECT 1 FROM public.faculties WHERE id=p_faculty)
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='urh_admin') THEN
 RAISE EXCEPTION 'Autorización de revisor inválida'; END IF;
 IF p_active=true AND NOT EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=p_email AND email_confirmed_at IS NOT NULL) THEN
 RAISE EXCEPTION 'El revisor debe tener una cuenta Supabase Auth y correo confirmado'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_faculty||'|'||p_email,0));
 SELECT active INTO v_old FROM public.unt_faculty_reviewers WHERE faculty_id=p_faculty AND email=p_email FOR UPDATE;
 v_has_old:=FOUND;
 IF v_has_old AND v_old IS NOT DISTINCT FROM p_active THEN RETURN true; END IF;
 INSERT INTO public.unt_faculty_reviewers(faculty_id,email,active) VALUES(p_faculty,p_email,p_active)
 ON CONFLICT(faculty_id,email) DO UPDATE SET active=EXCLUDED.active;
 INSERT INTO public.unt_reviewer_events(faculty_id,reviewer_email,actor_id,old_active,new_active)
 VALUES(p_faculty,p_email,p_actor,CASE WHEN v_has_old THEN v_old ELSE NULL END,p_active);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.unt_set_reviewer_v1912(text,text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_set_reviewer_v1912(text,text,boolean,uuid) TO service_role;


-- La remisión final identifica al responsable y se audita en la misma transacción.
CREATE OR REPLACE FUNCTION public.unt_forward_intake_v1913(
 p_dispatch uuid,p_office text,p_reference text,p_actor uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_dispatch public.unt_intake_dispatches%ROWTYPE; v_email text;v_urh boolean;
BEGIN
 IF p_dispatch IS NULL OR p_actor IS NULL OR length(btrim(coalesce(p_office,'')))<3 THEN
  RAISE EXCEPTION 'Datos de remisión insuficientes'; END IF;
 SELECT * INTO v_dispatch FROM public.unt_intake_dispatches WHERE id=p_dispatch FOR UPDATE;
 IF NOT FOUND OR v_dispatch.status<>'prepared' THEN RAISE EXCEPTION 'Remisión no disponible'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='urh_admin') INTO v_urh;
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_actor AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL OR (NOT v_urh AND NOT EXISTS(SELECT 1 FROM public.unt_faculty_reviewers
  WHERE faculty_id=v_dispatch.faculty_id AND email=v_email AND active=true)) THEN
   RAISE EXCEPTION 'Usuario no autorizado para registrar remisión'; END IF;
 PERFORM pg_catalog.set_config('unt.actor_kind',CASE WHEN v_urh THEN 'urh' ELSE 'facultad' END,true);
 PERFORM pg_catalog.set_config('unt.actor_id',p_actor::text,true);
 RETURN public.unt_forward_intake_dispatch(p_dispatch,p_office,p_reference);
END $$;
REVOKE ALL ON FUNCTION public.unt_forward_intake_v1913(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_forward_intake_v1913(uuid,text,text,uuid) TO service_role;

-- La URH debe poder consultar también remisiones preparadas para descargar
-- el proyecto de oficio y registrar su formalización. RLS no permite lectura a otros perfiles.
DROP POLICY IF EXISTS unt_intake_dispatch_urh ON public.unt_intake_dispatches;
CREATE POLICY unt_intake_dispatch_urh ON public.unt_intake_dispatches
 FOR SELECT TO authenticated USING (
   status IN ('prepared','forwarded')
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='urh_admin')
 );

COMMIT;
