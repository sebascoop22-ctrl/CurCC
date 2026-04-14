-- Guest intelligence verification checks.

-- 1) Tables exist.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'guest_profiles',
    'guest_identity_links',
    'guestlist_events',
    'guestlist_signups',
    'guestlist_checkins',
    'guestlist_demographics',
    'campaign_audiences',
    'campaign_audience_members'
  )
order by table_name;

-- 2) Identity dedupe conflicts should be zero.
select identity_type, normalized_value, count(*) as n
from public.guest_identity_links
group by identity_type, normalized_value
having count(*) > 1;

-- 3) Attendance consistency (attended signups without checkin rows).
select s.id as signup_id, s.guestlist_event_id, s.guest_profile_id
from public.guestlist_signups s
left join public.guestlist_checkins c on c.guestlist_signup_id = s.id
where s.status = 'attended'
  and c.id is null
limit 50;

-- 4) Conversion reconciliation by event.
with by_status as (
  select
    guestlist_event_id,
    count(*) as signups,
    count(*) filter (where status = 'attended') as attended
  from public.guestlist_signups
  group by guestlist_event_id
)
select
  e.id as event_id,
  e.club_slug,
  e.event_date,
  b.signups,
  b.attended,
  case when b.signups > 0 then round(b.attended::numeric / b.signups::numeric, 4) else 0 end as conversion
from public.guestlist_events e
left join by_status b on b.guestlist_event_id = e.id
order by e.event_date desc
limit 200;

-- 5) Campaign audience and member counts.
select
  a.id,
  a.name,
  count(m.id) as member_count,
  a.created_at
from public.campaign_audiences a
left join public.campaign_audience_members m on m.audience_id = a.id
group by a.id, a.name, a.created_at
order by a.created_at desc
limit 100;
