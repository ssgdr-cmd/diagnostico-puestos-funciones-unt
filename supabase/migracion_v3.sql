-- Migración v3: ejecutar solo si ya existe la base institucional; respaldar antes.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS professional_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS masters_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS doctorates_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS masters_detail text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS doctorates_detail text;
ALTER TABLE public.staff_directory ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.staff_directory ADD COLUMN IF NOT EXISTS org_unit text;
create or replace function private.sync_directory() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.staff_directory(user_id,display_name,worker_code,job_title,org_unit,faculty_id,role,updated_at)
 values(new.id,new.last_names||', '||new.first_names,new.worker_code,new.job_title,new.org_unit,new.faculty_id,new.role,now())
 on conflict(user_id) do update set display_name=excluded.display_name,worker_code=excluded.worker_code,
 faculty_id=excluded.faculty_id,job_title=excluded.job_title,org_unit=excluded.org_unit,role=excluded.role,updated_at=now();
 return new;
end $$;

create or replace function public.update_my_profile(payload jsonb) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); old public.profiles; result public.profiles; faculty text; r text;
begin
 if uid is null then raise exception 'Debe iniciar sesión'; end if;
 if payload is null then raise exception 'Datos no enviados'; end if;
 if coalesce(payload->>'dni','') !~ '^[0-9]{8}$' then raise exception 'DNI inválido'; end if;
 if lower(coalesce(auth.jwt()->>'email','')) !~ '^[^@]+@unitru[.]edu[.]pe$' then raise exception 'Se requiere una cuenta institucional UNITRU'; end if;
 if lower(trim(coalesce(payload->>'institutional_email',''))) <> lower(coalesce(auth.jwt()->>'email','')) then
   raise exception 'El correo institucional debe coincidir con la cuenta utilizada para iniciar sesión'; end if;
 if length(trim(coalesce(payload->>'job_title','')))<2 then raise exception 'Indique la denominación del puesto'; end if;
 if length(coalesce(payload->>'last_names',''))<2 or length(coalesce(payload->>'first_names',''))<2 then raise exception 'Apellidos o nombres incompletos'; end if;
 select * into old from public.profiles where id=uid;
 faculty:=payload->>'faculty_id';
 if not exists(select 1 from public.faculties where id=faculty) then raise exception 'Facultad no reconocida'; end if;
 if old.id is not null and faculty<>old.faculty_id then
   raise exception 'Un usuario autorizado no puede modificar su facultad sin intervención de la URH'; end if;
 r:=coalesce(old.role,'staff');
 if r='authority' and (coalesce(payload->>'authority_scope','') not in ('DECANATO','ESCUELA','DEPARTAMENTO') or (payload->>'authority_scope' in ('ESCUELA','DEPARTAMENTO') and trim(coalesce(payload->>'authority_unit',''))='')) then raise exception 'Indique el tipo de autoridad y la escuela o departamento'; end if;
 insert into public.profiles(id,last_names,first_names,dni,worker_code,job_title,address,phone,institutional_email,personal_email,education_level,higher_detail,professional_title,masters_count,doctorates_count,masters_detail,doctorates_detail,faculty_id,org_unit,authority_scope,authority_unit,role,requested_role)
 values(uid,upper(trim(payload->>'last_names')),upper(trim(payload->>'first_names')),payload->>'dni',upper(trim(payload->>'worker_code')),
 upper(trim(payload->>'job_title')),upper(trim(payload->>'address')),trim(payload->>'phone'),lower(trim(payload->>'institutional_email')),
 lower(trim(payload->>'personal_email')),upper(trim(payload->>'education_level')),
 upper(trim(coalesce(payload->>'higher_detail',''))),upper(trim(coalesce(payload->>'professional_title',''))),greatest(0,least(6,coalesce(nullif(payload->>'masters_count','')::int,0))),greatest(0,least(8,coalesce(nullif(payload->>'doctorates_count','')::int,0))),upper(trim(coalesce(payload->>'masters_detail',''))),upper(trim(coalesce(payload->>'doctorates_detail',''))),faculty,upper(trim(payload->>'org_unit')),
 nullif(upper(trim(coalesce(payload->>'authority_scope',''))),''),nullif(upper(trim(coalesce(payload->>'authority_unit',''))),''),
 r,coalesce(old.requested_role,case when (payload->>'requested_role') in('staff','faculty_admin','authority') then payload->>'requested_role' else 'staff' end))
 on conflict(id) do update set last_names=excluded.last_names,first_names=excluded.first_names,dni=excluded.dni,
 worker_code=excluded.worker_code,job_title=excluded.job_title,address=excluded.address,phone=excluded.phone,
 institutional_email=excluded.institutional_email,personal_email=excluded.personal_email,
 education_level=excluded.education_level,higher_detail=excluded.higher_detail,professional_title=excluded.professional_title,masters_count=excluded.masters_count,doctorates_count=excluded.doctorates_count,masters_detail=excluded.masters_detail,doctorates_detail=excluded.doctorates_detail,
 faculty_id=excluded.faculty_id,org_unit=excluded.org_unit,
 authority_scope=excluded.authority_scope,authority_unit=excluded.authority_unit,updated_at=now();
 select * into result from public.profiles where id=uid;
 return result;
