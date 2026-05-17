-- Phase 2: V4 operational job ledger columns on promoter_jobs

-- Mapping helpers (used by trigger + backfill)
create or replace function public.map_service_to_job_type(p_service text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_service, '')))
    when 'guestlist' then 'guestlist'
    when 'table_sale' then 'table'
    when 'private_table' then 'table'
    when 'table' then 'table'
    when 'tickets' then 'ticket'
    when 'ticket' then 'ticket'
    when 'venue_access' then 'venue_hire'
    when 'venue_hire' then 'venue_hire'
    when 'other' then 'venue_hire'
    else 'guestlist'
  end;
$$;

create or replace function public.map_job_type_to_service(p_job_type text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_job_type, '')))
    when 'table' then 'table_sale'
    when 'ticket' then 'tickets'
    when 'venue_hire' then 'other'
    else 'guestlist'
  end;
$$;

alter table public.promoter_jobs
  add column if not exists job_type text;

alter table public.promoter_jobs
  add column if not exists admin_confirmed boolean not null default false;

alter table public.promoter_jobs
  add column if not exists paid boolean not null default false;

alter table public.promoter_jobs
  add column if not exists male_count integer not null default 0;

alter table public.promoter_jobs
  add column if not exists female_count integer not null default 0;

alter table public.promoter_jobs
  add column if not exists guests_joined integer not null default 0;

alter table public.promoter_jobs
  add column if not exists guests_entered integer not null default 0;

alter table public.promoter_jobs
  add column if not exists tickets_sold integer not null default 0;

alter table public.promoter_jobs
  add column if not exists gross_spend_gbp numeric(12, 2) not null default 0;

alter table public.promoter_jobs
  add column if not exists net_spend_gbp numeric(12, 2) not null default 0;

alter table public.promoter_jobs
  add column if not exists concierge_cut_gbp numeric(12, 2) not null default 0;

alter table public.promoter_jobs
  add column if not exists promoter_cut_gbp numeric(12, 2) not null default 0;

alter table public.promoter_jobs
  add column if not exists bonus_valid boolean not null default true;

alter table public.promoter_jobs
  add column if not exists rate_override jsonb not null default '{}'::jsonb;

alter table public.promoter_jobs
  add column if not exists client_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'promoter_jobs_client_id_fkey'
  ) then
    alter table public.promoter_jobs
      add constraint promoter_jobs_client_id_fkey
      foreign key (client_id) references public.clients (id) on delete set null;
  end if;
end $$;

alter table public.promoter_jobs
  drop constraint if exists promoter_jobs_job_type_check;

update public.promoter_jobs
set job_type = public.map_service_to_job_type(service)
where job_type is null or trim(job_type) = '';

update public.promoter_jobs
set guests_joined = guests_count
where guests_joined = 0
  and guests_count > 0
  and public.map_service_to_job_type(service) = 'guestlist';

update public.promoter_jobs
set guests_entered = guests_count
where guests_entered = 0
  and guests_count > 0
  and status = 'completed'
  and public.map_service_to_job_type(service) = 'guestlist';

alter table public.promoter_jobs
  alter column job_type set default 'guestlist';

update public.promoter_jobs
set job_type = 'guestlist'
where job_type is null;

alter table public.promoter_jobs
  alter column job_type set not null;

alter table public.promoter_jobs
  add constraint promoter_jobs_job_type_check
  check (job_type in ('guestlist', 'table', 'ticket', 'venue_hire'));

alter table public.promoter_jobs
  add constraint promoter_jobs_male_count_nonneg check (male_count >= 0);

alter table public.promoter_jobs
  add constraint promoter_jobs_female_count_nonneg check (female_count >= 0);

alter table public.promoter_jobs
  add constraint promoter_jobs_guests_joined_nonneg check (guests_joined >= 0);

alter table public.promoter_jobs
  add constraint promoter_jobs_guests_entered_nonneg check (guests_entered >= 0);

alter table public.promoter_jobs
  add constraint promoter_jobs_tickets_sold_nonneg check (tickets_sold >= 0);

create index if not exists promoter_jobs_club_date_type_idx
  on public.promoter_jobs (club_slug, job_date desc, job_type);

