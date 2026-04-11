-- Enable UUID generation helper.
create extension if not exists pgcrypto;

-- Profiles for authenticated users (admin/host roles).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'host' check (role in ('admin', 'host')),
  display_name text,
  created_at timestamptz not null default now()
);

-- Clients are shared across multiple enquiries/bookings.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  instagram text,
  gender text,
  referral_code text,
  created_at timestamptz not null default now()
);

create index if not exists clients_email_idx on public.clients (lower(email));
create index if not exists clients_phone_idx on public.clients (phone);

-- Main enquiries table used by current frontend integration.
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  form_name text not null,
  form_label text not null,
  service text not null,
  status text not null default 'new',
  source text not null default 'website',
  client_id uuid references public.clients (id) on delete set null,
  client_key text,
  name text,
  email text,
  phone text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);
create index if not exists enquiries_client_id_idx on public.enquiries (client_id);
create index if not exists enquiries_service_status_idx on public.enquiries (service, status);
create index if not exists enquiries_client_key_idx on public.enquiries (client_key);

-- Optional rows for nightlife guestlist payloads.
create table if not exists public.enquiry_guests (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  guest_name text not null,
  guest_contact text not null,
  created_at timestamptz not null default now()
);

create index if not exists enquiry_guests_enquiry_id_idx on public.enquiry_guests (enquiry_id);

-- Content tables to move clubs/cars into database.
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_weekly_flyers (
  id uuid primary key default gen_random_uuid(),
  club_slug text not null references public.clubs (slug) on delete cascade,
  event_date date not null,
  title text not null default '',
  description text not null default '',
  image_path text not null default '',
  image_url text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clubs_sort_idx on public.clubs (sort_order, name);
create index if not exists cars_sort_idx on public.cars (sort_order, name);
create index if not exists club_weekly_flyers_slug_date_idx
on public.club_weekly_flyers (club_slug, event_date, sort_order);
create index if not exists club_weekly_flyers_date_idx
on public.club_weekly_flyers (event_date);

-- RLS defaults.
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_guests enable row level security;
alter table public.clubs enable row level security;
alter table public.cars enable row level security;
alter table public.club_weekly_flyers enable row level security;

-- Profiles: each user can read their own row (needed for admin role check in the browser).
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Enquiry guests: public inserts (website guestlist flow); team reads in admin.
drop policy if exists enquiry_guests_public_insert on public.enquiry_guests;
create policy enquiry_guests_public_insert
on public.enquiry_guests
for insert
to anon, authenticated
with check (true);

drop policy if exists enquiry_guests_team_read on public.enquiry_guests;
create policy enquiry_guests_team_read
on public.enquiry_guests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'host')
  )
);

-- Public website can insert enquiries only.
drop policy if exists enquiries_public_insert on public.enquiries;
create policy enquiries_public_insert
on public.enquiries
for insert
to anon, authenticated
with check (true);

-- Block public reads from enquiries.
drop policy if exists enquiries_no_public_read on public.enquiries;
create policy enquiries_no_public_read
on public.enquiries
for select
to anon
using (false);

-- Admin/host authenticated users can read enquiries.
drop policy if exists enquiries_team_read on public.enquiries;
create policy enquiries_team_read
on public.enquiries
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'host')
  )
);

-- Admin users can update enquiry state.
drop policy if exists enquiries_admin_update on public.enquiries;
create policy enquiries_admin_update
on public.enquiries
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Browser inserts must not use PostgREST `.select()` after insert: anon has no SELECT on
-- enquiries (`enquiries_no_public_read`), so `.insert().select('id')` raises an RLS error.
-- This RPC returns the new id and inserts guest rows in one transaction.
create or replace function public.submit_website_enquiry(
  p_form_name text,
  p_form_label text,
  p_service text,
  p_client_key text,
  p_name text,
  p_email text,
  p_phone text,
  p_payload jsonb,
  p_guests jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  eid uuid;
  elem jsonb;
  gn text;
  gc text;
begin
  insert into public.enquiries (
    form_name, form_label, service, status, source, client_key, name, email, phone, payload, submitted_at
  ) values (
    coalesce(nullif(trim(p_form_name), ''), 'unknown'),
    coalesce(nullif(trim(p_form_label), ''), 'unknown'),
    coalesce(nullif(trim(p_service), ''), 'general'),
    'new',
    'website',
    nullif(trim(p_client_key), ''),
    nullif(trim(p_name), ''),
    nullif(lower(trim(p_email)), ''),
    nullif(trim(p_phone), ''),
    coalesce(p_payload, '{}'::jsonb),
    now()
  )
  returning id into eid;

  for elem in select * from jsonb_array_elements(coalesce(p_guests, '[]'::jsonb))
  loop
    gn := trim(coalesce(elem->>'guestName', ''));
    gc := trim(coalesce(elem->>'guestContact', ''));
    if gn <> '' and gc <> '' then
      insert into public.enquiry_guests (enquiry_id, guest_name, guest_contact)
      values (eid, gn, gc);
    end if;
  end loop;

  return eid;
end;
$$;

grant execute on function public.submit_website_enquiry(text, text, text, text, text, text, text, jsonb, jsonb) to anon, authenticated;

-- Admins: list / insert clients (RPC below also inserts under definer).
drop policy if exists clients_admin_select on public.clients;
create policy clients_admin_select
on public.clients
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists clients_admin_insert on public.clients;
create policy clients_admin_insert
on public.clients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Create client rows from enquiry_guests (and legacy enquiries row if no guests).
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

  return n;
end;
$$;

grant execute on function public.create_clients_from_enquiry(uuid) to authenticated;

-- Public read access for catalog content.
drop policy if exists clubs_public_read on public.clubs;
create policy clubs_public_read
on public.clubs
for select
to anon, authenticated
using (is_active = true);

drop policy if exists cars_public_read on public.cars;
create policy cars_public_read
on public.cars
for select
to anon, authenticated
using (is_active = true);

drop policy if exists flyers_public_read on public.club_weekly_flyers;
create policy flyers_public_read
on public.club_weekly_flyers
for select
to anon, authenticated
using (is_active = true);

-- Admin write access for catalog content.
drop policy if exists clubs_admin_write on public.clubs;
create policy clubs_admin_write
on public.clubs
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists cars_admin_write on public.cars;
create policy cars_admin_write
on public.cars
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists flyers_admin_write on public.club_weekly_flyers;
create policy flyers_admin_write
on public.club_weekly_flyers
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Storage bucket for nightlife flyers.
insert into storage.buckets (id, name, public)
values ('club-flyers', 'club-flyers', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists flyers_storage_public_read on storage.objects;
create policy flyers_storage_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'club-flyers');

drop policy if exists flyers_storage_write on storage.objects;
create policy flyers_storage_write
on storage.objects
for all
to authenticated
using (
  bucket_id = 'club-flyers'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  bucket_id = 'club-flyers'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
