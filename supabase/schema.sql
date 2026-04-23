-- Enable UUID generation helper.
create extension if not exists pgcrypto;

-- Profiles for authenticated users (admin/host roles).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'host' check (role in ('admin', 'host')),
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'host', 'promoter'));

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

alter table public.clients
  add column if not exists notes text;
alter table public.clients
  add column if not exists guest_profile_id uuid;
alter table public.clients
  add column if not exists typical_spend_gbp numeric(12,2);
alter table public.clients
  add column if not exists preferred_nights text;
alter table public.clients
  add column if not exists preferred_promoter_id uuid;
alter table public.clients
  add column if not exists preferred_club_slug text;

create index if not exists clients_preferred_promoter_idx on public.clients (preferred_promoter_id);
create index if not exists clients_preferred_club_idx on public.clients (preferred_club_slug);
create index if not exists clients_guest_profile_idx on public.clients (guest_profile_id);

create table if not exists public.client_attendances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  event_date date not null,
  club_slug text not null references public.clubs (slug) on delete restrict,
  promoter_id uuid references public.promoters (id) on delete set null,
  spend_gbp numeric(12,2) not null default 0 check (spend_gbp >= 0),
  source text not null default 'manual',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_attendances_client_date_idx
on public.client_attendances (client_id, event_date desc);
create index if not exists client_attendances_club_date_idx
on public.client_attendances (club_slug, event_date desc);

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
  payment_details jsonb not null default '{}'::jsonb,
  tax_details jsonb not null default '{}'::jsonb,
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

-- Promoter + finance domain tables (MVP+Finance).
create table if not exists public.promoters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  profile_image_url text not null default '',
  profile_image_urls jsonb not null default '[]'::jsonb,
  portfolio_club_slugs text[] not null default '{}',
  payment_details jsonb not null default '{}'::jsonb,
  tax_details jsonb not null default '{}'::jsonb,
  is_approved boolean not null default false,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approval_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promoters
  add column if not exists profile_image_urls jsonb;
alter table public.promoters
  add column if not exists portfolio_club_slugs text[];
update public.promoters
set profile_image_urls = '[]'::jsonb
where profile_image_urls is null;
update public.promoters
set portfolio_club_slugs = '{}'::text[]
where portfolio_club_slugs is null;
update public.promoters
set profile_image_urls = jsonb_build_array(trim(both from profile_image_url))
where coalesce(nullif(trim(both from profile_image_url), ''), '') <> ''
  and jsonb_array_length(coalesce(profile_image_urls, '[]'::jsonb)) = 0;
alter table public.promoters
  alter column profile_image_urls set default '[]'::jsonb;
alter table public.promoters
  alter column profile_image_urls set not null;
alter table public.promoters
  alter column portfolio_club_slugs set default '{}'::text[];
alter table public.promoters
  alter column portfolio_club_slugs set not null;
alter table public.promoters
  add column if not exists payment_details jsonb;
alter table public.promoters
  add column if not exists tax_details jsonb;
update public.promoters
set payment_details = '{}'::jsonb
where payment_details is null;
update public.promoters
set tax_details = '{}'::jsonb
where tax_details is null;
alter table public.promoters
  alter column payment_details set default '{}'::jsonb;
alter table public.promoters
  alter column payment_details set not null;
alter table public.promoters
  alter column tax_details set default '{}'::jsonb;
alter table public.promoters
  alter column tax_details set not null;

alter table public.clubs
  add column if not exists payment_details jsonb;
alter table public.clubs
  add column if not exists tax_details jsonb;
update public.clubs
set payment_details = '{}'::jsonb
where payment_details is null;
update public.clubs
set tax_details = '{}'::jsonb
where tax_details is null;
alter table public.clubs
  alter column payment_details set default '{}'::jsonb;
alter table public.clubs
  alter column payment_details set not null;
alter table public.clubs
  alter column tax_details set default '{}'::jsonb;
alter table public.clubs
  alter column tax_details set not null;

create table if not exists public.promoter_profile_revisions (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references auth.users (id) on delete set null,
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.promoter_availability (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_available boolean not null default true,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promoter_id, weekday)
);

create table if not exists public.promoter_club_preferences (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  club_slug text not null references public.clubs (slug) on delete cascade,
  weekdays text[] not null default '{}',
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promoter_id, club_slug)
);

-- One-off availability overrides for specific calendar nights (promoter submits → admin approves).
create table if not exists public.promoter_night_adjustments (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  night_date date not null,
  available_override boolean not null,
  start_time time,
  end_time time,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promoter_id, night_date)
);

create index if not exists promoter_night_adj_pending_idx
on public.promoter_night_adjustments (created_at desc)
where status = 'pending';

create index if not exists promoter_night_adj_promoter_date_idx
on public.promoter_night_adjustments (promoter_id, night_date desc);

create table if not exists public.promoter_jobs (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  club_slug text references public.clubs (slug) on delete set null,
  service text not null default 'guestlist',
  job_date date not null,
  status text not null default 'assigned' check (status in ('assigned', 'completed', 'cancelled')),
  client_name text not null default '',
  client_contact text not null default '',
  guests_count integer not null default 0,
  shift_fee numeric(12,2) not null default 0,
  guestlist_fee numeric(12,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promoter_jobs
  add column if not exists client_name text not null default '';
alter table public.promoter_jobs
  add column if not exists client_contact text not null default '';

create table if not exists public.promoter_guestlist_entries (
  id uuid primary key default gen_random_uuid(),
  promoter_job_id uuid not null references public.promoter_jobs (id) on delete cascade,
  guest_name text not null default '',
  guest_contact text not null default '',
  approval_status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  review_notes text not null default '',
  created_at timestamptz not null default now()
);

-- Upgrade path: older DBs without approval columns (treat legacy rows as approved).
alter table public.promoter_guestlist_entries
  add column if not exists approval_status text;
alter table public.promoter_guestlist_entries
  add column if not exists reviewed_at timestamptz;
alter table public.promoter_guestlist_entries
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table public.promoter_guestlist_entries
  add column if not exists review_notes text;
update public.promoter_guestlist_entries
set approval_status = 'approved'
where approval_status is null;
update public.promoter_guestlist_entries
set review_notes = ''
where review_notes is null;
alter table public.promoter_guestlist_entries
  alter column review_notes set default '';
alter table public.promoter_guestlist_entries
  alter column review_notes set not null;
alter table public.promoter_guestlist_entries
  alter column approval_status set default 'pending';
alter table public.promoter_guestlist_entries
  alter column approval_status set not null;
alter table public.promoter_guestlist_entries
  drop constraint if exists promoter_guestlist_entries_approval_status_check;
alter table public.promoter_guestlist_entries
  drop constraint if exists promoter_guestlist_entries_approval_status_chk;
alter table public.promoter_guestlist_entries
  add constraint promoter_guestlist_entries_approval_status_chk
  check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists promoter_guestlist_entries_pending_idx
on public.promoter_guestlist_entries (created_at desc)
where approval_status = 'pending';

create table if not exists public.promoter_earnings (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  promoter_job_id uuid references public.promoter_jobs (id) on delete set null,
  earning_date date not null,
  source text not null default 'job',
  amount numeric(12,2) not null default 0,
  currency text not null default 'GBP',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.promoter_invoices (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'paid', 'cancelled')),
  subtotal numeric(12,2) not null default 0,
  adjustments numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  generated_at timestamptz not null default now(),
  finalized_at timestamptz
);

create table if not exists public.promoter_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.promoter_invoices (id) on delete cascade,
  promoter_job_id uuid references public.promoter_jobs (id) on delete set null,
  line_type text not null default 'job',
  description text not null default '',
  quantity numeric(12,2) not null default 1,
  unit_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Phase 6: email delivery metadata (Edge Function + Resend updates these).
alter table public.promoter_invoices add column if not exists sent_at timestamptz;
alter table public.promoter_invoices add column if not exists sent_to_email text not null default '';
alter table public.promoter_invoices add column if not exists emailed_via text not null default '';

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_date date not null,
  category text not null default '',
  direction text not null check (direction in ('income', 'expense')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'failed')),
  payment_tag text not null default '',
  amount numeric(12,2) not null default 0,
  currency text not null default 'GBP',
  convert_foreign boolean not null default false,
  source_type text not null default 'manual',
  source_ref uuid,
  payee_id uuid,
  payee_label text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.financial_transactions add column if not exists status text;
