-- UNT · FACULTADES · V19.1.1 · Solo Supabase y autoasistente local.
-- Requisito: migraciones V19 y V19.1. No elimina datos ni registros anteriores.
-- Ejecutar EN ENSAYO, revisar y respaldar antes de aplicarla a producción.
BEGIN;

-- El padrón puede comprobar código de trabajador + correo UNITRU sin otro servicio.
ALTER TABLE public.unt_staff_roster
 ADD COLUMN IF NOT EXISTS institutional_email text;
CREATE INDEX IF NOT EXISTS unt_roster_faculty_mail_v1911
 ON public.unt_staff_roster (faculty_id,lower(institutional_email))
 WHERE institutional_email IS NOT NULL;

-- Toda inserción y transición queda auditada en la misma transacción que la ficha.
-- Si el evento falla, también falla la modificación; ya no hay segundo INSERT desde la API.
CREATE OR REPLACE FUNCTION public.unt_intake_audit_v1911()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_action text;
 v_actor_kind text;
 v_actor uuid;
 v_old text;
BEGIN
 IF TG_OP='INSERT' THEN
   v_action:='created';v_actor_kind:='declarante';v_old:=NULL;
 ELSE
   IF NEW.status IS DISTINCT FROM OLD.status THEN
     v_action:=CASE NEW.status
       WHEN 'submitted' THEN CASE WHEN OLD.status='changes_requested' THEN 'resubmitted' ELSE 'submitted' END
       WHEN 'changes_requested' THEN 'returned'
       WHEN 'validated' THEN 'validated'
       WHEN 'forwarded' THEN 'forwarded'
       ELSE 'status_updated' END;
   ELSIF NEW.revision_no IS DISTINCT FROM OLD.revision_no THEN
     v_action:='saved';
   ELSE
     RETURN NEW;
   END IF;
   v_old:=OLD.status;
   v_actor_kind:=CASE WHEN NEW.status IN ('validated','changes_requested') AND OLD.status='submitted'
                      THEN 'facultad'
                      WHEN NEW.status='forwarded' THEN 'sistema'
                      ELSE 'declarante' END;
 END IF;
 v_actor_kind:=coalesce(nullif(pg_catalog.current_setting('unt.actor_kind',true),''),v_actor_kind);
 IF v_actor_kind NOT IN ('declarante','facultad','urh','sistema') THEN
   RAISE EXCEPTION 'Actor de auditoría inválido';
 END IF;
 v_actor:=NULLIF(pg_catalog.current_setting('unt.actor_id',true),'')::uuid;
 IF v_actor IS NULL AND v_action IN ('validated','returned') THEN
   v_actor:=NEW.reviewed_by;
 END IF;
 INSERT INTO public.unt_intake_events
 (record_id,faculty_id,actor_kind,actor_id,action,old_status,new_status,note)
 VALUES(NEW.id,NEW.faculty_id,v_actor_kind,v_actor,v_action,v_old,NEW.status,
        CASE WHEN v_action='returned' THEN LEFT(coalesce(NEW.review_note,''),1400) ELSE NULL END);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS unt_intake_audit_v1911 ON public.intake_submissions;
CREATE TRIGGER unt_intake_audit_v1911
 AFTER INSERT OR UPDATE ON public.intake_submissions
 FOR EACH ROW EXECUTE FUNCTION public.unt_intake_audit_v1911();
REVOKE ALL ON FUNCTION public.unt_intake_audit_v1911() FROM PUBLIC,anon,authenticated;

-- Revisión del administrador: bloqueo y auditoría atómicos. El Edge Function
-- verifica previamente JWT y autorización; el RPC comprueba el estado y facultad.
CREATE OR REPLACE FUNCTION public.unt_review_intake_v1911(
 p_record uuid,p_faculty text,p_decision text,p_note text,p_actor uuid,p_is_urh boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.intake_submissions%ROWTYPE;v_next text;
BEGIN
 IF p_record IS NULL OR length(trim(coalesce(p_faculty,''))) < 2 OR p_actor IS NULL
    OR p_decision NOT IN ('approve','return') THEN
   RAISE EXCEPTION 'Parámetros de revisión inválidos';
 END IF;
 IF p_decision='return' AND length(trim(coalesce(p_note,''))) < 8 THEN
   RAISE EXCEPTION 'La observación debe contener al menos ocho caracteres';
 END IF;
 SELECT * INTO v_row FROM public.intake_submissions
 WHERE id=p_record AND faculty_id=p_faculty FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'submitted' THEN
   RAISE EXCEPTION 'La ficha no está disponible para revisión';
 END IF;
 IF v_row.receipt_code LIKE 'ADM-%' AND NOT coalesce(p_is_urh,false) THEN
   RAISE EXCEPTION 'La ficha del administrador solo puede validarla la URH';
 END IF;
 v_next:=CASE WHEN p_decision='approve' THEN 'validated' ELSE 'changes_requested' END;
 PERFORM pg_catalog.set_config('unt.actor_kind',CASE WHEN p_is_urh THEN 'urh' ELSE 'facultad' END,true);
 PERFORM pg_catalog.set_config('unt.actor_id',p_actor::text,true);
 UPDATE public.intake_submissions
    SET status=v_next,
        review_note=CASE WHEN p_decision='return' THEN left(trim(p_note),1400) ELSE NULL END,
        reviewed_by=p_actor,reviewed_at=now(),updated_at=now()
 WHERE id=p_record AND faculty_id=p_faculty AND status='submitted';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.unt_review_intake_v1911(uuid,text,text,text,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unt_review_intake_v1911(uuid,text,text,text,uuid,boolean)
 TO service_role;

COMMIT;

-- Comprobación sin escribir datos:
-- SELECT tgname,tgenabled FROM pg_trigger
-- WHERE tgrelid='public.intake_submissions'::regclass AND NOT tgisinternal;
-- SELECT id,faculty_id,action,created_at FROM public.unt_intake_events ORDER BY id DESC LIMIT 20;