end $$;

create or replace function public.submit_my_declaration() returns public.declarations
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; result public.declarations; new_status text;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null or p.role='urh_admin' then raise exception 'Perfil no autorizado'; end if;
 select * into result from public.declarations where owner_id=p.id and role_at_submission=p.role for update;
 if result.id is null or result.status<>'draft' then raise exception 'No existe borrador disponible'; end if;
 if pg_catalog.jsonb_array_length(result.content->'functions')<1 then raise exception 'Debe declarar al menos una función'; end if;
 -- Todo registro requiere revisión: servidores y autoridades por la administración de facultad; el propio administrador, por la URH.
 new_status:='submitted';
 update public.declarations set status=new_status,submitted_at=now(),updated_at=now(),
 forwarded_at=case when new_status='forwarded' then now() else null end
 where id=result.id returning * into result;
 insert into public.audit_events(actor_id,object_id,faculty_id,action) values(p.id,result.id,p.faculty_id,'submission_'||new_status);
 return result;
end $$;

create or replace function public.review_declaration(declaration_id uuid,decision text,review_comment text default '') returns public.declarations
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; result public.declarations; next_status text;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null or p.role not in ('faculty_admin','urh_admin') then raise exception 'Perfil sin atribuciones de revisión'; end if;
 select * into result from public.declarations where id=declaration_id for update;
 if result.id is null or result.owner_id=p.id or result.status<>'submitted' or not ((p.role='faculty_admin' and result.faculty_id=p.faculty_id and result.role_at_submission in('staff','authority')) or (p.role='urh_admin' and result.role_at_submission='faculty_admin')) then
 raise exception 'La declaración no se encuentra disponible para esta revisión'; end if;
 if decision not in('approve','return') then raise exception 'Decisión no válida'; end if;
 if decision='return' and length(trim(coalesce(review_comment,'')))<8 then raise exception 'Debe precisar el motivo de devolución'; end if;
 next_status:=case when decision='approve' then 'validated' else 'changes_requested' end;
 update public.declarations set status=next_status,review_note=left(review_comment,2500),reviewed_by=p.id,reviewed_at=now(),updated_at=now()
 where id=result.id returning * into result;
 insert into public.audit_events(actor_id,object_id,faculty_id,action,metadata)
 values(p.id,result.id,p.faculty_id,'review_'||decision,pg_catalog.jsonb_build_object('comment',left(review_comment,2500)));
 return result;
end $$;

create or replace function public.prepare_faculty_dispatch() returns public.faculty_dispatches
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; outrow public.faculty_dispatches; n int; snap jsonb; track text;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null or p.role<>'faculty_admin' then raise exception 'Solo administradores de facultad'; end if;
 if exists(select 1 from public.declarations where faculty_id=p.faculty_id and role_at_submission in('staff','authority') and status='submitted')
 then raise exception 'Hay declaraciones pendientes de validar';end if;
 select count(*) into n from public.declarations where faculty_id=p.faculty_id and status='validated';
 if n=0 then raise exception 'No hay declaraciones validadas para remitir';end if;
 select pg_catalog.jsonb_build_object('records',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
 'id',d.id,'name',sd.display_name,'worker_code',sd.worker_code,'job_title',sd.job_title,'org_unit',sd.org_unit,'role',d.role_at_submission,'content',d.content,'functions',pg_catalog.jsonb_array_length(d.content->'functions'))),'[]'::jsonb))
 into snap from public.declarations d join public.staff_directory sd on sd.user_id=d.owner_id
 where d.faculty_id=p.faculty_id and d.status='validated';
 track:='UNT-'||pg_catalog.upper(p.faculty_id)||'-'||pg_catalog.to_char(now(),'YYYYMMDDHH24MISS')||'-'||pg_catalog.substr(gen_random_uuid()::text,1,5);
 insert into public.faculty_dispatches(faculty_id,created_by,tracking_code,snapshot)
 values(p.faculty_id,p.id,track,snap) returning * into outrow;
 insert into public.audit_events(actor_id,object_id,faculty_id,action,metadata)
 values(p.id,outrow.id,p.faculty_id,'dispatch_prepared',pg_catalog.jsonb_build_object('count',n));
 return outrow;
end $$;

DROP POLICY IF EXISTS declarations_read ON public.declarations;
CREATE POLICY declarations_read ON public.declarations FOR SELECT TO authenticated USING(
 owner_id=auth.uid() OR
 ((select private.my_role())='faculty_admin' and faculty_id=(select private.my_faculty()) and role_at_submission in('staff','authority') and status in('submitted','validated','forwarded')) OR
 ((select private.my_role())='urh_admin' and (status='forwarded' OR (role_at_submission='faculty_admin' and status='submitted')))
);