alter table public.financial_transactions add column if not exists payment_tag text;
alter table public.financial_transactions add column if not exists convert_foreign boolean;
alter table public.financial_transactions add column if not exists payee_id uuid;
alter table public.financial_transactions add column if not exists payee_label text;
update public.financial_transactions set status = 'pending' where status is null;
update public.financial_transactions set payment_tag = '' where payment_tag is null;
update public.financial_transactions set convert_foreign = false where convert_foreign is null;
update public.financial_transactions set payee_label = '' where payee_label is null;
alter table public.financial_transactions
  alter column status set default 'pending';
alter table public.financial_transactions
  alter column payment_tag set default '';
alter table public.financial_transactions
  alter column convert_foreign set default false;
alter table public.financial_transactions
  alter column payee_label set default '';
alter table public.financial_transactions
  alter column status set not null;
alter table public.financial_transactions
  alter column payment_tag set not null;
alter table public.financial_transactions
  alter column convert_foreign set not null;
alter table public.financial_transactions
  alter column payee_label set not null;
alter table public.financial_transactions
  drop constraint if exists financial_transactions_status_check;
alter table public.financial_transactions
  add constraint financial_transactions_status_check
  check (status in ('pending', 'paid', 'cancelled', 'failed'));

-- Recurring ledger templates used to auto-create entries in financial_transactions.
create table if not exists public.financial_recurring_templates (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  category text not null default '',
  direction text not null check (direction in ('income', 'expense')),
  default_status text not null default 'pending' check (default_status in ('pending', 'paid', 'cancelled', 'failed')),
  payment_tag text not null default '',
  amount numeric(12,2) not null default 0,
  currency text not null default 'GBP',
  convert_foreign boolean not null default false,
  payee_id uuid,
  payee_label text not null default '',
  notes text not null default '',
  interval_days integer not null check (interval_days >= 1),
  recurrence_unit text not null default 'monthly' check (recurrence_unit in ('monthly', 'quarterly', 'annual', 'custom_days')),
  recurrence_every integer not null default 1 check (recurrence_every >= 1 and recurrence_every <= 24),
  next_due_date date not null,
  is_active boolean not null default true,
  last_generated_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_recurring_templates add column if not exists default_status text;
alter table public.financial_recurring_templates add column if not exists payment_tag text;
alter table public.financial_recurring_templates add column if not exists convert_foreign boolean;
alter table public.financial_recurring_templates add column if not exists payee_id uuid;
alter table public.financial_recurring_templates add column if not exists payee_label text;
alter table public.financial_recurring_templates add column if not exists recurrence_unit text;
alter table public.financial_recurring_templates add column if not exists recurrence_every integer;
update public.financial_recurring_templates set default_status = 'pending' where default_status is null;
update public.financial_recurring_templates set payment_tag = '' where payment_tag is null;
update public.financial_recurring_templates set convert_foreign = false where convert_foreign is null;
update public.financial_recurring_templates set payee_label = '' where payee_label is null;
update public.financial_recurring_templates set recurrence_unit = 'custom_days' where recurrence_unit is null;
update public.financial_recurring_templates set recurrence_every = 1 where recurrence_every is null;
alter table public.financial_recurring_templates
  alter column default_status set default 'pending';
alter table public.financial_recurring_templates
  alter column payment_tag set default '';
alter table public.financial_recurring_templates
  alter column convert_foreign set default false;
alter table public.financial_recurring_templates
  alter column payee_label set default '';
alter table public.financial_recurring_templates
  alter column recurrence_unit set default 'monthly';
alter table public.financial_recurring_templates
  alter column recurrence_every set default 1;
alter table public.financial_recurring_templates
  alter column default_status set not null;
alter table public.financial_recurring_templates
  alter column payment_tag set not null;
alter table public.financial_recurring_templates
  alter column convert_foreign set not null;
alter table public.financial_recurring_templates
  alter column payee_label set not null;
alter table public.financial_recurring_templates
  alter column recurrence_unit set not null;
alter table public.financial_recurring_templates
  alter column recurrence_every set not null;
alter table public.financial_recurring_templates
  drop constraint if exists financial_recurring_templates_default_status_check;
alter table public.financial_recurring_templates
  add constraint financial_recurring_templates_default_status_check
  check (default_status in ('pending', 'paid', 'cancelled', 'failed'));
alter table public.financial_recurring_templates
  drop constraint if exists financial_recurring_templates_recurrence_unit_check;
alter table public.financial_recurring_templates
  add constraint financial_recurring_templates_recurrence_unit_check
  check (recurrence_unit in ('monthly', 'quarterly', 'annual', 'custom_days'));
alter table public.financial_recurring_templates
  drop constraint if exists financial_recurring_templates_recurrence_every_check;
alter table public.financial_recurring_templates
  add constraint financial_recurring_templates_recurrence_every_check
  check (recurrence_every >= 1 and recurrence_every <= 24);

create table if not exists public.financial_payees (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  default_payment_tag text not null default '',
  default_currency text not null default 'GBP',
  payment_details jsonb not null default '{}'::jsonb,
  tax_details jsonb not null default '{}'::jsonb,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_payees
  add column if not exists payment_details jsonb;
alter table public.financial_payees
  add column if not exists tax_details jsonb;
update public.financial_payees
set payment_details = '{}'::jsonb
where payment_details is null;
update public.financial_payees
set tax_details = '{}'::jsonb
where tax_details is null;
alter table public.financial_payees
  alter column payment_details set default '{}'::jsonb;
alter table public.financial_payees
  alter column payment_details set not null;
alter table public.financial_payees
  alter column tax_details set default '{}'::jsonb;
alter table public.financial_payees
  alter column tax_details set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_payee_fk'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_payee_fk
      foreign key (payee_id) references public.financial_payees (id) on delete set null;
  end if;
end $$;

-- Legacy cleanup: reviews now fully removed from site and catalog payloads.
update public.clubs
set payload = payload - 'reviews',
    updated_at = now()
where payload ? 'reviews';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_recurring_templates_payee_fk'
  ) then
    alter table public.financial_recurring_templates
      add constraint financial_recurring_templates_payee_fk
      foreign key (payee_id) references public.financial_payees (id) on delete set null;
  end if;
end $$;

-- Table / min-spend bookings: promoter-submitted rows are pending until admin approves;
-- office can log the same nights independently (entry_channel = admin, approved immediately).
create table if not exists public.promoter_table_sales (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  club_slug text not null references public.clubs (slug) on delete restrict,
  sale_date date not null,
  promoter_job_id uuid references public.promoter_jobs (id) on delete set null,
  entry_channel text not null check (entry_channel in ('promoter', 'admin')),
  tier text not null default 'other' check (tier in ('standard', 'luxury', 'vip', 'other')),
  table_count integer not null default 1 check (table_count >= 1 and table_count <= 99),
  total_min_spend numeric(12,2) not null default 0 check (total_min_spend >= 0),
  notes text not null default '',
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  review_notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists promoters_user_idx on public.promoters (user_id);
create index if not exists promoter_profile_revisions_promoter_idx on public.promoter_profile_revisions (promoter_id, status);
create index if not exists promoter_jobs_promoter_date_idx on public.promoter_jobs (promoter_id, job_date desc);
create index if not exists promoter_earnings_promoter_date_idx on public.promoter_earnings (promoter_id, earning_date desc);
create index if not exists promoter_invoices_promoter_period_idx on public.promoter_invoices (promoter_id, period_start, period_end);
create index if not exists financial_transactions_period_idx on public.financial_transactions (tx_date desc, direction);
create index if not exists financial_transactions_status_idx on public.financial_transactions (status, tx_date desc);
create index if not exists financial_transactions_tag_idx on public.financial_transactions (payment_tag, tx_date desc);
create index if not exists financial_transactions_payee_idx on public.financial_transactions (payee_id, tx_date desc);
create index if not exists financial_recurring_templates_due_idx
on public.financial_recurring_templates (next_due_date asc)
where is_active = true;
create index if not exists financial_payees_name_idx on public.financial_payees (name);
create index if not exists promoter_table_sales_date_idx on public.promoter_table_sales (sale_date desc);
create index if not exists promoter_table_sales_promoter_date_idx on public.promoter_table_sales (promoter_id, sale_date desc);
create index if not exists promoter_table_sales_pending_idx
on public.promoter_table_sales (created_at desc)
where approval_status = 'pending';

alter table public.clients
  drop constraint if exists clients_preferred_promoter_id_fkey;
alter table public.clients
  add constraint clients_preferred_promoter_id_fkey
  foreign key (preferred_promoter_id) references public.promoters (id) on delete set null;
alter table public.clients
  drop constraint if exists clients_preferred_club_slug_fkey;
alter table public.clients
  add constraint clients_preferred_club_slug_fkey
  foreign key (preferred_club_slug) references public.clubs (slug) on delete set null;

-- RLS defaults.
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_guests enable row level security;
alter table public.clubs enable row level security;
alter table public.cars enable row level security;
alter table public.club_weekly_flyers enable row level security;
alter table public.promoters enable row level security;
alter table public.promoter_profile_revisions enable row level security;
alter table public.promoter_availability enable row level security;
alter table public.promoter_club_preferences enable row level security;
alter table public.promoter_night_adjustments enable row level security;
alter table public.promoter_jobs enable row level security;
alter table public.promoter_guestlist_entries enable row level security;
alter table public.promoter_earnings enable row level security;
alter table public.promoter_invoices enable row level security;
alter table public.promoter_invoice_lines enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.financial_recurring_templates enable row level security;
alter table public.financial_payees enable row level security;
alter table public.promoter_table_sales enable row level security;
alter table public.client_attendances enable row level security;

-- Profiles: each user can read their own row (needed for admin role check in the browser).
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

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

drop policy if exists clients_promoter_select on public.clients;
create policy clients_promoter_select
on public.clients
for select
to authenticated
using (
  preferred_promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
);

drop policy if exists clients_promoter_insert on public.clients;
create policy clients_promoter_insert
on public.clients
for insert
to authenticated
with check (
  preferred_promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
);

drop policy if exists clients_promoter_update on public.clients;
create policy clients_promoter_update
on public.clients
for update
to authenticated
using (
  preferred_promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
)
with check (
  preferred_promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
);

drop policy if exists client_attendances_admin_all on public.client_attendances;
create policy client_attendances_admin_all
on public.client_attendances
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

drop policy if exists client_attendances_promoter_select on public.client_attendances;
create policy client_attendances_promoter_select
on public.client_attendances
for select
to authenticated
using (
  promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
  or exists (
    select 1
    from public.clients c
    where c.id = client_attendances.client_id
      and c.preferred_promoter_id = (
        select pr.id
        from public.promoters pr
        where pr.user_id = auth.uid()
        limit 1
      )
  )
);

drop policy if exists client_attendances_promoter_write on public.client_attendances;
create policy client_attendances_promoter_write
on public.client_attendances
for insert
to authenticated
with check (
  promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
);

drop policy if exists client_attendances_promoter_update on public.client_attendances;
create policy client_attendances_promoter_update
on public.client_attendances
for update
to authenticated
using (
  promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
)
with check (
  promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
);

drop policy if exists client_attendances_promoter_delete on public.client_attendances;
create policy client_attendances_promoter_delete
on public.client_attendances
for delete
to authenticated
using (
  promoter_id = (
    select pr.id
    from public.promoters pr
    where pr.user_id = auth.uid()
    limit 1
  )
);

create or replace function public.recalculate_client_preferences(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid;
  v_club_slug text;
  v_nights text;
  v_avg_spend numeric(12,2);
begin
  select promoter_id
  into v_promoter_id
  from public.client_attendances
  where client_id = p_client_id
    and promoter_id is not null
  group by promoter_id
  order by count(*) desc, max(event_date) desc
  limit 1;

  select club_slug
  into v_club_slug
  from public.client_attendances
  where client_id = p_client_id
  group by club_slug
  order by count(*) desc, max(event_date) desc
  limit 1;

  select round(avg(spend_gbp)::numeric, 2)
  into v_avg_spend
  from public.client_attendances
  where client_id = p_client_id
    and spend_gbp is not null;

  select string_agg(day_name, ', ' order by visits desc, day_name)
  into v_nights
  from (
    select
      (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[(extract(dow from event_date)::int + 1)] as day_name,
      count(*) as visits
    from public.client_attendances
    where client_id = p_client_id
    group by 1
    order by visits desc, day_name
    limit 2
  ) ranked_days;

  update public.clients
  set
    preferred_promoter_id = v_promoter_id,
    preferred_club_slug = v_club_slug,
    preferred_nights = nullif(coalesce(v_nights, ''), ''),
    typical_spend_gbp = v_avg_spend
  where id = p_client_id;
end;
$$;

create or replace function public.client_attendance_recalc_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_client_preferences(old.client_id);
    return old;
  end if;
  perform public.recalculate_client_preferences(new.client_id);
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    perform public.recalculate_client_preferences(old.client_id);
  end if;
  return new;
end;
$$;

drop trigger if exists client_attendance_recalc_after_change on public.client_attendances;
create trigger client_attendance_recalc_after_change
after insert or update or delete on public.client_attendances
for each row
execute function public.client_attendance_recalc_trigger();

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
  p_status text default 'assigned',
  p_client_name text default '',
  p_client_contact text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid;
  v_id uuid;
  v_service text := lower(trim(coalesce(p_service, 'guestlist')));
  v_status text := lower(trim(coalesce(p_status, 'assigned')));
begin
  select pr.id
  into v_promoter_id
  from public.promoters pr
  where pr.user_id = auth.uid()
  limit 1;

  if v_promoter_id is null then
    raise exception 'promoter profile not found for current user';
  end if;

  if v_service not in ('guestlist', 'table_sale', 'tickets', 'other') then
    v_service := 'other';
  end if;
  if v_status not in ('assigned', 'completed', 'cancelled') then
    v_status := 'assigned';
  end if;

  insert into public.promoter_jobs (
    promoter_id, club_slug, service, job_date, status, client_name, client_contact, guests_count, shift_fee, guestlist_fee, notes
  )
  values (
    v_promoter_id,
    nullif(trim(p_club_slug), ''),
    v_service,
    p_job_date,
    v_status,
    coalesce(p_client_name, ''),
    coalesce(p_client_contact, ''),
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

-- Promoter self-service + admin policies.
drop policy if exists promoters_admin_select on public.promoters;
create policy promoters_admin_select
on public.promoters
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoters_admin_write on public.promoters;
create policy promoters_admin_write
on public.promoters
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoters_self_select on public.promoters;
create policy promoters_self_select
on public.promoters
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists promoters_self_update on public.promoters;
create policy promoters_self_update
on public.promoters
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists promoters_self_insert on public.promoters;
create policy promoters_self_insert
on public.promoters
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists profile_revisions_admin on public.promoter_profile_revisions;
create policy profile_revisions_admin
on public.promoter_profile_revisions
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists profile_revisions_promoter_insert on public.promoter_profile_revisions;
create policy profile_revisions_promoter_insert
on public.promoter_profile_revisions
for insert
to authenticated
with check (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists profile_revisions_promoter_select on public.promoter_profile_revisions;
create policy profile_revisions_promoter_select
on public.promoter_profile_revisions
for select
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_availability_admin on public.promoter_availability;
create policy promoter_availability_admin
on public.promoter_availability
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_availability_self on public.promoter_availability;
create policy promoter_availability_self
on public.promoter_availability
for all
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_preferences_admin on public.promoter_club_preferences;
create policy promoter_preferences_admin
on public.promoter_club_preferences
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_preferences_self on public.promoter_club_preferences;
create policy promoter_preferences_self
on public.promoter_club_preferences
for all
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_night_adj_admin on public.promoter_night_adjustments;
create policy promoter_night_adj_admin
on public.promoter_night_adjustments
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_night_adj_promoter_select on public.promoter_night_adjustments;
create policy promoter_night_adj_promoter_select
on public.promoter_night_adjustments
for select
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_jobs_admin on public.promoter_jobs;
create policy promoter_jobs_admin
on public.promoter_jobs
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_jobs_promoter_select on public.promoter_jobs;
create policy promoter_jobs_promoter_select
on public.promoter_jobs
for select
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_guestlist_entries_admin on public.promoter_guestlist_entries;
create policy promoter_guestlist_entries_admin
on public.promoter_guestlist_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.promoter_jobs j
    join public.profiles p on p.id = auth.uid()
    where j.id = promoter_job_id and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.promoter_jobs j
    join public.profiles p on p.id = auth.uid()
    where j.id = promoter_job_id and p.role = 'admin'
  )
);

drop policy if exists promoter_guestlist_entries_promoter_select on public.promoter_guestlist_entries;
create policy promoter_guestlist_entries_promoter_select
on public.promoter_guestlist_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.promoter_jobs j
    join public.promoters pr on pr.id = j.promoter_id
    where j.id = promoter_job_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_earnings_admin on public.promoter_earnings;
create policy promoter_earnings_admin
on public.promoter_earnings
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_earnings_promoter_select on public.promoter_earnings;
create policy promoter_earnings_promoter_select
on public.promoter_earnings
for select
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_invoices_admin on public.promoter_invoices;
create policy promoter_invoices_admin
on public.promoter_invoices
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_invoices_promoter_select on public.promoter_invoices;
create policy promoter_invoices_promoter_select
on public.promoter_invoices
for select
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

drop policy if exists promoter_invoice_lines_admin on public.promoter_invoice_lines;
create policy promoter_invoice_lines_admin
on public.promoter_invoice_lines
for all
to authenticated
using (
  exists (
    select 1
    from public.promoter_invoices i
    join public.profiles p on p.id = auth.uid()
    where i.id = invoice_id and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.promoter_invoices i
    join public.profiles p on p.id = auth.uid()
    where i.id = invoice_id and p.role = 'admin'
  )
);

drop policy if exists promoter_invoice_lines_promoter_select on public.promoter_invoice_lines;
create policy promoter_invoice_lines_promoter_select
on public.promoter_invoice_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.promoter_invoices i
    join public.promoters pr on pr.id = i.promoter_id
    where i.id = invoice_id and pr.user_id = auth.uid()
  )
);

drop policy if exists financial_transactions_admin on public.financial_transactions;
create policy financial_transactions_admin
on public.financial_transactions
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists financial_recurring_templates_admin on public.financial_recurring_templates;
create policy financial_recurring_templates_admin
on public.financial_recurring_templates
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists financial_payees_admin on public.financial_payees;
create policy financial_payees_admin
on public.financial_payees
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_table_sales_admin on public.promoter_table_sales;
create policy promoter_table_sales_admin
on public.promoter_table_sales
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists promoter_table_sales_promoter_select on public.promoter_table_sales;
create policy promoter_table_sales_promoter_select
on public.promoter_table_sales
for select
to authenticated
using (
  exists (
    select 1 from public.promoters pr where pr.id = promoter_id and pr.user_id = auth.uid()
  )
);

create or replace function public.approve_promoter_profile_revision(
  p_revision_id uuid,
  p_approve boolean,
  p_review_notes text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoter_id uuid;
  v_payload jsonb;
  v_status text := case when p_approve then 'approved' else 'rejected' end;
  v_imgs jsonb;
  v_primary text;
  v_portfolio text[];
  v_payment_details jsonb := '{}'::jsonb;
  v_tax_details jsonb := '{}'::jsonb;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;

  update public.promoter_profile_revisions
  set status = v_status,
      reviewer_id = auth.uid(),
      review_notes = coalesce(p_review_notes, ''),
      reviewed_at = now()
  where id = p_revision_id
  returning promoter_id, payload
  into v_promoter_id, v_payload;

  if v_promoter_id is null then
    raise exception 'revision not found';
  end if;

  if p_approve then
    select coalesce(
      (
        select jsonb_agg(to_jsonb(t.u) order by t.ord)
        from (
          select trim(both from e.value) as u,
            row_number() over () as ord
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(coalesce(v_payload->'profile_image_urls', '[]'::jsonb)) = 'array'
                then coalesce(v_payload->'profile_image_urls', '[]'::jsonb)
              else '[]'::jsonb
            end
          ) as e(value)
          where length(trim(both from e.value)) > 0
        ) t
        where t.ord <= 12
      ),
      '[]'::jsonb
    )
    into v_imgs;

    if coalesce(jsonb_array_length(v_imgs), 0) = 0
      and length(trim(both from coalesce(v_payload->>'profile_image_url', ''))) > 0 then
      v_imgs := jsonb_build_array(trim(v_payload->>'profile_image_url'));
    end if;

    v_primary := case
      when coalesce(jsonb_array_length(v_imgs), 0) > 0 then trim(both from (v_imgs->>0))
      else ''
    end;

    select coalesce(
      array(
        select distinct q.slug
        from (
          select trim(both from e.value) as slug
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(coalesce(v_payload->'portfolio_club_slugs', '[]'::jsonb)) = 'array'
                then coalesce(v_payload->'portfolio_club_slugs', '[]'::jsonb)
              else '[]'::jsonb
            end
          ) as e(value)
          where length(trim(both from e.value)) > 0
          limit 24
        ) q
      ),
      '{}'::text[]
    )
    into v_portfolio;

    v_payment_details := case
      when jsonb_typeof(v_payload->'payment_details') = 'object'
        then coalesce(v_payload->'payment_details', '{}'::jsonb)
      else '{}'::jsonb
    end;
    v_tax_details := case
      when jsonb_typeof(v_payload->'tax_details') = 'object'
        then coalesce(v_payload->'tax_details', '{}'::jsonb)
      else '{}'::jsonb
    end;

    update public.promoters
    set display_name = coalesce(nullif(trim(v_payload->>'display_name'), ''), display_name),
        bio = coalesce(v_payload->>'bio', bio),
        profile_image_urls = coalesce(v_imgs, '[]'::jsonb),
        profile_image_url = case
          when coalesce(jsonb_array_length(v_imgs), 0) > 0 then trim(both from (v_imgs->>0))
          else ''
        end,
        portfolio_club_slugs = coalesce(v_portfolio, '{}'::text[]),
        payment_details = coalesce(v_payment_details, '{}'::jsonb),
        tax_details = coalesce(v_tax_details, '{}'::jsonb),
        is_approved = true,
        approval_status = 'approved',
        approval_notes = coalesce(p_review_notes, ''),
        updated_at = now()
    where id = v_promoter_id;
  else
    update public.promoters
    set approval_status = 'rejected',
        approval_notes = coalesce(p_review_notes, ''),
        updated_at = now()
    where id = v_promoter_id;
  end if;

  return v_promoter_id;
end;
$$;

create or replace function public.calculate_promoter_earnings(
  p_promoter_id uuid,
  p_from date,
  p_to date
) returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric
  from public.promoter_earnings
  where promoter_id = p_promoter_id
    and earning_date between p_from and p_to;
$$;

create or replace function public.generate_promoter_invoice(
  p_promoter_id uuid,
  p_period_start date,
  p_period_end date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  r record;
  v_total numeric := 0;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;

  insert into public.promoter_invoices (
    promoter_id, period_start, period_end, status, subtotal, adjustments, total
  ) values (
    p_promoter_id, p_period_start, p_period_end, 'draft', 0, 0, 0
  )
  returning id into v_invoice_id;

  for r in
    select id, earning_date, source, amount, notes
    from public.promoter_earnings
    where promoter_id = p_promoter_id
      and earning_date between p_period_start and p_period_end
    order by earning_date asc, created_at asc
  loop
    insert into public.promoter_invoice_lines (
      invoice_id, line_type, description, quantity, unit_amount, line_total
    ) values (
      v_invoice_id,
      coalesce(nullif(r.source, ''), 'earning'),
      coalesce(r.notes, '') || ' ' || to_char(r.earning_date, 'YYYY-MM-DD'),
      1,
      r.amount,
      r.amount
    );
    v_total := v_total + coalesce(r.amount, 0);
  end loop;

  update public.promoter_invoices
  set subtotal = v_total,
      total = v_total,
      generated_at = now()
  where id = v_invoice_id;

  return v_invoice_id;
end;
$$;

drop function if exists public.get_financial_report(text, date, date);
drop function if exists public.get_financial_report(text, date, date, text, text, text, uuid);
create or replace function public.get_financial_report(
  p_period_type text,
  p_from date,
  p_to date,
  p_direction text default null,
  p_status text default null,
  p_payment_tag text default null,
  p_payee_id uuid default null
) returns table (
  period_label text,
  income numeric,
  expense numeric,
  net numeric
)
language sql
security definer
set search_path = public
as $$
  with tx as (
    select
      case
        when p_period_type = 'month' then to_char(tx_date, 'YYYY-MM')
        else to_char(tx_date, 'YYYY') || '-TAX'
      end as period_label,
      direction,
      amount
    from public.financial_transactions
    where tx_date between p_from and p_to
      and (p_direction is null or p_direction = '' or direction = p_direction)
      and (p_status is null or p_status = '' or status = p_status)
      and (p_payment_tag is null or p_payment_tag = '' or payment_tag = p_payment_tag)
      and (p_payee_id is null or payee_id = p_payee_id)
  )
  select
    period_label,
    coalesce(sum(case when direction = 'income' then amount else 0 end), 0)::numeric as income,
    coalesce(sum(case when direction = 'expense' then amount else 0 end), 0)::numeric as expense,
    coalesce(sum(case when direction = 'income' then amount else -amount end), 0)::numeric as net
  from tx
  group by period_label
  order by period_label;
$$;

drop function if exists public.apply_recurring_financial_transactions(date);
create or replace function public.apply_recurring_financial_transactions(
  p_through date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  v_due date;
  v_created int := 0;
  v_next date;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Admin only.');
  end if;

  for t in
    select *
    from public.financial_recurring_templates
    where is_active = true
      and next_due_date <= p_through
    order by next_due_date asc
  loop
    v_due := t.next_due_date;
    while v_due <= p_through loop
      insert into public.financial_transactions (
        tx_date,
        category,
        direction,
        status,
        payment_tag,
        amount,
        currency,
        convert_foreign,
        source_type,
        source_ref,
        payee_id,
        payee_label,
        notes
      ) values (
        v_due,
        t.category,
        t.direction,
        t.default_status,
        t.payment_tag,
        t.amount,
        t.currency,
        t.convert_foreign,
        'recurring_template',
        t.id,
        t.payee_id,
        t.payee_label,
        t.notes
      );
      v_created := v_created + 1;
      if t.recurrence_unit = 'monthly' then
        v_next := (v_due + make_interval(months => t.recurrence_every))::date;
      elsif t.recurrence_unit = 'quarterly' then
        v_next := (v_due + make_interval(months => (3 * t.recurrence_every)))::date;
      elsif t.recurrence_unit = 'annual' then
        v_next := (v_due + make_interval(years => t.recurrence_every))::date;
      else
        v_next := (v_due + make_interval(days => greatest(1, t.interval_days)))::date;
      end if;
      v_due := v_next;
    end loop;

    update public.financial_recurring_templates
    set
      next_due_date = v_due,
      last_generated_on = (
        case
          when t.recurrence_unit = 'monthly' then (v_due - make_interval(months => t.recurrence_every))::date
          when t.recurrence_unit = 'quarterly' then (v_due - make_interval(months => (3 * t.recurrence_every)))::date
          when t.recurrence_unit = 'annual' then (v_due - make_interval(years => t.recurrence_every))::date
          else (v_due - make_interval(days => greatest(1, t.interval_days)))::date
        end
      ),
      updated_at = now()
    where id = t.id;
  end loop;

  return jsonb_build_object('ok', true, 'createdRows', v_created);
end;
$$;

drop function if exists public.get_financial_period_summary(date, date);
drop function if exists public.get_financial_period_summary(date, date, text, text, text, uuid);
create or replace function public.get_financial_period_summary(
  p_from date,
  p_to date,
  p_direction text default null,
  p_status text default null,
  p_payment_tag text default null,
  p_payee_id uuid default null
) returns table (
  income numeric,
  expense numeric,
  net numeric,
  tx_count integer
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(sum(case when direction = 'income' then amount else 0 end), 0)::numeric as income,
    coalesce(sum(case when direction = 'expense' then amount else 0 end), 0)::numeric as expense,
    coalesce(sum(case when direction = 'income' then amount else -amount end), 0)::numeric as net,
    count(*)::int as tx_count
  from public.financial_transactions
  where tx_date between p_from and p_to
  and (p_direction is null or p_direction = '' or direction = p_direction)
  and (p_status is null or p_status = '' or status = p_status)
  and (p_payment_tag is null or p_payment_tag = '' or payment_tag = p_payment_tag)
  and (p_payee_id is null or payee_id = p_payee_id);
$$;

grant execute on function public.approve_promoter_profile_revision(uuid, boolean, text) to authenticated;
grant execute on function public.calculate_promoter_earnings(uuid, date, date) to authenticated;
grant execute on function public.generate_promoter_invoice(uuid, date, date) to authenticated;
grant execute on function public.get_financial_report(text, date, date, text, text, text, uuid) to authenticated;
grant execute on function public.apply_recurring_financial_transactions(date) to authenticated;
grant execute on function public.get_financial_period_summary(date, date, text, text, text, uuid) to authenticated;

-- Guest intelligence domain (signups, attendance, demographics, campaigns).
create table if not exists public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  primary_phone text,
  primary_email text,
  primary_instagram text,
  age smallint,
  gender text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_identity_links (
  id uuid primary key default gen_random_uuid(),
  guest_profile_id uuid not null references public.guest_profiles (id) on delete cascade,
  identity_type text not null check (identity_type in ('phone', 'email', 'instagram')),
  identity_value text not null,
  normalized_value text not null,
  created_at timestamptz not null default now(),
  unique (identity_type, normalized_value)
);

create table if not exists public.guestlist_events (
  id uuid primary key default gen_random_uuid(),
  club_slug text not null references public.clubs (slug) on delete cascade,
  event_date date not null,
  promoter_id uuid references public.promoters (id) on delete set null,
  capacity integer not null default 0,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_slug, event_date, promoter_id)
);

create table if not exists public.guestlist_signups (
  id uuid primary key default gen_random_uuid(),
  guestlist_event_id uuid not null references public.guestlist_events (id) on delete cascade,
  guest_profile_id uuid not null references public.guest_profiles (id) on delete cascade,
  source text not null default 'website',
  signup_at timestamptz not null default now(),
  status text not null default 'signed_up' check (status in ('signed_up', 'attended', 'no_show', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (guestlist_event_id, guest_profile_id)
);

create table if not exists public.guestlist_checkins (
  id uuid primary key default gen_random_uuid(),
  guestlist_signup_id uuid not null references public.guestlist_signups (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checkin_source text not null check (checkin_source in ('self', 'promoter', 'admin')),
  checked_in_by uuid references auth.users (id) on delete set null,
  notes text not null default ''
);

create table if not exists public.guestlist_demographics (
  id uuid primary key default gen_random_uuid(),
  guest_profile_id uuid not null references public.guest_profiles (id) on delete cascade,
  guestlist_event_id uuid references public.guestlist_events (id) on delete set null,
  age smallint,
  gender text,
  source text not null check (source in ('self', 'promoter', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_audiences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  filter_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_audience_members (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references public.campaign_audiences (id) on delete cascade,
  guest_profile_id uuid not null references public.guest_profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (audience_id, guest_profile_id)
);

create index if not exists guest_profiles_seen_idx on public.guest_profiles (last_seen_at desc);
create index if not exists guest_identity_lookup_idx on public.guest_identity_links (identity_type, normalized_value);
create index if not exists guestlist_events_date_idx on public.guestlist_events (event_date desc, club_slug);
create index if not exists guestlist_signups_event_idx on public.guestlist_signups (guestlist_event_id, status);
create index if not exists guestlist_signups_guest_idx on public.guestlist_signups (guest_profile_id, signup_at desc);
create index if not exists guestlist_checkins_signup_idx on public.guestlist_checkins (guestlist_signup_id, checked_in_at desc);
create index if not exists guestlist_demographics_guest_idx on public.guestlist_demographics (guest_profile_id, created_at desc);

alter table public.clients
  drop constraint if exists clients_guest_profile_id_fkey;
alter table public.clients
  add constraint clients_guest_profile_id_fkey
  foreign key (guest_profile_id) references public.guest_profiles (id) on delete set null;

alter table public.guest_profiles enable row level security;
alter table public.guest_identity_links enable row level security;
alter table public.guestlist_events enable row level security;
alter table public.guestlist_signups enable row level security;
alter table public.guestlist_checkins enable row level security;
alter table public.guestlist_demographics enable row level security;
alter table public.campaign_audiences enable row level security;
alter table public.campaign_audience_members enable row level security;

drop policy if exists guest_profiles_admin on public.guest_profiles;
create policy guest_profiles_admin
on public.guest_profiles
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

drop policy if exists guest_identity_links_admin on public.guest_identity_links;
create policy guest_identity_links_admin
on public.guest_identity_links
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

drop policy if exists guestlist_events_admin on public.guestlist_events;
create policy guestlist_events_admin
on public.guestlist_events
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

drop policy if exists guestlist_signups_admin on public.guestlist_signups;
create policy guestlist_signups_admin
on public.guestlist_signups
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

drop policy if exists guestlist_checkins_admin on public.guestlist_checkins;
create policy guestlist_checkins_admin
on public.guestlist_checkins
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

drop policy if exists guestlist_demographics_admin on public.guestlist_demographics;
create policy guestlist_demographics_admin
on public.guestlist_demographics
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

drop policy if exists campaign_audiences_admin on public.campaign_audiences;
create policy campaign_audiences_admin
on public.campaign_audiences
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

drop policy if exists campaign_audience_members_admin on public.campaign_audience_members;
create policy campaign_audience_members_admin
on public.campaign_audience_members
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'promoter')));

create or replace function public.upsert_guest_profile_from_identity(
  p_full_name text,
  p_phone text default null,
  p_email text default null,
  p_instagram text default null,
  p_age smallint default null,
  p_gender text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_ig text := nullif(lower(regexp_replace(trim(coalesce(p_instagram, '')), '^@+', '')), '');
  v_guest_id uuid;
begin
  select guest_profile_id into v_guest_id
  from public.guest_identity_links
  where (identity_type = 'phone' and normalized_value = coalesce(v_phone, '___none___'))
     or (identity_type = 'email' and normalized_value = coalesce(v_email, '___none___'))
     or (identity_type = 'instagram' and normalized_value = coalesce(v_ig, '___none___'))
  limit 1;

  if v_guest_id is null then
    insert into public.guest_profiles (
      full_name, primary_phone, primary_email, primary_instagram, age, gender, first_seen_at, last_seen_at
    ) values (
      coalesce(nullif(trim(p_full_name), ''), 'Guest'),
      v_phone,
      v_email,
      v_ig,
      p_age,
      nullif(trim(coalesce(p_gender, '')), ''),
      now(),
      now()
    )
    returning id into v_guest_id;
  else
    update public.guest_profiles
    set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        primary_phone = coalesce(v_phone, primary_phone),
        primary_email = coalesce(v_email, primary_email),
        primary_instagram = coalesce(v_ig, primary_instagram),
        age = coalesce(p_age, age),
        gender = coalesce(nullif(trim(coalesce(p_gender, '')), ''), gender),
        last_seen_at = now(),
        updated_at = now()
    where id = v_guest_id;
  end if;

  if v_phone is not null then
    insert into public.guest_identity_links (guest_profile_id, identity_type, identity_value, normalized_value)
    values (v_guest_id, 'phone', coalesce(p_phone, ''), v_phone)
    on conflict (identity_type, normalized_value) do update
    set guest_profile_id = excluded.guest_profile_id;
  end if;
  if v_email is not null then
    insert into public.guest_identity_links (guest_profile_id, identity_type, identity_value, normalized_value)
    values (v_guest_id, 'email', coalesce(p_email, ''), v_email)
    on conflict (identity_type, normalized_value) do update
    set guest_profile_id = excluded.guest_profile_id;
  end if;
  if v_ig is not null then
    insert into public.guest_identity_links (guest_profile_id, identity_type, identity_value, normalized_value)
    values (v_guest_id, 'instagram', coalesce(p_instagram, ''), v_ig)
    on conflict (identity_type, normalized_value) do update
    set guest_profile_id = excluded.guest_profile_id;
  end if;

  return v_guest_id;
end;
$$;

create or replace function public.promote_signup_to_attended(
  p_signup_id uuid,
  p_source text,
  p_checked_in_by uuid default null,
  p_age smallint default null,
  p_gender text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_checkin_id uuid;
begin
  update public.guestlist_signups
  set status = 'attended'
  where id = p_signup_id
  returning guestlist_event_id, guest_profile_id into v_event_id, v_guest_id;

  if v_guest_id is null then
    raise exception 'signup not found';
  end if;

  insert into public.guestlist_checkins (
    guestlist_signup_id, checked_in_at, checkin_source, checked_in_by
  ) values (
    p_signup_id, now(), coalesce(nullif(trim(p_source), ''), 'admin'), p_checked_in_by
  )
  returning id into v_checkin_id;

  if p_age is not null or nullif(trim(coalesce(p_gender, '')), '') is not null then
    insert into public.guestlist_demographics (
      guest_profile_id, guestlist_event_id, age, gender, source
    ) values (
      v_guest_id,
      v_event_id,
      p_age,
      nullif(trim(coalesce(p_gender, '')), ''),
      coalesce(nullif(trim(p_source), ''), 'admin')
    );
  end if;

  update public.guest_profiles
  set last_seen_at = now(),
      age = coalesce(p_age, age),
      gender = coalesce(nullif(trim(coalesce(p_gender, '')), ''), gender),
      updated_at = now()
  where id = v_guest_id;

  return v_checkin_id;
end;
$$;

create or replace function public.create_guestlist_signup_bundle(
  p_club_slug text,
  p_event_date date,
  p_source text,
  p_guests jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  elem jsonb;
  v_guest_id uuid;
  v_count integer := 0;
  v_name text;
  v_contact text;
  v_phone text;
  v_email text;
  v_ig text;
begin
  if nullif(trim(coalesce(p_club_slug, '')), '') is null then
    return 0;
  end if;

  select id into v_event_id
  from public.guestlist_events
  where club_slug = p_club_slug
    and event_date = p_event_date
    and promoter_id is null
  limit 1;

  if v_event_id is null then
    insert into public.guestlist_events (club_slug, event_date, promoter_id, status, notes)
    values (p_club_slug, p_event_date, null, 'open', 'Auto-created from website guestlist signup')
    returning id into v_event_id;
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_guests, '[]'::jsonb))
  loop
    v_name := nullif(trim(coalesce(elem->>'guestName', '')), '');
    v_contact := trim(coalesce(elem->>'guestContact', ''));
    if v_name is null or v_contact = '' then
      continue;
    end if;
    v_phone := null;
    v_email := null;
    v_ig := null;
    if v_contact ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      v_email := lower(v_contact);
    elsif length(regexp_replace(v_contact, '\D', '', 'g')) >= 8 then
      v_phone := regexp_replace(v_contact, '\D', '', 'g');
    else
      v_ig := lower(regexp_replace(v_contact, '^@+', ''));
    end if;

    v_guest_id := public.upsert_guest_profile_from_identity(
      v_name, v_phone, v_email, v_ig, null, null
    );

    insert into public.guestlist_signups (
      guestlist_event_id, guest_profile_id, source, signup_at, status, created_by, metadata
    ) values (
      v_event_id,
      v_guest_id,
      coalesce(nullif(trim(coalesce(p_source, '')), ''), 'website'),
      now(),
      'signed_up',
      auth.uid(),
      jsonb_build_object('channel', 'guestlist_form')
    )
    on conflict (guestlist_event_id, guest_profile_id) do update
    set signup_at = excluded.signup_at;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.get_guestlist_conversion_metrics(
  p_club_slug text default null,
  p_promoter_id uuid default null,
  p_from date default null,
  p_to date default null
) returns table (
  event_id uuid,
  club_slug text,
  promoter_id uuid,
  event_date date,
  signups integer,
  attended integer,
  conversion numeric
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      e.id as event_id,
      e.club_slug,
      e.promoter_id,
      e.event_date,
      count(s.id) as signups,
      count(s.id) filter (where s.status = 'attended') as attended
    from public.guestlist_events e
    left join public.guestlist_signups s on s.guestlist_event_id = e.id
    where (p_club_slug is null or e.club_slug = p_club_slug)
      and (p_promoter_id is null or e.promoter_id = p_promoter_id)
      and (p_from is null or e.event_date >= p_from)
      and (p_to is null or e.event_date <= p_to)
    group by e.id, e.club_slug, e.promoter_id, e.event_date
  )
  select
    event_id,
    club_slug,
    promoter_id,
    event_date,
    signups::integer,
    attended::integer,
    case when signups > 0 then round(attended::numeric / signups::numeric, 4) else 0 end as conversion
  from base
  order by event_date desc;
$$;

create or replace function public.generate_campaign_audience(
  p_name text,
  p_description text default '',
  p_filter_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audience_id uuid;
  v_min_events int := coalesce((p_filter_payload->>'min_attended_events')::int, 1);
begin
  insert into public.campaign_audiences (
    name, description, filter_payload, created_by
  ) values (
    coalesce(nullif(trim(p_name), ''), 'Untitled audience'),
    coalesce(p_description, ''),
    coalesce(p_filter_payload, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_audience_id;

  insert into public.campaign_audience_members (audience_id, guest_profile_id)
  select v_audience_id, s.guest_profile_id
  from public.guestlist_signups s
  where s.status = 'attended'
  group by s.guest_profile_id
  having count(*) >= v_min_events;

  return v_audience_id;
end;
$$;

grant execute on function public.upsert_guest_profile_from_identity(text, text, text, text, smallint, text) to anon, authenticated;
grant execute on function public.promote_signup_to_attended(uuid, text, uuid, smallint, text) to authenticated;
grant execute on function public.create_guestlist_signup_bundle(text, date, text, jsonb) to anon, authenticated;
grant execute on function public.get_guestlist_conversion_metrics(text, uuid, date, date) to authenticated;
grant execute on function public.generate_campaign_audience(text, text, jsonb) to authenticated;

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

-- Admin: delete a promoter job and completion side-effects in one transaction.
drop function if exists public.delete_promoter_job_safe(uuid);
create or replace function public.delete_promoter_job_safe(p_job_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  n_tx int := 0;
  n_earn int := 0;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Admin only.');
  end if;

  if not exists (select 1 from public.promoter_jobs where id = p_job_id) then
    return jsonb_build_object('ok', false, 'error', 'Job not found.');
  end if;

  delete from public.financial_transactions
  where source_type = 'promoter_job'
    and source_ref = p_job_id;
  get diagnostics n_tx = row_count;

  delete from public.promoter_earnings
  where promoter_job_id = p_job_id;
  get diagnostics n_earn = row_count;

  delete from public.promoter_jobs
  where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'clearedFinancialTx', n_tx,
    'clearedEarnings', n_earn
  );
end;
$$;

grant execute on function public.delete_promoter_job_safe(uuid) to authenticated;

-- Promoter adds a guestlist name (pending until admin approves). Billing uses approved rows only.
drop function if exists public.insert_promoter_guestlist_entry(uuid, text, text);
create or replace function public.insert_promoter_guestlist_entry(
  p_job_id uuid,
  p_guest_name text,
  p_guest_contact text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
  v_ok boolean;
begin
  if trim(coalesce(p_guest_name, '')) = '' then
    raise exception 'Guest name is required.';
  end if;

  select exists (
    select 1
    from public.promoter_jobs j
    join public.promoters pr on pr.id = j.promoter_id
    where j.id = p_job_id
      and pr.user_id = auth.uid()
      and j.status = 'assigned'
      and coalesce(nullif(trim(both from j.service), ''), 'guestlist') = 'guestlist'
  ) into v_ok;

  if not coalesce(v_ok, false) then
    raise exception 'Job not found, not an assigned guestlist shift, or not yours.';
  end if;

  insert into public.promoter_guestlist_entries (
    promoter_job_id, guest_name, guest_contact, approval_status
  ) values (
    p_job_id,
    trim(coalesce(p_guest_name, '')),
    trim(coalesce(p_guest_contact, '')),
    'pending'
  )
  returning id into v_new;

  return v_new;
end;
$$;

drop function if exists public.admin_review_guestlist_entry(uuid, boolean, text);
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

  update public.promoter_jobs j
  set
    guests_count = (
      select count(*)::int
      from public.promoter_guestlist_entries e
      where e.promoter_job_id = j.id
        and e.approval_status = 'approved'
    ),
    updated_at = now()
  where j.id = v_job_id;

  return jsonb_build_object('ok', true, 'promoterJobId', v_job_id);
end;
$$;

grant execute on function public.insert_promoter_guestlist_entry(uuid, text, text) to authenticated;
grant execute on function public.admin_review_guestlist_entry(uuid, boolean, text) to authenticated;

-- Promoter: log table / min-spend for a night (pending until admin approves).
drop function if exists public.insert_promoter_table_sale(date, text, uuid, text, integer, numeric, text);
create or replace function public.insert_promoter_table_sale(
  p_sale_date date,
  p_club_slug text,
  p_promoter_job_id uuid,
  p_tier text,
  p_table_count integer,
  p_total_min_spend numeric,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_new uuid;
  v_tier text;
  v_slug text := trim(both from coalesce(p_club_slug, ''));
  v_spend numeric(12,2) := coalesce(p_total_min_spend, 0);
begin
  select pr.id into v_pid
  from public.promoters pr
  where pr.user_id = auth.uid();

  if v_pid is null then
    raise exception 'Not signed in as a promoter.';
  end if;

  if v_slug = '' then
    raise exception 'Club is required.';
  end if;

  if not exists (select 1 from public.clubs c where c.slug = v_slug) then
    raise exception 'Unknown club slug.';
  end if;

  if p_table_count is null or p_table_count < 1 or p_table_count > 99 then
    raise exception 'Table count must be between 1 and 99.';
  end if;

  if v_spend < 0 then
    raise exception 'Total min spend cannot be negative.';
  end if;

  v_tier := lower(trim(both from coalesce(p_tier, 'other')));
  if v_tier not in ('standard', 'luxury', 'vip', 'other') then
    v_tier := 'other';
  end if;

  if p_promoter_job_id is not null then
    if not exists (
      select 1
      from public.promoter_jobs j
      where j.id = p_promoter_job_id
        and j.promoter_id = v_pid
        and j.job_date = p_sale_date
        and coalesce(j.club_slug, '') = v_slug
    ) then
      raise exception 'Selected job must match promoter, club, and date.';
    end if;
  end if;

  insert into public.promoter_table_sales (
    promoter_id,
    club_slug,
    sale_date,
    promoter_job_id,
    entry_channel,
    tier,
    table_count,
    total_min_spend,
    notes,
    approval_status
  ) values (
    v_pid,
    v_slug,
    p_sale_date,
    p_promoter_job_id,
    'promoter',
    v_tier,
    p_table_count,
    v_spend,
    trim(coalesce(p_notes, '')),
    'pending'
  )
  returning id into v_new;

  return v_new;
end;
$$;

-- Admin: office-side table log (approved immediately for dual-entry reconciliation).
drop function if exists public.admin_insert_table_sale(uuid, date, text, uuid, text, integer, numeric, text);
create or replace function public.admin_insert_table_sale(
  p_promoter_id uuid,
  p_sale_date date,
  p_club_slug text,
  p_promoter_job_id uuid,
  p_tier text,
  p_table_count integer,
  p_total_min_spend numeric,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
  v_tier text;
  v_slug text := trim(both from coalesce(p_club_slug, ''));
  v_spend numeric(12,2) := coalesce(p_total_min_spend, 0);
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Admin only.';
  end if;

  if not exists (select 1 from public.promoters pr where pr.id = p_promoter_id) then
    raise exception 'Promoter not found.';
  end if;

  if v_slug = '' then
    raise exception 'Club is required.';
  end if;

  if not exists (select 1 from public.clubs c where c.slug = v_slug) then
    raise exception 'Unknown club slug.';
  end if;

  if p_table_count is null or p_table_count < 1 or p_table_count > 99 then
    raise exception 'Table count must be between 1 and 99.';
  end if;

  if v_spend < 0 then
    raise exception 'Total min spend cannot be negative.';
  end if;

  v_tier := lower(trim(both from coalesce(p_tier, 'other')));
  if v_tier not in ('standard', 'luxury', 'vip', 'other') then
    v_tier := 'other';
  end if;

  if p_promoter_job_id is not null then
    if not exists (
      select 1
      from public.promoter_jobs j
      where j.id = p_promoter_job_id
        and j.promoter_id = p_promoter_id
        and j.job_date = p_sale_date
        and coalesce(j.club_slug, '') = v_slug
    ) then
      raise exception 'Selected job must match promoter, club, and date.';
    end if;
  end if;

  insert into public.promoter_table_sales (
    promoter_id,
    club_slug,
    sale_date,
    promoter_job_id,
    entry_channel,
    tier,
    table_count,
    total_min_spend,
    notes,
    approval_status,
    reviewed_at,
    reviewed_by,
    review_notes
  ) values (
    p_promoter_id,
    v_slug,
    p_sale_date,
    p_promoter_job_id,
    'admin',
    v_tier,
    p_table_count,
    v_spend,
    trim(coalesce(p_notes, '')),
    'approved',
    now(),
    auth.uid(),
    ''
  )
  returning id into v_new;

  return v_new;
end;
$$;

drop function if exists public.admin_review_table_sale(uuid, boolean, text);
create or replace function public.admin_review_table_sale(
  p_entry_id uuid,
  p_approve boolean,
  p_review_notes text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Admin only.');
  end if;

  select s.approval_status into v_status
  from public.promoter_table_sales s
  where s.id = p_entry_id;

  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'Entry not found.');
  end if;

  if v_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Entry already reviewed.');
  end if;

  update public.promoter_table_sales
  set
    approval_status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = trim(coalesce(p_review_notes, ''))
  where id = p_entry_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.insert_promoter_table_sale(date, text, uuid, text, integer, numeric, text) to authenticated;
grant execute on function public.admin_insert_table_sale(uuid, date, text, uuid, text, integer, numeric, text) to authenticated;
grant execute on function public.admin_review_table_sale(uuid, boolean, text) to authenticated;

-- Promoter: request a one-off change for a specific calendar night (admin approves).
drop function if exists public.upsert_promoter_night_adjustment(date, boolean, time, time, text);
create or replace function public.upsert_promoter_night_adjustment(
  p_night_date date,
  p_available_override boolean,
  p_start_time time,
  p_end_time time,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_id uuid;
begin
  select pr.id into v_pid
  from public.promoters pr
  where pr.user_id = auth.uid();

  if v_pid is null then
    raise exception 'Not signed in as a promoter.';
  end if;

  insert into public.promoter_night_adjustments (
    promoter_id,
    night_date,
    available_override,
    start_time,
    end_time,
    notes,
    status
  ) values (
    v_pid,
    p_night_date,
    p_available_override,
    p_start_time,
    p_end_time,
    trim(coalesce(p_notes, '')),
    'pending'
  )
  on conflict (promoter_id, night_date) do update
  set
    available_override = excluded.available_override,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    notes = excluded.notes,
    status = 'pending',
    reviewed_at = null,
    reviewed_by = null,
    review_notes = '',
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

drop function if exists public.admin_review_night_adjustment(uuid, boolean, text);
create or replace function public.admin_review_night_adjustment(
  p_adjustment_id uuid,
  p_approve boolean,
  p_review_notes text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stat text;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Admin only.');
  end if;

  select a.status into v_stat
  from public.promoter_night_adjustments a
  where a.id = p_adjustment_id;

  if v_stat is null then
    return jsonb_build_object('ok', false, 'error', 'Row not found.');
  end if;

  if v_stat is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Already reviewed.');
  end if;

  update public.promoter_night_adjustments
  set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = trim(coalesce(p_review_notes, '')),
    updated_at = now()
  where id = p_adjustment_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_promoter_night_adjustment(date, boolean, time, time, text) to authenticated;
grant execute on function public.admin_review_night_adjustment(uuid, boolean, text) to authenticated;

-- Normalize a club weekday token to sun..sat (matches TS normalizeClubDayToken).
create or replace function public._club_day_key(raw text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when raw is null or btrim(raw) = '' then null
    else (
      select case v
        when 'sun' then 'sun'
        when 'sunday' then 'sun'
        when 'mon' then 'mon'
        when 'monday' then 'mon'
        when 'tue' then 'tue'
        when 'tues' then 'tue'
        when 'tuesday' then 'tue'
        when 'wed' then 'wed'
        when 'wednesday' then 'wed'
        when 'thu' then 'thu'
        when 'thur' then 'thu'
        when 'thurs' then 'thu'
        when 'thursday' then 'thu'
        when 'fri' then 'fri'
        when 'friday' then 'fri'
        when 'sat' then 'sat'
        when 'saturday' then 'sat'
        else case left(v, 3)
          when 'sun' then 'sun'
          when 'mon' then 'mon'
          when 'tue' then 'tue'
          when 'wed' then 'wed'
          when 'thu' then 'thu'
          when 'fri' then 'fri'
          when 'sat' then 'sat'
          else null
        end
      end
      from (
        select lower(regexp_replace(trim(both from raw), '\.$', '')) as v
      ) s
    )
  end;
$$;

-- True if any normalized weekday in p_weekdays matches PostgreSQL DOW for p_date (0=Sun .. 6=Sat).
create or replace function public._pref_weekdays_include_dow(p_weekdays text[], p_date date)
returns boolean
language sql
stable
parallel safe
as $$
  select exists (
    select 1
    from unnest(coalesce(p_weekdays, '{}'::text[])) as u(tok)
    where public._club_day_key(u.tok) is not null
      and public._club_day_key(u.tok) = (
        (array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])[
          (extract(dow from p_date)::int + 1)
        ]
      )
  );
$$;

-- Guestlist hosts for a calendar night: assigned/completed jobs plus approved club preferences
-- (weekday match) when no job exists for the same promoter+club. Readable by anon for public UI.
drop function if exists public.guestlist_hosts_for_date(date);
create or replace function public.guestlist_hosts_for_date(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with job_rows as (
    select
      pj.id::text as job_id,
      pj.promoter_id,
      coalesce(nullif(trim(both from p.display_name), ''), 'Promoter') as promoter_name,
      pj.club_slug,
      pj.job_date,
      pj.status,
      'job'::text as source
    from public.promoter_jobs pj
    join public.promoters p on p.id = pj.promoter_id
    where pj.job_date = p_date
      and pj.club_slug is not null
      and pj.status in ('assigned', 'completed')
      and p.approval_status = 'approved'
      and coalesce(p.is_approved, false) = true
  ),
  pref_rows as (
    select
      ('pref:' || pcp.promoter_id::text || ':' || pcp.club_slug) as job_id,
      pcp.promoter_id,
      coalesce(nullif(trim(both from p.display_name), ''), 'Promoter') as promoter_name,
      pcp.club_slug,
      p_date as job_date,
      'assigned'::text as status,
      'preference'::text as source
    from public.promoter_club_preferences pcp
    join public.promoters p on p.id = pcp.promoter_id
    where pcp.status = 'approved'
      and pcp.club_slug is not null
      and public._pref_weekdays_include_dow(pcp.weekdays, p_date)
      and p.approval_status = 'approved'
      and coalesce(p.is_approved, false) = true
  ),
  merged as (
    select * from job_rows
    union all
    select pr.*
    from pref_rows pr
    where not exists (
      select 1
      from job_rows j
      where j.promoter_id = pr.promoter_id
        and j.club_slug = pr.club_slug
    )
  )
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'jobId', m.job_id,
          'promoterId', m.promoter_id,
          'promoterName', m.promoter_name,
          'clubSlug', m.club_slug,
          'jobDate', m.job_date,
          'status', m.status,
          'source', m.source
        )
        order by m.club_slug asc, m.promoter_name asc, m.promoter_id asc
      )
      from merged m
    ),
    '[]'::jsonb
  );
$$;

grant execute on function public.guestlist_hosts_for_date(date) to anon, authenticated;
