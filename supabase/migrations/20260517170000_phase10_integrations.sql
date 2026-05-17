-- Phase 10: guestlist ↔ job headcount sync, enquiry client link, marketplace ticket stub

-- Unified headcount: website guestlist signups/check-ins + approved promoter entries
create or replace function public.sync_promoter_job_headcount(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.promoter_jobs%rowtype;
  v_h public.v_promoter_job_guestlist_headcount%rowtype;
  v_approved int;
  v_joined int;
  v_entered int;
  v_male int;
  v_female int;
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

  select count(*)::int
  into v_approved
  from public.promoter_guestlist_entries e
  where e.promoter_job_id = p_job_id
    and e.approval_status = 'approved';

  select *
  into v_h
  from public.v_promoter_job_guestlist_headcount h
  where h.club_slug = v_job.club_slug
    and h.event_date = v_job.job_date
    and h.promoter_id is not distinct from v_job.promoter_id
  limit 1;

  v_joined := greatest(coalesce(v_h.guests_joined, 0), v_approved);
  v_entered := greatest(coalesce(v_h.guests_entered, 0), v_approved);
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
    'female_count', v_female,
    'approved_entries', v_approved
  );
end;
$$;

grant execute on function public.sync_promoter_job_headcount(uuid) to authenticated;

