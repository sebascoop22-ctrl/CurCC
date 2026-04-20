-- Quick verification checks for promoter MVP+Finance rollout.

-- Core tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'promoters',
    'promoter_profile_revisions',
    'promoter_availability',
    'promoter_club_preferences',
    'promoter_jobs',
    'promoter_guestlist_entries',
    'promoter_earnings',
    'promoter_invoices',
    'promoter_invoice_lines',
    'promoter_table_sales',
    'financial_payees',
    'financial_recurring_templates',
    'financial_transactions'
  )
order by table_name;

-- Profile role distribution
select role, count(*) as count
from public.profiles
group by role
order by role;

-- Promoter status summary
select approval_status, count(*) as count
from public.promoters
group by approval_status
order by approval_status;

-- Jobs + earnings snapshot
select
  count(*) as jobs_total,
  count(*) filter (where status = 'completed') as jobs_completed,
  coalesce(sum(guests_count), 0) as guests_total
from public.promoter_jobs;

select
  coalesce(sum(amount), 0) as earnings_total
from public.promoter_earnings;

-- Invoice snapshot
select status, count(*) as count, coalesce(sum(total), 0) as gross
from public.promoter_invoices
group by status
order by status;

-- Finance snapshot
select
  coalesce(sum(case when direction = 'income' then amount else 0 end), 0) as income_total,
  coalesce(sum(case when direction = 'expense' then amount else 0 end), 0) as expense_total,
  coalesce(sum(case when direction = 'income' then amount else -amount end), 0) as net_total
from public.financial_transactions;