create index if not exists promoter_jobs_client_id_idx
  on public.promoter_jobs (client_id)
  where client_id is not null;

create or replace function public.sync_promoter_job_type_service()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.job_type is distinct from OLD.job_type then
      NEW.service := public.map_job_type_to_service(NEW.job_type);
    elsif NEW.service is distinct from OLD.service then
      NEW.job_type := public.map_service_to_job_type(NEW.service);
    end if;
  else
    if NEW.job_type is null or trim(NEW.job_type) = '' then
      NEW.job_type := public.map_service_to_job_type(NEW.service);
    end if;
    NEW.service := public.map_job_type_to_service(NEW.job_type);
  end if;

  if coalesce(NEW.male_count, 0) + coalesce(NEW.female_count, 0) > 0 then
    NEW.guests_count := greatest(
      coalesce(NEW.guests_count, 0),
      coalesce(NEW.male_count, 0) + coalesce(NEW.female_count, 0)
    );
  elsif coalesce(NEW.guests_entered, 0) > 0 then
    NEW.guests_count := greatest(coalesce(NEW.guests_count, 0), NEW.guests_entered);
  elsif coalesce(NEW.guests_joined, 0) > 0 then
    NEW.guests_count := greatest(coalesce(NEW.guests_count, 0), NEW.guests_joined);
  end if;

  return NEW;
end;
$$;

drop trigger if exists promoter_jobs_sync_type_service on public.promoter_jobs;

create trigger promoter_jobs_sync_type_service
before insert or update on public.promoter_jobs
for each row
execute function public.sync_promoter_job_type_service();

-- Guestlist headcount aggregate by club / night / promoter (for job sync)
create or replace view public.v_promoter_job_guestlist_headcount as
select
  e.club_slug,
  e.event_date,
  e.promoter_id,
  count(s.id)::integer as guests_joined,
  count(s.id) filter (
    where s.status = 'attended'
      or exists (
        select 1
        from public.guestlist_checkins c
        where c.guestlist_signup_id = s.id
      )
  )::integer as guests_entered,
  count(s.id) filter (
    where lower(trim(coalesce(gp.gender, ''))) in ('f', 'female', 'woman', 'w')
  )::integer as female_count,
  count(s.id) filter (
    where lower(trim(coalesce(gp.gender, ''))) in ('m', 'male', 'man')
  )::integer as male_count
from public.guestlist_events e
inner join public.guestlist_signups s on s.guestlist_event_id = e.id
left join public.guest_profiles gp on gp.id = s.guest_profile_id
where s.status <> 'cancelled'
group by e.club_slug, e.event_date, e.promoter_id;

comment on view public.v_promoter_job_guestlist_headcount is
  'Aggregated guestlist signups/check-ins by club, event date, and promoter for promoter_jobs headcount sync.';

create or replace function public.refresh_job_headcount_from_guestlist(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.promoter_jobs%rowtype;
  v_h public.v_promoter_job_guestlist_headcount%rowtype;
  v_joined integer;
  v_entered integer;
  v_male integer;
  v_female integer;
begin
  if p_job_id is null then
    raise exception 'job id required';
  end if;

  select * into v_job from public.promoter_jobs where id = p_job_id;
  if not found then
    raise exception 'job not found';
  end if;

  if not (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.promoters pr
      where pr.id = v_job.promoter_id and pr.user_id = auth.uid()
    )
  ) then
    raise exception 'forbidden';
  end if;

  if v_job.club_slug is null then
    return jsonb_build_object('ok', false, 'error', 'job has no club');
  end if;

  select *
  into v_h
  from public.v_promoter_job_guestlist_headcount h
  where h.club_slug = v_job.club_slug
    and h.event_date = v_job.job_date
    and h.promoter_id is not distinct from v_job.promoter_id
  limit 1;

  v_joined := coalesce(v_h.guests_joined, 0);
  v_entered := coalesce(v_h.guests_entered, 0);
  v_male := coalesce(v_h.male_count, 0);
  v_female := coalesce(v_h.female_count, 0);

  update public.promoter_jobs j
  set
    guests_joined = v_joined,
    guests_entered = v_entered,
    male_count = v_male,
    female_count = v_female,
    guests_count = greatest(v_entered, v_male + v_female, v_joined, j.guests_count),
    updated_at = now()
  where j.id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'guests_joined', v_joined,
    'guests_entered', v_entered,
    'male_count', v_male,
    'female_count', v_female
  );
