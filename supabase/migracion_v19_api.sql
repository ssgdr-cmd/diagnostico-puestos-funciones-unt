-- UNT FACULTADES V19: aplicar UNA VEZ despues de las migraciones V6, V7, V7.1 y V7.2.
-- MIGRACION ADITIVA: no elimina fichas previas ni cambia claves URH.
BEGIN;
ALTER TABLE public.intake_submissions ADD COLUMN IF NOT EXISTS edit_token_hash text;
ALTER TABLE public.intake_submissions ADD COLUMN IF NOT EXISTS revision_no integer NOT NULL DEFAULT 1;
ALTER TABLE public.intake_submissions ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.intake_submissions ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.intake_submissions DROP CONSTRAINT IF EXISTS intake_submissions_status_check;
ALTER TABLE public.intake_submissions ADD CONSTRAINT intake_submissions_status_check
 CHECK (status IN ('draft','submitted','changes_requested','validated','forwarded'));
CREATE UNIQUE INDEX IF NOT EXISTS unt_edit_token_hash_unique ON public.intake_submissions(edit_token_hash) WHERE edit_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS unt_intake_worker_index ON public.intake_submissions(faculty_id, upper(worker_code),status);

-- Unicamente la URH incorpora correos autorizados; el usuario no asigna su propia facultad.
CREATE TABLE IF NOT EXISTS public.unt_faculty_reviewers(
  faculty_id text NOT NULL REFERENCES public.faculties(id),
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (faculty_id,email),
  CONSTRAINT reviewer_institutional_email CHECK (email=lower(email) AND email ~ '^[^@[:space:]]+@unitru[.]edu[.]pe$')
);
CREATE TABLE IF NOT EXISTS public.unt_staff_roster(
 faculty_id text NOT NULL REFERENCES public.faculties(id),
 worker_code text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(faculty_id,worker_code)
);
ALTER TABLE public.unt_staff_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_staff_roster FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unt_staff_roster TO service_role;
ALTER TABLE public.unt_faculty_reviewers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_faculty_reviewers FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unt_faculty_reviewers TO service_role;

-- Registro de auditoria sin copiar aqui la documentacion de identidad o el contenido completo.
CREATE TABLE IF NOT EXISTS public.unt_intake_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id uuid NOT NULL REFERENCES public.intake_submissions(id),
  faculty_id text NOT NULL REFERENCES public.faculties(id),
  actor_kind text NOT NULL CHECK (actor_kind IN ('declarante','facultad','urh','sistema')),
  actor_id uuid,
  action text NOT NULL,
  old_status text,
  new_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS unt_intake_events_record_idx ON public.unt_intake_events(record_id,created_at);
ALTER TABLE public.unt_intake_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_intake_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unt_intake_events TO service_role;

-- Cupos por ficha para el servicio OPCIONAL de IA externa (servidor, no navegador).
CREATE TABLE IF NOT EXISTS public.unt_ai_quota (
 record_id uuid NOT NULL REFERENCES public.intake_submissions(id),
 usage_date date NOT NULL,
 calls integer NOT NULL DEFAULT 0,
 PRIMARY KEY(record_id,usage_date)
);
ALTER TABLE public.unt_ai_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unt_ai_quota FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unt_ai_quota TO service_role;
CREATE OR REPLACE FUNCTION public.unt_ai_consume_quota(p_id uuid,p_limit integer DEFAULT 15)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  IF p_limit < 1 OR p_limit > 50 THEN RAISE EXCEPTION 'Limite invalido'; END IF;
  INSERT INTO public.unt_ai_quota(record_id,usage_date,calls)
    VALUES(p_id,(now() AT TIME ZONE 'America/Lima')::date,1)
  ON CONFLICT(record_id,usage_date) DO UPDATE SET calls=public.unt_ai_quota.calls+1
  RETURNING calls INTO n;
  RETURN n <= p_limit;
END $$;
REVOKE ALL ON FUNCTION public.unt_ai_consume_quota(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_ai_consume_quota(uuid,integer) TO service_role;

-- Se permite que el panel URH supervise pendientes, observados, validados y remitidos.
-- El acceso continua condicionado por la funcion de RLS y una cuenta URH real.
DROP POLICY IF EXISTS intake_only_urh ON public.intake_submissions;
CREATE POLICY intake_only_urh ON public.intake_submissions FOR SELECT TO authenticated
 USING (status <> 'draft' AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='urh_admin'
 ));

-- Solo service_role puede crear / editar borradores y registrar revisiones.
REVOKE INSERT,UPDATE,DELETE ON public.intake_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.intake_submissions TO service_role;
GRANT SELECT ON public.intake_submissions TO authenticated;
-- Ajuste del circuito de remision: no permitir expedientes sin subsanar.
CREATE OR REPLACE FUNCTION public.unt_prepare_intake_dispatch(p_faculty text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_snapshot jsonb; v_count integer; v_id uuid;
BEGIN
 IF EXISTS (SELECT 1 FROM public.unt_intake_dispatches WHERE faculty_id=p_faculty AND status='prepared') THEN
   RAISE EXCEPTION 'Ya existe una remisión pendiente de formalizar';
 END IF;
 IF EXISTS (SELECT 1 FROM public.intake_submissions
     WHERE faculty_id=p_faculty AND status IN ('submitted','changes_requested')) THEN
   RAISE EXCEPTION 'Existen fichas pendientes de revisión o subsanación';
 END IF;
 SELECT count(*),COALESCE(jsonb_agg(jsonb_build_object(
  'id',id,'name',owner_name,'worker_code',worker_code,'job_title',job_title,
  'org_unit',org_unit,'role',role_at_submission,'profile',profile,'content',content
 ) ORDER BY created_at),'[]'::jsonb)
 INTO v_count,v_snapshot FROM public.intake_submissions
 WHERE faculty_id=p_faculty AND status='validated';
 IF v_count=0 THEN RAISE EXCEPTION 'No hay registros validados para remitir'; END IF;
 INSERT INTO public.unt_intake_dispatches(faculty_id,tracking_code,items_count,snapshot)
 VALUES(p_faculty,'UNT-'||p_faculty||'-'||replace(gen_random_uuid()::text,'-',''),v_count,jsonb_build_object('records',v_snapshot))
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.unt_prepare_intake_dispatch(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_prepare_intake_dispatch(text) TO service_role;
COMMIT;

-- AUTORIZAR DESPUES DE COMPROBAR SU CORREO CON LA URH:
-- INSERT INTO public.unt_faculty_reviewers (faculty_id,email)
-- VALUES ('fce','administrador.autorizado@unitru.edu.pe')
-- ON CONFLICT (faculty_id,email) DO UPDATE SET active=true;
-- No ingrese contraseñas ni claves de servicio en este SQL.
