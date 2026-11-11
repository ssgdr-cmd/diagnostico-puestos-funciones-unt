-- UNT FACULTADES V19.1.4: remisiones complementarias, trazabilidad documental.
-- Requiere V19.1.3. ADITIVA: no elimina fichas ni remisiones previas.
-- Ejecutar en SQL Editor de Supabase después de un respaldo, primero en ensayo.
BEGIN;

ALTER TABLE public.unt_dispatch_decisions_v1913
  ADD COLUMN IF NOT EXISTS dispatch_kind text NOT NULL DEFAULT 'integral';
ALTER TABLE public.unt_dispatch_decisions_v1913
  ADD COLUMN IF NOT EXISTS previous_dispatches jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Mantener la firma existente beneficia también a clientes actualizados progresivamente.
-- El servidor es quien clasifica la remisión; el navegador NO decide el tipo.
CREATE OR REPLACE FUNCTION public.unt_prepare_dispatch_v1913(
 p_faculty text,p_actor uuid,p_partial boolean DEFAULT false,p_reason text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_is_urh boolean;
 v_email text;
 v_counts jsonb;
 v_expected integer;
 v_complete integer;
 v_missing integer;
 v_pending integer;
 v_snapshot jsonb;
 v_count integer;
 v_id uuid;
 v_previous jsonb;
 v_previous_count integer;
 v_kind text;
BEGIN
 IF p_actor IS NULL OR p_faculty IS NULL
    OR NOT EXISTS(SELECT 1 FROM public.faculties WHERE id=p_faculty) THEN
   RAISE EXCEPTION 'Datos de remisión incorrectos';
 END IF;

 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='urh_admin') INTO v_is_urh;
 IF NOT v_is_urh THEN
   SELECT lower(email) INTO v_email FROM auth.users
   WHERE id=p_actor AND email_confirmed_at IS NOT NULL;
   IF v_email IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.unt_faculty_reviewers
      WHERE faculty_id=p_faculty AND email=v_email AND active=true
   ) THEN
      RAISE EXCEPTION 'Revisor no autorizado para esta facultad';
   END IF;
 END IF;
 IF coalesce(p_partial,false) AND (NOT v_is_urh OR length(btrim(coalesce(p_reason,'')))<20) THEN
   RAISE EXCEPTION 'Solo la URH puede autorizar remisiones parciales con justificación';
 END IF;

 -- Una sola preparación simultánea por facultad.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('unt-remision|'||p_faculty,0));
 IF EXISTS(SELECT 1 FROM public.unt_intake_dispatches
           WHERE faculty_id=p_faculty AND status='prepared') THEN
   RAISE EXCEPTION 'Ya existe una remisión preparada pendiente';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.intake_submissions
     WHERE faculty_id=p_faculty AND receipt_code LIKE 'ADM-%'
       AND status IN ('validated','forwarded')) THEN
   RAISE EXCEPTION 'La ficha del administrador debe estar validada por URH';
 END IF;

 v_counts:=public.unt_faculty_coverage_v1913(p_faculty);
 v_expected:=(v_counts->>'expected')::integer;
 v_complete:=(v_counts->>'completed')::integer;
 v_missing:=(v_counts->>'missing')::integer;
 v_pending:=(v_counts->>'pending')::integer;
 IF v_expected<1 THEN
   RAISE EXCEPTION 'Padrón activo vacío: no es posible verificar cobertura';
 END IF;
 IF coalesce(p_partial,false) AND v_complete=v_expected AND v_missing=0 AND v_pending=0 THEN
   RAISE EXCEPTION 'La cobertura ya es completa; prepare una remisión ordinaria o complementaria sin excepción';
 END IF;
 IF NOT coalesce(p_partial,false)
    AND (v_complete<>v_expected OR v_missing>0 OR v_pending>0) THEN
   RAISE EXCEPTION 'Cobertura incompleta: esperados %, cubiertos %, sin ficha %, pendientes %',
       v_expected,v_complete,v_missing,v_pending;
 END IF;

 -- La relación de antecedentes solo incorpora remisiones FORMALIZADAS.
 -- Una remisión complementaria NO reenvía fichas previamente remitidas.
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object(
   'id',d.id,
   'tracking_code',d.tracking_code,
   'office_number',d.office_number,
   'forwarded_at',d.forwarded_at,
   'items_count',d.items_count,
   'type',coalesce(d.snapshot->>'type',
      CASE WHEN d.snapshot->>'partial'='true' THEN 'parcial' ELSE 'integral' END)
 ) ORDER BY d.forwarded_at,d.created_at),'[]'::jsonb)
 INTO v_previous_count,v_previous
 FROM public.unt_intake_dispatches d
 WHERE d.faculty_id=p_faculty AND d.status='forwarded';

 v_kind:=CASE
   WHEN v_previous_count>0 THEN 'complementaria'
   WHEN coalesce(p_partial,false) THEN 'parcial'
   ELSE 'integral' END;

 -- NUNCA mezclar fichas forwarded en la nueva remisión: ya constan en oficios anteriores.
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object(
   'id',s.id,'name',s.owner_name,'worker_code',s.worker_code,
   'job_title',s.job_title,'org_unit',s.org_unit,
   'role',s.role_at_submission,'profile',s.profile,
   'receipt_code',s.receipt_code,'content',s.content
 ) ORDER BY s.created_at,s.id),'[]'::jsonb)
 INTO v_count,v_snapshot
 FROM public.intake_submissions s
 WHERE s.faculty_id=p_faculty AND s.status='validated';
 IF v_count<1 THEN
   RAISE EXCEPTION 'No existen fichas nuevas validadas para remitir';
 END IF;
 IF EXISTS(
   SELECT 1 FROM public.intake_submissions s
   WHERE s.faculty_id=p_faculty AND s.status='validated'
   AND NOT EXISTS(SELECT 1 FROM public.unt_staff_roster r
       WHERE r.faculty_id=p_faculty AND r.active=true
         AND upper(btrim(r.worker_code))=upper(btrim(s.worker_code))
         AND lower(btrim(r.institutional_email))=lower(btrim(s.profile->>'institutional_email')))
 ) THEN
   RAISE EXCEPTION 'Existen fichas validadas sin identidad vigente en el padrón';
 END IF;

 INSERT INTO public.unt_intake_dispatches(faculty_id,tracking_code,items_count,snapshot)
 VALUES(p_faculty,'UNT-'||p_faculty||'-'||replace(pg_catalog.gen_random_uuid()::text,'-',''),v_count,
    jsonb_build_object(
      'records',v_snapshot,'coverage',v_counts,
      'partial',coalesce(p_partial,false),
      'type',v_kind,
      'previous_dispatches',v_previous,
      'justification',CASE WHEN p_partial THEN left(btrim(p_reason),1500) ELSE NULL END
    ))
 RETURNING id INTO v_id;

 INSERT INTO public.unt_dispatch_decisions_v1913
 (dispatch_id,faculty_id,actor_id,is_partial,justification,
  expected_count,covered_count,missing_count,pending_count,
  dispatch_kind,previous_dispatches)
 VALUES(v_id,p_faculty,p_actor,coalesce(p_partial,false),
    CASE WHEN p_partial THEN left(btrim(p_reason),1500) ELSE NULL END,
    v_expected,v_complete,v_missing,v_pending,v_kind,v_previous);
 RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.unt_prepare_dispatch_v1913(text,uuid,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_prepare_dispatch_v1913(text,uuid,boolean,text)
 TO service_role;
COMMIT;