end;
$$;

grant execute on function public.refresh_job_headcount_from_guestlist(uuid) to authenticated;

create or replace function public.update_promoter_job_self_counts(
  p_job_id uuid,
  p_male_count integer default null,
  p_female_count integer default null,
  p_guests_joined integer default null,
  p_guests_entered integer default null,
  p_tickets_sold integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid;
begin
  select pr.id into v_promoter_id
  from public.promoters pr
  where pr.user_id = auth.uid()
  limit 1;

  if v_promoter_id is null then
    raise exception 'promoter profile not found';
  end if;

  update public.promoter_jobs j
  set
    male_count = coalesce(greatest(0, p_male_count), j.male_count),
    female_count = coalesce(greatest(0, p_female_count), j.female_count),
    guests_joined = coalesce(greatest(0, p_guests_joined), j.guests_joined),
    guests_entered = coalesce(greatest(0, p_guests_entered), j.guests_entered),
    tickets_sold = coalesce(greatest(0, p_tickets_sold), j.tickets_sold),
    updated_at = now()
  where j.id = p_job_id
    and j.promoter_id = v_promoter_id
    and j.status = 'assigned';

  if not found then
    raise exception 'job not found or not editable';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_promoter_job_self_counts(uuid, integer, integer, integer, integer, integer) to authenticated;

-- Promoter self-insert includes job_type
drop function if exists public.insert_promoter_job_self(text, date, text, numeric, numeric, integer, text);
drop function if exists public.insert_promoter_job_self(text, date, text, numeric, numeric, integer, text, text, text, text);

create or replace function public.insert_promoter_job_self(
  p_club_slug text,
  p_job_date date,
  p_service text default 'guestlist',
  p_shift_fee numeric default 0,
  p_guestlist_fee numeric default 0,
  p_guests_count integer default 0,
  p_notes text default '',
  p_client_name text default '',
  p_client_contact text default '',
  p_status text default 'assigned'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid;
  v_id uuid;
  v_service text := public.map_job_type_to_service(public.map_service_to_job_type(p_service));
  v_job_type text := public.map_service_to_job_type(p_service);
  v_status text := lower(trim(coalesce(p_status, 'assigned')));
begin
  select pr.id into v_promoter_id
  from public.promoters pr
  where pr.user_id = auth.uid()
  limit 1;

  if v_promoter_id is null then
    raise exception 'promoter profile not found for current user';
  end if;

  if v_status not in ('assigned', 'completed', 'cancelled') then
    v_status := 'assigned';
  end if;

  insert into public.promoter_jobs (
    promoter_id,
    club_slug,
    service,
    job_type,
    job_date,
    status,
    client_name,
    client_contact,
    guests_count,
    guests_joined,
    shift_fee,
    guestlist_fee,
    notes
  )
  values (
    v_promoter_id,
    nullif(trim(p_club_slug), ''),
    v_service,
    v_job_type,
    p_job_date,
    v_status,
    coalesce(p_client_name, ''),
    coalesce(p_client_contact, ''),
    greatest(0, coalesce(p_guests_count, 0)),
    greatest(0, coalesce(p_guests_count, 0)),
    greatest(0, coalesce(p_shift_fee, 0)),
    greatest(0, coalesce(p_guestlist_fee, 0)),
    coalesce(p_notes, '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_promoter_job_self(text, date, text, numeric, numeric, integer, text, text, text, text) to authenticated;

-- RLS: club accounts read jobs for their venue
drop policy if exists promoter_jobs_club_select on public.promoter_jobs;

create policy promoter_jobs_club_select
on public.promoter_jobs
for select
to authenticated
using (
  club_slug is not null
  and exists (
    select 1
    from public.club_accounts ca
    where ca.user_id = auth.uid()
      and ca.club_slug = promoter_jobs.club_slug
      and ca.status = 'active'
  )
);
