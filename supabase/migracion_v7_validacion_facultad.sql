-- UNT 2027 · V7: validación por administración de cada facultad.
-- Ejecutar UNA SOLA VEZ DESPUÉS de migracion_v6_acceso_simple.sql.
-- Las fichas pendientes no son públicas; su revisión exige autorización URH.
BEGIN;

ALTER TABLE public.intake_submissions ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.intake_submissions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.intake_submissions ADD COLUMN IF NOT EXISTS forwarded_at timestamptz;
ALTER TABLE public.intake_submissions DROP CONSTRAINT IF EXISTS intake_submissions_status_check;
ALTER TABLE public.intake_submissions ADD CONSTRAINT intake_submissions_status_check
 CHECK (status IN ('submitted','changes_requested','validated','forwarded'));

-- V8: no se crean credenciales, claves o códigos para facultades.
-- La consulta de expedientes ajenos requiere la sesión autorizada de la URH.

CREATE TABLE IF NOT EXISTS public.unt_intake_dispatches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 faculty_id text NOT NULL REFERENCES public.faculties(id),
 tracking_code text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','forwarded')),
 items_count integer NOT NULL DEFAULT 0,
 snapshot jsonb NOT NULL,
 office_number text,
 physical_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 forwarded_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_unt_intake_dispatch_faculty ON public.unt_intake_dispatches(faculty_id,created_at DESC);
ALTER TABLE public.unt_intake_dispatches ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.unt_intake_dispatches TO service_role;
GRANT SELECT,UPDATE ON public.intake_submissions TO service_role;
REVOKE ALL ON public.unt_intake_dispatches FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.unt_intake_dispatches TO authenticated;
DROP POLICY IF EXISTS unt_intake_dispatch_urh ON public.unt_intake_dispatches;
CREATE POLICY unt_intake_dispatch_urh ON public.unt_intake_dispatches FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='urh_admin') AND status='forwarded');

-- No hay lectura pública. V7.2 amplía la consulta URH a fichas validadas.
DROP POLICY IF EXISTS intake_only_urh ON public.intake_submissions;
CREATE POLICY intake_only_urh ON public.intake_submissions FOR SELECT TO authenticated
 USING (status='forwarded' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='urh_admin'));

CREATE OR REPLACE FUNCTION public.unt_prepare_intake_dispatch(p_faculty text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_snapshot jsonb; v_count integer; v_id uuid;
BEGIN
 IF EXISTS (SELECT 1 FROM public.unt_intake_dispatches WHERE faculty_id=p_faculty AND status='prepared') THEN
   RAISE EXCEPTION 'Ya existe una remisión pendiente de formalizar';
 END IF;
 IF EXISTS (SELECT 1 FROM public.intake_submissions WHERE faculty_id=p_faculty AND status='submitted') THEN
   RAISE EXCEPTION 'Existen registros pendientes de validación';
 END IF;
 SELECT count(*),COALESCE(jsonb_agg(jsonb_build_object(
   'id',id,'name',owner_name,'worker_code',worker_code,'job_title',job_title,
   'org_unit',org_unit,'role',role_at_submission,'profile',profile,'content',content
 ) ORDER BY created_at),'[]'::jsonb)
 INTO v_count,v_snapshot FROM public.intake_submissions
 WHERE faculty_id=p_faculty AND status='validated';
 IF v_count=0 THEN RAISE EXCEPTION 'No hay registros validados para remitir'; END IF;
 INSERT INTO public.unt_intake_dispatches(faculty_id,tracking_code,items_count,snapshot)
 VALUES(p_faculty,'UNT-'+p_faculty+'-'+replace(gen_random_uuid()::text,'-',''),v_count,jsonb_build_object('records',v_snapshot))
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.unt_prepare_intake_dispatch(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_prepare_intake_dispatch(text) TO service_role;

CREATE OR REPLACE FUNCTION public.unt_forward_intake_dispatch(p_dispatch uuid,p_office text,p_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_d public.unt_intake_dispatches; v_affected integer;
BEGIN
 SELECT * INTO v_d FROM public.unt_intake_dispatches WHERE id=p_dispatch FOR UPDATE;
 IF v_d.id IS NULL OR v_d.status<>'prepared' THEN RAISE EXCEPTION 'Remisión no disponible'; END IF;
 IF length(trim(p_office))<3 THEN RAISE EXCEPTION 'Indique el número de oficio'; END IF;
 UPDATE public.intake_submissions SET status='forwarded',forwarded_at=now(),updated_at=now()
 WHERE faculty_id=v_d.faculty_id AND status='validated'
 AND id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_d.snapshot->'records') x);
 GET DIAGNOSTICS v_affected=ROW_COUNT;
 IF v_affected<>v_d.items_count THEN RAISE EXCEPTION 'No coincide el número de registros validados; revise antes de remitir'; END IF;
 UPDATE public.unt_intake_dispatches SET status='forwarded',office_number=left(trim(p_office),160),
 physical_reference=left(trim(coalesce(p_reference,'')),300),forwarded_at=now()
 WHERE id=v_d.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.unt_forward_intake_dispatch(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_forward_intake_dispatch(uuid,text,text) TO service_role;

-- No se permite sobrescribir registros por el navegador público.
COMMIT;

