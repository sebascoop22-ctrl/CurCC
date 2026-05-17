-- Phase 3: V4 finance, banking, invoice verification

-- financial_bookings ↔ promoter_jobs
alter table public.financial_bookings
  add column if not exists source_job_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financial_bookings_source_job_id_fkey'
  ) then
    alter table public.financial_bookings
      add constraint financial_bookings_source_job_id_fkey
      foreign key (source_job_id) references public.promoter_jobs (id) on delete set null;
  end if;
end $$;

create index if not exists financial_bookings_source_job_idx
  on public.financial_bookings (source_job_id)
  where source_job_id is not null;

update public.financial_bookings fb
set source_job_id = j.id
from public.promoter_jobs j
where j.financial_booking_id = fb.id
  and fb.source_job_id is null;

-- promoter_invoices verification
alter table public.promoter_invoices
  add column if not exists verification_status text not null default 'pending';

alter table public.promoter_invoices
  add column if not exists verification_details jsonb not null default '{}'::jsonb;

alter table public.promoter_invoices
  add column if not exists ledger_total_gbp numeric(12, 2) not null default 0;

alter table public.promoter_invoices
  add column if not exists submitted_total_gbp numeric(12, 2) not null default 0;

alter table public.promoter_invoices
  drop constraint if exists promoter_invoices_verification_status_check;

alter table public.promoter_invoices
  add constraint promoter_invoices_verification_status_check
  check (verification_status in ('pending', 'matched', 'mismatch', 'manual_ok'));

comment on column public.clubs.payment_details is
  'V4 club external banking JSON: method, beneficiaryName, accountNumber, sortCode, iban, swiftBic (BIC), reference, payoutEmail.';

comment on column public.clubs.tax_details is
  'V4 club tax JSON: registeredName, taxId, vatNumber, countryCode (e.g. GB), isVatRegistered, notes.';

comment on column public.financial_bookings.source_job_id is
  'Optional link to promoter_jobs when booking is created from or tied to a job row.';

create or replace function public.job_ledger_amount_gbp(j public.promoter_jobs)
returns numeric
language sql
immutable
as $$
  select round(
    coalesce(j.shift_fee, 0)
    + coalesce(j.guestlist_fee, 0)
      * greatest(
        coalesce(j.guests_entered, 0),
        coalesce(j.guests_count, 0),
        coalesce(j.male_count, 0) + coalesce(j.female_count, 0),
        0
      )::numeric,
    2
  );
$$;

create or replace function public.verify_invoice_against_jobs(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.promoter_invoices%rowtype;
  v_ledger numeric(12, 2) := 0;
  v_submitted numeric(12, 2) := 0;
  v_status text := 'pending';
  v_lines jsonb := '[]'::jsonb;
  r record;
  v_line record;
  r_line record;
  v_expected numeric(12, 2);
  v_billing_guests integer;
  v_has_diff boolean := false;
begin
  if p_invoice_id is null then
    return jsonb_build_object('ok', false, 'error', 'invoice id required');
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;

  select * into v_inv from public.promoter_invoices where id = p_invoice_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invoice not found');
  end if;

  v_submitted := round(coalesce(v_inv.subtotal, 0), 2);

  select coalesce(sum(public.job_ledger_amount_gbp(j)), 0)
  into v_ledger
  from public.promoter_jobs j
  where j.promoter_id = v_inv.promoter_id
    and j.job_date between v_inv.period_start and v_inv.period_end
    and j.status = 'completed';

  for r in
    select
      j.id,
      j.job_date,
      j.job_type,
      j.service,
      j.club_slug,
      j.shift_fee,
      j.guestlist_fee,
      j.guests_count,
      j.guests_entered,
      j.male_count,
      j.female_count,
      j.bonus_valid,
      public.job_ledger_amount_gbp(j) as ledger_amount
    from public.promoter_jobs j
    where j.promoter_id = v_inv.promoter_id
      and j.job_date between v_inv.period_start and v_inv.period_end
      and j.status = 'completed'
    order by j.job_date, j.id
  loop
    v_expected := r.ledger_amount;
    v_billing_guests := greatest(
      coalesce(r.guests_entered, 0),
      coalesce(r.guests_count, 0),
      coalesce(r.male_count, 0) + coalesce(r.female_count, 0)
    );

    select l.*
    into v_line
    from public.promoter_invoice_lines l
    where l.invoice_id = p_invoice_id
      and l.promoter_job_id = r.id
    limit 1;

    if not found then
      v_has_diff := true;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'promoter_job_id', r.id,
          'job_date', r.job_date,
          'field', 'missing_invoice_line',
          'expected', v_expected,
          'actual', null,
          'status', 'mismatch'
        )
      );
      continue;
    end if;

    if abs(coalesce(v_line.line_total, 0) - v_expected) > 0.01 then
      v_has_diff := true;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'promoter_job_id', r.id,
          'job_date', r.job_date,
          'field', 'line_total',
          'expected', v_expected,
          'actual', round(coalesce(v_line.line_total, 0), 2),
          'status', 'mismatch'
        )
      );
    end if;

    if abs(coalesce(v_line.quantity, 0) - v_billing_guests) > 0.01 then
      v_has_diff := true;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'promoter_job_id', r.id,
          'job_date', r.job_date,
          'field', 'guest_count',
          'expected', v_billing_guests,
          'actual', coalesce(v_line.quantity, 0),
          'status', 'mismatch'
        )
      );
    end if;

    if r.bonus_valid = false then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'promoter_job_id', r.id,
          'job_date', r.job_date,
          'field', 'bonus_valid',
          'expected', true,
          'actual', false,
          'status', 'warning'
        )
      );
    end if;
  end loop;

  for r_line in
    select l.*
    from public.promoter_invoice_lines l
    where l.invoice_id = p_invoice_id
      and l.promoter_job_id is not null
      and not exists (
        select 1
        from public.promoter_jobs j
        where j.id = l.promoter_job_id
          and j.promoter_id = v_inv.promoter_id
          and j.job_date between v_inv.period_start and v_inv.period_end
          and j.status = 'completed'
      )
  loop
    v_has_diff := true;
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'promoter_job_id', r_line.promoter_job_id,
        'field', 'orphan_invoice_line',
        'expected', null,
        'actual', round(coalesce(r_line.line_total, 0), 2),
        'status', 'mismatch'
      )
    );
  end loop;

  if v_has_diff or abs(v_ledger - v_submitted) > 0.01 then
    v_status := 'mismatch';
  else
    v_status := 'matched';
  end if;

  update public.promoter_invoices
  set
    verification_status = v_status,
    verification_details = jsonb_build_object(
      'checked_at', now(),
      'period_start', v_inv.period_start,
      'period_end', v_inv.period_end,
      'lines', v_lines
    ),
    ledger_total_gbp = v_ledger,
    submitted_total_gbp = v_submitted
  where id = p_invoice_id;

  return jsonb_build_object(
    'ok', true,
    'invoice_id', p_invoice_id,
    'status', v_status,
    'ledger_total_gbp', v_ledger,
    'submitted_total_gbp', v_submitted,
    'lines', v_lines
  );
end;
$$;

grant execute on function public.verify_invoice_against_jobs(uuid) to authenticated;