create or replace function public.refresh_job_headcount_from_guestlist(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.sync_promoter_job_headcount(p_job_id);
end;
$$;

-- After website check-in, refresh matching promoter jobs for that event night
create or replace function public.sync_jobs_headcount_for_signup(p_signup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club text;
  v_date date;
  v_promoter uuid;
  v_job_id uuid;
begin
  select e.club_slug, e.event_date, e.promoter_id
  into v_club, v_date, v_promoter
  from public.guestlist_signups s
  join public.guestlist_events e on e.id = s.guestlist_event_id
  where s.id = p_signup_id;

  if v_club is null or v_date is null then
    return;
  end if;

  for v_job_id in
    select j.id
    from public.promoter_jobs j
    where j.club_slug = v_club
      and j.job_date = v_date
      and j.promoter_id is not distinct from v_promoter
  loop
    perform public.sync_promoter_job_headcount(v_job_id);
  end loop;
end;
$$;

create or replace function public.trg_guestlist_checkin_sync_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_jobs_headcount_for_signup(new.guestlist_signup_id);
  return new;
end;
$$;

drop trigger if exists guestlist_checkin_sync_jobs on public.guestlist_checkins;
create trigger guestlist_checkin_sync_jobs
after insert on public.guestlist_checkins
for each row
execute function public.trg_guestlist_checkin_sync_jobs();

-- Admin guestlist approval: full headcount sync (not guests_count only)
create or replace function public.admin_review_guestlist_entry(
  p_entry_id uuid,
  p_approve boolean,
  p_review_notes text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_status text;
  v_sync jsonb;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Admin only.');
  end if;

  select e.promoter_job_id, e.approval_status
  into v_job_id, v_status
  from public.promoter_guestlist_entries e
  where e.id = p_entry_id;

  if v_job_id is null then
    return jsonb_build_object('ok', false, 'error', 'Entry not found.');
  end if;

  if v_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Entry already reviewed.');
  end if;

  update public.promoter_guestlist_entries
  set
    approval_status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = trim(coalesce(p_review_notes, ''))
  where id = p_entry_id;

  v_sync := public.sync_promoter_job_headcount(v_job_id);

  return jsonb_build_object('ok', true, 'promoterJobId', v_job_id, 'headcount', v_sync);
end;
$$;

-- Link enquiry to client when a single primary guest maps to one client
create or replace function public.create_clients_from_enquiry(p_enquiry_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  v_name text;
  v_contact text;
  v_email text;
  v_phone text;
  v_ig text;
  v_digits text;
  r record;
  en_name text;
  en_email text;
  en_phone text;
  en_digits text;
  v_client_id uuid;
  v_guest_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;

  for r in
    select guest_name, guest_contact
    from public.enquiry_guests
    where enquiry_id = p_enquiry_id
    order by created_at asc
  loop
    v_name := trim(coalesce(r.guest_name, ''));
    v_contact := trim(coalesce(r.guest_contact, ''));
    if v_name = '' or v_contact = '' then
      continue;
    end if;

    v_email := null;
    v_phone := null;
    v_ig := null;
    v_digits := regexp_replace(v_contact, '\D', '', 'g');

    if v_contact ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      v_email := lower(v_contact);
    elsif length(v_digits) >= 8 then
      v_phone := v_digits;
    else
      v_ig := lower(regexp_replace(trim(v_contact), '^@+', ''));
    end if;

    if exists (
      select 1
      from public.clients c
      where (v_email is not null and lower(trim(coalesce(c.email, ''))) = v_email)
         or (
           v_phone is not null
           and length(v_phone) >= 8
           and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone
         )
         or (
           v_ig is not null
           and length(trim(v_ig)) > 0
           and lower(trim(regexp_replace(coalesce(c.instagram, ''), '^@+', ''))) = trim(v_ig)
         )
    ) then
      continue;
    end if;

    insert into public.clients (name, email, phone, instagram)
    values (v_name, v_email, v_phone, nullif(trim(v_ig), ''));
    n := n + 1;
  end loop;

  if not exists (
    select 1
    from public.enquiry_guests
    where enquiry_id = p_enquiry_id
    limit 1
  ) then
    select trim(coalesce(e.name, '')),
           nullif(lower(trim(coalesce(e.email, ''))), ''),
           trim(coalesce(e.phone, ''))
    into en_name, en_email, en_phone
    from public.enquiries e
    where e.id = p_enquiry_id;

    if en_name <> '' then
      v_email := en_email;
      en_digits := regexp_replace(coalesce(en_phone, ''), '\D', '', 'g');
      v_phone := case when length(en_digits) >= 8 then en_digits else null end;
      v_ig := null;

      if v_email is null and v_phone is null then
        null;
      elsif not exists (
        select 1
        from public.clients c
        where (v_email is not null and lower(trim(coalesce(c.email, ''))) = v_email)
           or (
             v_phone is not null
             and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone
           )
      ) then
        insert into public.clients (name, email, phone, instagram)
        values (en_name, v_email, v_phone, null);
        n := n + 1;
      end if;
    end if;
  end if;

  select count(*)::int into v_guest_count
  from public.enquiry_guests
  where enquiry_id = p_enquiry_id;

  if v_guest_count = 1 then
    select c.id into v_client_id
    from public.enquiry_guests g
    join public.clients c on (
      (g.guest_contact ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        and lower(trim(coalesce(c.email, ''))) = lower(trim(g.guest_contact)))
      or (
        length(regexp_replace(g.guest_contact, '\D', '', 'g')) >= 8
        and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
          = regexp_replace(g.guest_contact, '\D', '', 'g')
      )
      or (
        length(trim(regexp_replace(g.guest_contact, '^@+', ''))) > 0
        and lower(trim(regexp_replace(coalesce(c.instagram, ''), '^@+', '')))
          = lower(trim(regexp_replace(g.guest_contact, '^@+', '')))
      )
    )
    where g.enquiry_id = p_enquiry_id
    limit 1;

    if v_client_id is not null then
      update public.enquiries
      set client_id = v_client_id, updated_at = now()
      where id = p_enquiry_id
        and client_id is null;
    end if;
  end if;

  return n;
end;
$$;

-- Marketplace ticket sales stub (V4 §4.3)
create table if not exists public.external_ticket_sales (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid references public.promoters (id) on delete set null,
  club_slug text references public.clubs (slug) on delete set null,
  job_id uuid references public.promoter_jobs (id) on delete set null,
  sold_at timestamptz not null default now(),
  quantity integer not null default 1 check (quantity > 0),
  external_ref text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists external_ticket_sales_club_sold_idx
  on public.external_ticket_sales (club_slug, sold_at desc);

create index if not exists external_ticket_sales_job_idx
  on public.external_ticket_sales (job_id)
  where job_id is not null;

alter table public.external_ticket_sales enable row level security;

drop policy if exists external_ticket_sales_admin_all on public.external_ticket_sales;
create policy external_ticket_sales_admin_all
on public.external_ticket_sales
for all
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create or replace function public.sync_job_tickets_from_external_sales(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  if p_job_id is null then
    return;
  end if;
  select coalesce(sum(quantity), 0)::int into v_total
  from public.external_ticket_sales
  where job_id = p_job_id;

  update public.promoter_jobs
  set tickets_sold = greatest(v_total, tickets_sold),
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.trg_external_ticket_sale_sync_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.job_id is not null then
    perform public.sync_job_tickets_from_external_sales(new.job_id);
  end if;
  return new;
end;
$$;

drop trigger if exists external_ticket_sale_sync_job on public.external_ticket_sales;
create trigger external_ticket_sale_sync_job
after insert or update of job_id, quantity on public.external_ticket_sales
for each row
execute function public.trg_external_ticket_sale_sync_job();

comment on table public.external_ticket_sales is
  'Phase 10 stub: external marketplace ticket rows; aggregates to promoter_jobs.tickets_sold when job_id is set.';
