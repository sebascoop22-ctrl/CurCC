-- Optional JSON blobs for spreadsheet-aligned fields (Club financial tracking data.xlsx).
-- Core columns on financial_rules / financial_promoters remain the source for runtime calculations.

alter table public.financial_rules
  add column if not exists sheet_extension jsonb not null default '{}'::jsonb;

alter table public.financial_promoters
  add column if not exists sheet_extension jsonb not null default '{}'::jsonb;
