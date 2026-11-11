-- Migración para instalaciones PREVIAS de la versión 1. Ejecutar después de revisar la base y respaldarla.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS authority_scope text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS authority_unit text;
ALTER TABLE public.profiles ALTER COLUMN faculty_id DROP NOT NULL;
ALTER TABLE public.staff_directory ALTER COLUMN faculty_id DROP NOT NULL;
-- No se modifica ninguna cuenta ni se concede rol privilegiado automáticamente.
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
 if length(coalesce(payload->>'last_names',''))<2 or length(coalesce(payload->>'first_names',''))<2 then raise exception 'Apellidos o nombres incompletos'; end if;
 select * into old from public.profiles where id=uid;
 faculty:=payload->>'faculty_id';
 if not exists(select 1 from public.faculties where id=faculty) then raise exception 'Facultad no reconocida'; end if;
 if old.id is not null and faculty<>old.faculty_id then
   raise exception 'Un usuario autorizado no puede modificar su facultad sin intervención de la URH'; end if;
 r:=coalesce(old.role,'staff');
 if r='authority' and (coalesce(payload->>'authority_scope','') not in ('DECANATO','ESCUELA','DEPARTAMENTO') or (payload->>'authority_scope' in ('ESCUELA','DEPARTAMENTO') and trim(coalesce(payload->>'authority_unit',''))='')) then raise exception 'Indique el tipo de autoridad y la escuela o departamento'; end if;
 insert into public.profiles(id,last_names,first_names,dni,worker_code,address,phone,institutional_email,personal_email,education_level,higher_detail,faculty_id,org_unit,authority_scope,authority_unit,role,requested_role)
 values(uid,upper(trim(payload->>'last_names')),upper(trim(payload->>'first_names')),payload->>'dni',upper(trim(payload->>'worker_code')),
 upper(trim(payload->>'address')),trim(payload->>'phone'),lower(trim(payload->>'institutional_email')),
 lower(trim(payload->>'personal_email')),upper(trim(payload->>'education_level')),
 upper(trim(coalesce(payload->>'higher_detail',''))),faculty,upper(trim(payload->>'org_unit')),
 nullif(upper(trim(coalesce(payload->>'authority_scope',''))),''),nullif(upper(trim(coalesce(payload->>'authority_unit',''))),''),
 r,coalesce(old.requested_role,case when (payload->>'requested_role') in('staff','faculty_admin','authority') then payload->>'requested_role' else 'staff' end))
 on conflict(id) do update set last_names=excluded.last_names,first_names=excluded.first_names,dni=excluded.dni,
 worker_code=excluded.worker_code,address=excluded.address,phone=excluded.phone,
 institutional_email=excluded.institutional_email,personal_email=excluded.personal_email,
 education_level=excluded.education_level,higher_detail=excluded.higher_detail,
 faculty_id=excluded.faculty_id,org_unit=excluded.org_unit,
 authority_scope=excluded.authority_scope,authority_unit=excluded.authority_unit,updated_at=now();
 select * into result from public.profiles where id=uid;
 return result;
end $$;

