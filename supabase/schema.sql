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

-- RLS defaults.
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_guests enable row level security;

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
