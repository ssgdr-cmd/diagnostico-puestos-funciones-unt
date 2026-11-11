-- =============================================================
-- UNT · DIAGNÓSTICO DE PUESTOS Y FUNCIONES — FACULTADES 2027
-- Esquema inicial para Supabase (PostgreSQL + Auth + Data API)
-- No debe publicarse una clave service_role en GitHub Pages.
-- Ejecutar en Supabase SQL Editor con permisos de administración.
-- =============================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.faculties (
  id text primary key,
  name text not null unique
);
insert into public.faculties (id,name) values
('fce','Ciencias Económicas'),('educ','Educación y Ciencias de la Comunicación'),
('ing','Ingeniería'),('med','Medicina'),('agro','Ciencias Agropecuarias'),
('bio','Ciencias Biológicas'),('fis','Ciencias Físicas y Matemáticas'),
('soc','Ciencias Sociales'),('der','Derecho y Ciencias Políticas'),
('farm','Farmacia y Bioquímica'),('quim','Ingeniería Química'),
('enf','Enfermería'),('est','Estomatología')
on conflict(id) do update set name=excluded.name;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  last_names text not null,
  first_names text not null,
  dni text not null check (dni ~ '^[0-9]{8}$'),
  worker_code text not null,
  job_title text not null default '',
  professional_title text,
  academic_titles jsonb not null default '[]'::jsonb,
  academic_grades jsonb not null default '[]'::jsonb,
  masters_count integer not null default 0,
  doctorates_count integer not null default 0,
  masters_detail text,
  doctorates_detail text,
  address text not null,
  phone text not null,
  institutional_email text not null,
  personal_email text not null,
  education_level text not null,
  higher_detail text,
  faculty_id text references public.faculties(id),
  org_unit text not null,
  authority_scope text check(authority_scope is null or authority_scope in ('DECANATO','ESCUELA','DEPARTAMENTO')),
  authority_unit text,
  role text not null default 'staff' check(role in('staff','faculty_admin','authority','urh_admin')),
  requested_role text not null default 'staff' check(requested_role in('staff','faculty_admin','authority','urh_admin')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Directorio de acceso limitado: NO publica DNI, domicilio ni correos personales.
create table if not exists public.staff_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  worker_code text not null,
  job_title text,
  org_unit text,
  faculty_id text references public.faculties(id),
  role text not null,
  updated_at timestamptz not null default now()
);
create or replace function private.sync_directory() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.staff_directory(user_id,display_name,worker_code,job_title,org_unit,faculty_id,role,updated_at)
 values(new.id,new.last_names||', '||new.first_names,new.worker_code,new.job_title,new.org_unit,new.faculty_id,new.role,now())
 on conflict(user_id) do update set display_name=excluded.display_name,worker_code=excluded.worker_code,
 faculty_id=excluded.faculty_id,job_title=excluded.job_title,org_unit=excluded.org_unit,role=excluded.role,updated_at=now();
 return new;
end $$;
drop trigger if exists trg_sync_directory on public.profiles;
create trigger trg_sync_directory after insert or update on public.profiles
for each row execute function private.sync_directory();

create table if not exists public.declarations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  faculty_id text not null references public.faculties(id),
  role_at_submission text not null check(role_at_submission in('staff','faculty_admin','authority')),
  status text not null default 'draft' check(status in('draft','submitted','changes_requested','validated','forwarded')),
  content jsonb not null default '{}'::jsonb,
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  forwarded_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(owner_id,role_at_submission)
);
create index if not exists ix_decl_faculty_status on public.declarations (faculty_id,status);
create index if not exists ix_decl_owner on public.declarations (owner_id);

