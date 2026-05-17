-- Phase 1: V4 venue master — clubs.region / clubs.venue_type + rate sheet_extension shape

alter table public.clubs
  add column if not exists region text;

alter table public.clubs
  add column if not exists venue_type text;

alter table public.clubs
  drop constraint if exists clubs_venue_type_check;

alter table public.clubs
  add constraint clubs_venue_type_check
  check (venue_type is null or venue_type in ('high_end', 'regional_ticket'));

create index if not exists clubs_venue_type_region_idx
  on public.clubs (venue_type, region)
  where venue_type is not null;

comment on column public.clubs.region is 'V4 city/district label (e.g. Mayfair, Oxford).';
comment on column public.clubs.venue_type is 'V4 ops type: high_end (tables+guestlist) or regional_ticket.';

-- Region from catalog payload conventions
update public.clubs c
set region = coalesce(
  nullif(trim(c.payload->>'location_tag'), ''),
  nullif(trim(c.payload->>'locationTag'), ''),
  nullif(trim(c.payload->>'region'), '')
)
where coalesce(trim(c.region), '') = '';

-- Default ops venue type for clubs with active nightlife rate rows
update public.clubs c
set venue_type = 'high_end'
where c.venue_type is null
  and exists (
    select 1
    from public.financial_club_payment_rates r
    where r.club_slug = c.slug
      and r.department = 'nightlife'
      and r.is_active = true
  );

-- Merge V4 keys into existing rate sheet_extension (shallow + guestlist object)
update public.financial_club_payment_rates r
set sheet_extension =
  coalesce(r.sheet_extension, '{}'::jsonb)
  || jsonb_build_object(
    'regionalTickets',
    coalesce(
      r.sheet_extension->'regionalTickets',
      jsonb_build_object(
        'ticketPrice', null,
        'fixedCommissionPerTicket', null,
        'volumeBonusThreshold', null,
        'volumeBonusAmount', null
      )
    ),
    'bonusEligibility', r.sheet_extension->'bonusEligibility'
  )
  || case
    when r.sheet_extension ? 'venueType' then '{}'::jsonb
    else jsonb_build_object(
      'venueType',
      (select to_jsonb(c.venue_type) from public.clubs c where c.slug = r.club_slug limit 1)
    )
  end
  || jsonb_build_object(
    'guestlist',
    coalesce(r.sheet_extension->'guestlist', '{}'::jsonb)
    || jsonb_build_object(
      'paymentModel',
      coalesce(r.sheet_extension->'guestlist'->'paymentModel', 'null'::jsonb)
    )
  );

-- Idempotent demo row: first active nightlife rate gets full guestlist + regionalTickets objects
update public.financial_club_payment_rates r
set sheet_extension = jsonb_set(
  jsonb_set(
    coalesce(r.sheet_extension, '{}'::jsonb),
    '{guestlist}',
    coalesce(r.sheet_extension->'guestlist', '{}'::jsonb) || jsonb_build_object(
      'paymentModel', 'per_guest',
      'standardRatePerGuest', coalesce(r.sheet_extension->'guestlist'->'standardRatePerGuest', to_jsonb(r.base_rate)),
      'maleFemaleRequiredRatio', coalesce(nullif(trim(r.sheet_extension->'guestlist'->>'maleFemaleRequiredRatio'), ''), '2:1')
    ),
    true
  ),
  '{regionalTickets}',
  coalesce(r.sheet_extension->'regionalTickets', '{}'::jsonb) || jsonb_build_object(
    'ticketPrice', coalesce(r.sheet_extension->'regionalTickets'->'ticketPrice', 'null'::jsonb),
    'fixedCommissionPerTicket', coalesce(r.sheet_extension->'regionalTickets'->'fixedCommissionPerTicket', '2'::jsonb)
  ),
  true
)
where r.id = (
  select id
  from public.financial_club_payment_rates
  where department = 'nightlife'
    and is_active = true
  order by created_at asc
  limit 1
);
