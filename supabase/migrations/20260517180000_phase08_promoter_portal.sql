-- Phase 8: promoter portal — client visibility via jobs, self job insert/update

drop policy if exists clients_promoter_select_via_jobs on public.clients;

create policy clients_promoter_select_via_jobs
on public.clients
for select
to authenticated
using (
  exists (
    select 1
    from public.promoter_jobs j
    join public.promoters pr on pr.id = j.promoter_id
    where j.client_id = clients.id
      and pr.user_id = auth.uid()
  )
);

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
  p_status text default 'assigned',
  p_client_id uuid default null
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

  if p_client_id is not null then
    if not exists (
      select 1
      from public.clients c
      where c.id = p_client_id
        and (
          c.preferred_promoter_id = v_promoter_id
          or exists (
            select 1
            from public.promoter_jobs j
            where j.client_id = c.id
              and j.promoter_id = v_promoter_id
          )
        )
    ) then
      raise exception 'client not linked to promoter';
    end if;
  end if;

  insert into public.promoter_jobs (
    promoter_id,
    club_slug,
    service,
    job_type,
    job_date,
    status,
    client_id,
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
    p_client_id,
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

grant execute on function public.insert_promoter_job_self(
  text, date, text, numeric, numeric, integer, text, text, text, text, uuid
) to authenticated;

create or replace function public.update_promoter_job_self_counts(
  p_job_id uuid,
  p_male_count integer default null,
  p_female_count integer default null,
  p_guests_joined integer default null,
  p_guests_entered integer default null,
  p_tickets_sold integer default null,
  p_gross_spend_gbp numeric default null,
  p_guests_count integer default null
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
    gross_spend_gbp = coalesce(greatest(0, p_gross_spend_gbp), j.gross_spend_gbp),
    guests_count = coalesce(greatest(0, p_guests_count), j.guests_count),
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

grant execute on function public.update_promoter_job_self_counts(
  uuid, integer, integer, integer, integer, integer, numeric, integer
) to authenticated;