create table if not exists public.faculty_dispatches (
  id uuid primary key default gen_random_uuid(),
  faculty_id text not null references public.faculties(id),
  created_by uuid not null references public.profiles(id),
  tracking_code text not null unique,
  status text not null default 'prepared' check(status in('prepared','forwarded','received')),
  snapshot jsonb not null,
  office_number text,
  physical_reference text,
  forwarded_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ix_dispatch_faculty on public.faculty_dispatches(faculty_id,status);

create table if not exists public.faculty_metrics (
  faculty_id text primary key references public.faculties(id),
  period text not null default '2026',
  students numeric,staff_fte numeric,schools numeric,school_staff_fte numeric,
  units_served numeric,support_fte numeric,required_hours numeric,available_hours numeric,
  overdue numeric,deadline_due numeric,functions_uncovered numeric,functions_required numeric,
  aligned_cases numeric,checked_cases numeric,external_recurring numeric,
  attributable_cost numeric,homogeneous_products numeric,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  object_id uuid,
  faculty_id text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- SECURITY HELPERS: schema 'private' no expuesto a Data API.
create or replace function private.my_role() returns text language sql stable security definer
set search_path = '' as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function private.my_faculty() returns text language sql stable security definer
set search_path = '' as $$ select faculty_id from public.profiles where id=auth.uid() $$;
revoke all on function private.my_role() from public,anon;
revoke all on function private.my_faculty() from public,anon;
grant execute on function private.my_role(),private.my_faculty() to authenticated;

-- Negar accesos implícitos. Los cambios se hacen SOLO por RPC con validaciones.
alter table public.faculties enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_directory enable row level security;
alter table public.declarations enable row level security;
alter table public.faculty_dispatches enable row level security;
alter table public.faculty_metrics enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.faculties,public.profiles,public.staff_directory,public.declarations,public.faculty_dispatches,public.faculty_metrics,public.audit_events from anon,authenticated;
grant select on public.faculties,public.profiles,public.staff_directory,
public.declarations,public.faculty_dispatches,public.faculty_metrics,
public.audit_events to authenticated;

-- Policies de lectura explícitas.
create policy faculties_read on public.faculties for select to authenticated using(true);
create policy profiles_read on public.profiles for select to authenticated
using(id=auth.uid() or (select private.my_role())='urh_admin');
create policy directory_read on public.staff_directory for select to authenticated
using(user_id=auth.uid() or (select private.my_role())='urh_admin' or
 ((select private.my_role())='faculty_admin' and faculty_id=(select private.my_faculty())));
create policy declarations_read on public.declarations for select to authenticated
using(owner_id=auth.uid() or
 ((select private.my_role())='faculty_admin' and faculty_id=(select private.my_faculty())
   and role_at_submission in('staff','authority') and status in('submitted','validated','forwarded')) or
 ((select private.my_role())='urh_admin' and (status='forwarded' or (role_at_submission='faculty_admin' and status='submitted'))));
create policy dispatches_read on public.faculty_dispatches for select to authenticated
using(((select private.my_role())='faculty_admin' and faculty_id=(select private.my_faculty()))
 or ((select private.my_role())='urh_admin' and status in('forwarded','received')));
create policy metrics_read on public.faculty_metrics for select to authenticated
using((select private.my_role())='urh_admin');
create policy audit_read on public.audit_events for select to authenticated
using((select private.my_role())='urh_admin');

-- Funciones RPC protegidas (publico expuesto; cada RPC verifica auth + alcance).
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

create or replace function public.save_my_draft(payload jsonb) returns public.declarations
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; old public.declarations; result public.declarations;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null then raise exception 'Debe guardar primero su identificación'; end if;
 if p.role='urh_admin' then raise exception 'El perfil URH no genera declaraciones en este módulo'; end if;
 if pg_catalog.octet_length(payload::text)>250000 then raise exception 'La declaración supera el tamaño permitido'; end if;
 if pg_catalog.jsonb_typeof(payload->'functions') is distinct from 'array' then raise exception 'El registro requiere funciones'; end if;
 select * into old from public.declarations where owner_id=p.id and role_at_submission=p.role for update;
 if old.id is not null and old.status not in('draft','changes_requested') then raise exception 'Registro bloqueado: se encuentra enviado o validado'; end if;
 if old.id is not null then
  update public.declarations set content=payload,status='draft',updated_at=now() where id=old.id returning * into result;
 else
  insert into public.declarations(owner_id,faculty_id,role_at_submission,content,status)
  values(p.id,p.faculty_id,p.role,payload,'draft') returning * into result;
 end if;
 insert into public.audit_events(actor_id,object_id,faculty_id,action) values(p.id,result.id,p.faculty_id,'draft_saved');
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

create or replace function public.forward_faculty_dispatch(dispatch_id uuid,office_number text,physical_reference text default '') returns public.faculty_dispatches
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; d public.faculty_dispatches; ids uuid[]; affected int;
begin
 select * into p from public.profiles where id=auth.uid();
 select * into d from public.faculty_dispatches where id=dispatch_id for update;
 if p.role<>'faculty_admin' or d.id is null or d.faculty_id<>p.faculty_id or d.status<>'prepared' then raise exception 'Remisión no autorizada';end if;
 if length(trim(coalesce(office_number,'')))<5 then raise exception 'Indique el número de oficio';end if;
 select array_agg((value->>'id')::uuid) into ids from pg_catalog.jsonb_array_elements(d.snapshot->'records');
 if ids is null then raise exception 'Remisión sin registros';end if;
 if (select count(*) from public.declarations where id=any(ids) and status='validated')<>pg_catalog.array_length(ids,1)
 then raise exception 'Uno o más registros ya no está validado. Prepare una nueva remisión';end if;
 update public.declarations set status='forwarded',forwarded_at=now(),updated_at=now() where id=any(ids) and status='validated';
 update public.faculty_dispatches set status='forwarded',office_number=left(office_number,160),
 physical_reference=left(coalesce(physical_reference,''),250),forwarded_at=now()
 where id=dispatch_id returning * into d;
 insert into public.audit_events(actor_id,object_id,faculty_id,action,metadata)
 values(p.id,d.id,p.faculty_id,'dispatch_forwarded',pg_catalog.jsonb_build_object('office_number',office_number));
 return d;
end $$;

create or replace function public.save_faculty_metrics(payload jsonb) returns public.faculty_metrics
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; result public.faculty_metrics; fid text;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.role<>'urh_admin' then raise exception 'Operación restringida a la URH';end if;
 fid:=payload->>'faculty_id';
 if not exists(select 1 from public.faculties where id=fid) then raise exception 'Facultad inválida';end if;
 insert into public.faculty_metrics(faculty_id,period,students,staff_fte,schools,school_staff_fte,units_served,
 support_fte,required_hours,available_hours,overdue,deadline_due,functions_uncovered,functions_required,
 aligned_cases,checked_cases,external_recurring,attributable_cost,homogeneous_products,updated_by)
 values(fid,coalesce(payload->>'period','2026'),
 (payload->>'students')::numeric,(payload->>'staff_fte')::numeric,(payload->>'schools')::numeric,
 (payload->>'school_staff_fte')::numeric,(payload->>'units_served')::numeric,
 (payload->>'support_fte')::numeric,(payload->>'required_hours')::numeric,(payload->>'available_hours')::numeric,
 (payload->>'overdue')::numeric,(payload->>'deadline_due')::numeric,
 (payload->>'functions_uncovered')::numeric,(payload->>'functions_required')::numeric,
 (payload->>'aligned_cases')::numeric,(payload->>'checked_cases')::numeric,
 (payload->>'external_recurring')::numeric,(payload->>'attributable_cost')::numeric,
 (payload->>'homogeneous_products')::numeric,p.id)
 on conflict(faculty_id) do update set period=excluded.period,students=excluded.students,staff_fte=excluded.staff_fte,
 schools=excluded.schools,school_staff_fte=excluded.school_staff_fte,units_served=excluded.units_served,
 support_fte=excluded.support_fte,required_hours=excluded.required_hours,available_hours=excluded.available_hours,
 overdue=excluded.overdue,deadline_due=excluded.deadline_due,functions_uncovered=excluded.functions_uncovered,
 functions_required=excluded.functions_required,aligned_cases=excluded.aligned_cases,checked_cases=excluded.checked_cases,
 external_recurring=excluded.external_recurring,attributable_cost=excluded.attributable_cost,
 homogeneous_products=excluded.homogeneous_products,updated_by=p.id,updated_at=now()
 returning * into result;
 insert into public.audit_events(actor_id,faculty_id,action) values(p.id,fid,'metrics_updated');
 return result;
end $$;

-- RPC accesible solo con una sesión autenticada, sin acceso anónimo.
revoke execute on all functions in schema public from public,anon;
grant execute on function public.update_my_profile(jsonb), public.save_my_draft(jsonb),
 public.submit_my_declaration(),public.review_declaration(uuid,text,text),
 public.prepare_faculty_dispatch(),public.forward_faculty_dispatch(uuid,text,text),
 public.save_faculty_metrics(jsonb) to authenticated;

-- SE PROHÍBEN escrituras directas del navegador a tablas sensibles.
-- Para asignar roles: primero el usuario debe registrarse y guardar su identificación.
-- La URH, desde SQL Editor / servidor con autorización, ejecutará por ejemplo:
-- update public.profiles set role='urh_admin' where institutional_email='usuario_autorizado@unitru.edu.pe';
-- update public.profiles set role='faculty_admin' where institutional_email='administrador@unitru.edu.pe';
-- update public.profiles set role='authority' where institutional_email='autoridad@unitru.edu.pe';
-- El disparador actualiza automáticamente staff_directory. No añadir claves privadas al frontend.

-- INSTALACIÓN EN ESQUEMA YA EXISTENTE (si se aplica como migración separada):
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS authority_scope text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS authority_unit text;
-- El nuevo update_my_profile debe ejecutarse después del ALTER correspondiente.
