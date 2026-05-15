-- Move core pricing off financial_rules into financial_club_payment_rates (per-club sheet rows).
-- Bookings reference club_payment_rate_id; promoter_jobs can link to the same rate and optionally to a booking.

create table if not exists public.financial_club_payment_rates (
  id uuid primary key default gen_random_uuid(),
  club_slug text references public.clubs (slug) on delete set null,
  department text not null check (department in ('nightlife', 'transport', 'protection', 'other')),
  venue_or_service_name text not null default '',
  male_rate numeric(12,2) not null default 0,
  female_rate numeric(12,2) not null default 0,
  base_rate numeric(12,2) not null default 0,
  logic_type text not null check (logic_type in ('headcount_pay', 'commission_percent', 'flat_fee')),
  bonus_type text not null default 'none' check (bonus_type in ('flat', 'stacking', 'none')),
  bonus_goal integer not null default 0 check (bonus_goal >= 0),
  bonus_amount numeric(12,2) not null default 0,
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  archived_at timestamptz,
  sheet_extension jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $mig$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'financial_rules'
  ) then
    insert into public.financial_club_payment_rates (
      id,
      club_slug,
      department,
      venue_or_service_name,
      male_rate,
      female_rate,
      base_rate,
      logic_type,
      bonus_type,
      bonus_goal,
      bonus_amount,
      is_active,
      effective_from,
      effective_to,
      archived_at,
      sheet_extension,
      created_at,
      updated_at
    )
    select
      fr.id,
      fr.club_slug,
      fr.department,
      fr.venue_or_service_name,
      fr.male_rate,
      fr.female_rate,
      fr.base_rate,
      fr.logic_type,
      fr.bonus_type,
      fr.bonus_goal,
      fr.bonus_amount,
      fr.is_active,
      fr.effective_from,
      fr.effective_to,
      fr.archived_at,
      coalesce(fr.sheet_extension, '{}'::jsonb),
      fr.created_at,
      fr.updated_at
    from public.financial_rules fr
    on conflict (id) do nothing;
  end if;
end $mig$;

alter table public.financial_bookings add column if not exists club_payment_rate_id uuid;

do $mig$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'financial_bookings' and column_name = 'rule_id'
  ) then
    execute $u$
      update public.financial_bookings b
      set club_payment_rate_id = b.rule_id
      where b.rule_id is not null
        and (b.club_payment_rate_id is null or b.club_payment_rate_id is distinct from b.rule_id)
    $u$;
    execute 'alter table public.financial_bookings drop constraint if exists financial_bookings_rule_id_fkey';
    execute 'alter table public.financial_bookings drop column if exists rule_id';
  end if;
end $mig$;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financial_bookings_club_payment_rate_id_fkey'
  ) then
    alter table public.financial_bookings
      add constraint financial_bookings_club_payment_rate_id_fkey
      foreign key (club_payment_rate_id) references public.financial_club_payment_rates (id) on delete set null;
  end if;
end $mig$;

alter table public.promoter_jobs add column if not exists club_payment_rate_id uuid;

alter table public.promoter_jobs add column if not exists financial_booking_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promoter_jobs_club_payment_rate_id_fkey'
  ) then
    alter table public.promoter_jobs
      add constraint promoter_jobs_club_payment_rate_id_fkey
      foreign key (club_payment_rate_id) references public.financial_club_payment_rates (id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promoter_jobs_financial_booking_id_fkey'
  ) then
    alter table public.promoter_jobs
      add constraint promoter_jobs_financial_booking_id_fkey
      foreign key (financial_booking_id) references public.financial_bookings (id) on delete set null;
  end if;
end $$;

create index if not exists promoter_jobs_club_payment_rate_idx
on public.promoter_jobs (club_payment_rate_id)
where club_payment_rate_id is not null;

create index if not exists promoter_jobs_financial_booking_idx
on public.promoter_jobs (financial_booking_id)
where financial_booking_id is not null;

alter table public.financial_club_payment_rates enable row level security;

drop policy if exists financial_club_payment_rates_read on public.financial_club_payment_rates;
create policy financial_club_payment_rates_read
on public.financial_club_payment_rates
for select
to authenticated
using (public.is_financial_reader());

drop policy if exists financial_club_payment_rates_write on public.financial_club_payment_rates;
create policy financial_club_payment_rates_write
on public.financial_club_payment_rates
for all
to authenticated
using (public.is_financial_editor())
with check (public.is_financial_editor());

create or replace function public.can_request_financial_rule_change(p_target_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_financial_editor()
    or exists (
      select 1
      from public.financial_club_payment_rates r
      join public.club_accounts ca on ca.club_slug = r.club_slug
      where r.id = p_target_id
        and ca.user_id = auth.uid()
        and ca.status = 'active'
        and ca.role in ('owner', 'manager')
    );
$$;

do $mig$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'financial_rules'
  ) then
    execute 'drop policy if exists financial_rules_read on public.financial_rules';
    execute 'drop policy if exists financial_rules_write on public.financial_rules';
    execute 'drop table public.financial_rules';
  end if;
end $mig$;

grant select, insert, update, delete on table public.financial_club_payment_rates to anon;
grant select, insert, update, delete on table public.financial_club_payment_rates to authenticated;
grant select, insert, update, delete on table public.financial_club_payment_rates to service_role;
