-- ACTUALIZACIÓN v4: niveles educativos y grados/títulos de todos los perfiles;
-- autoridades registran necesidades sin repetir funciones definidas normativamente.
-- Ejecutar después de las migraciones previas sobre una base ya creada.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academic_titles jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academic_grades jsonb NOT NULL DEFAULT '[]'::jsonb;

create or replace function public.update_my_profile(payload jsonb) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); old public.profiles; result public.profiles; faculty text; r text;
begin
 if uid is null then raise exception 'Debe iniciar sesión'; end if;
 if payload is null then raise exception 'Datos no enviados'; end if;
 if coalesce(payload->>'dni','') !~ '^[0-9]{8}$' then raise exception 'DNI inválido'; end if;
 if coalesce(payload->>'phone','') !~ '^[0-9]{9}$' then raise exception 'Número de celular inválido (nueve dígitos)'; end if;
 if upper(trim(coalesce(payload->>'education_level',''))) not in ('SECUNDARIA','TÉCNICO','SUPERIOR') then raise exception 'Seleccione nivel educativo válido'; end if;
 if pg_catalog.jsonb_typeof(coalesce(payload->'academic_titles','[]'::jsonb)) <> 'array' or pg_catalog.jsonb_typeof(coalesce(payload->'academic_grades','[]'::jsonb)) <> 'array' then raise exception 'Grados o títulos mal estructurados'; end if;
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
 insert into public.profiles(id,last_names,first_names,dni,worker_code,job_title,address,phone,institutional_email,personal_email,education_level,higher_detail,professional_title,masters_count,doctorates_count,masters_detail,doctorates_detail,academic_titles,academic_grades,faculty_id,org_unit,authority_scope,authority_unit,role,requested_role)
 values(uid,upper(trim(payload->>'last_names')),upper(trim(payload->>'first_names')),payload->>'dni',upper(trim(payload->>'worker_code')),
 upper(trim(payload->>'job_title')),upper(trim(payload->>'address')),trim(payload->>'phone'),lower(trim(payload->>'institutional_email')),
 lower(trim(payload->>'personal_email')),upper(trim(payload->>'education_level')),
 upper(trim(coalesce(payload->>'higher_detail',''))),upper(trim(coalesce(payload->>'professional_title',''))),greatest(0,least(100,coalesce(nullif(payload->>'masters_count','')::int,0))),greatest(0,least(100,coalesce(nullif(payload->>'doctorates_count','')::int,0))),upper(trim(coalesce(payload->>'masters_detail',''))),upper(trim(coalesce(payload->>'doctorates_detail',''))),coalesce(payload->'academic_titles','[]'::jsonb),coalesce(payload->'academic_grades','[]'::jsonb),faculty,upper(trim(payload->>'org_unit')),
 nullif(upper(trim(coalesce(payload->>'authority_scope',''))),''),nullif(upper(trim(coalesce(payload->>'authority_unit',''))),''),
 r,coalesce(old.requested_role,case when (payload->>'requested_role') in('staff','faculty_admin','authority') then payload->>'requested_role' else 'staff' end))
 on conflict(id) do update set last_names=excluded.last_names,first_names=excluded.first_names,dni=excluded.dni,
 worker_code=excluded.worker_code,job_title=excluded.job_title,address=excluded.address,phone=excluded.phone,
 institutional_email=excluded.institutional_email,personal_email=excluded.personal_email,
 education_level=excluded.education_level,higher_detail=excluded.higher_detail,professional_title=excluded.professional_title,masters_count=excluded.masters_count,doctorates_count=excluded.doctorates_count,masters_detail=excluded.masters_detail,doctorates_detail=excluded.doctorates_detail,academic_titles=excluded.academic_titles,academic_grades=excluded.academic_grades,
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
 if p.role <> 'authority' and pg_catalog.jsonb_array_length(result.content->'functions')<1 then raise exception 'Debe registrar al menos una función'; end if;
 -- Todo registro requiere revisión: servidores y autoridades por la administración de facultad; el propio administrador, por la URH.
 new_status:='submitted';
 update public.declarations set status=new_status,submitted_at=now(),updated_at=now(),
 forwarded_at=case when new_status='forwarded' then now() else null end
 where id=result.id returning * into result;
 insert into public.audit_events(actor_id,object_id,faculty_id,action) values(p.id,result.id,p.faculty_id,'submission_'||new_status);
 return result;
end $$;


