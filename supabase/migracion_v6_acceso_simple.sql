-- UNT - Versión 6. Aplicar UNA VEZ después de schema.sql (y migraciones ya aplicadas).
-- No elimina registros existentes ni modifica la cuenta urh_admin creada.
-- La recepción pública ocurre SOLO a través de una Edge Function con verificación humana.

begin;
create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  receipt_code text not null unique,
  faculty_id text not null references public.faculties(id),
  role_at_submission text not null check (role_at_submission in ('staff','authority')),
  owner_name text not null,
  worker_code text not null,
  job_title text not null,
  org_unit text not null,
  profile jsonb not null,
  content jsonb not null,
  status text not null default 'submitted' check (status in ('submitted','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intake_by_faculty on public.intake_submissions(faculty_id,created_at desc);
create index if not exists intake_by_role on public.intake_submissions(role_at_submission);

alter table public.intake_submissions enable row level security;
revoke all on public.intake_submissions from anon, authenticated;
grant select on public.intake_submissions to authenticated;

-- La cuenta urh_admin autenticada es la única con permiso de lectura.
drop policy if exists intake_only_urh on public.intake_submissions;
create policy intake_only_urh on public.intake_submissions
  for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='urh_admin'));

-- Limitación de volumen (acceso exclusivo de servidor): nunca guardar IP en claro.
create table if not exists public.intake_rate_counters (
  key_hash text not null,
  period_code text not null,
  hits integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(key_hash, period_code)
);
alter table public.intake_rate_counters enable row level security;
revoke all on public.intake_rate_counters from public,anon,authenticated;

create or replace function public.intake_count_attempt(p_key_hash text, p_period_code text)
returns integer
language plpgsql security definer set search_path=''
as $$
declare c integer;
begin
  if length(p_key_hash)<32 or length(p_period_code)>32 or length(p_period_code)<5 then
    raise exception 'Parámetros inválidos';
  end if;
  insert into public.intake_rate_counters(key_hash,period_code,hits)
  values (p_key_hash,p_period_code,1)
  on conflict(key_hash,period_code)
  do update set hits=public.intake_rate_counters.hits+1,updated_at=now()
  returning hits into c;
  return c;
end $$;
revoke all on function public.intake_count_attempt(text,text) from public,anon,authenticated;
grant execute on function public.intake_count_attempt(text,text) to service_role;
commit;

-- Comprobación optativa:
-- select relname,relrowsecurity from pg_class where relname in ('intake_submissions','intake_rate_counters');
