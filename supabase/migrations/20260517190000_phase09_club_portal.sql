-- Phase 9: club portal — promoters visible when linked via jobs at the club

drop policy if exists promoters_club_select_via_jobs on public.promoters;

create policy promoters_club_select_via_jobs
on public.promoters
for select
to authenticated
using (
  exists (
    select 1
    from public.promoter_jobs j
    join public.club_accounts ca on ca.club_slug = j.club_slug
    where j.promoter_id = promoters.id
      and ca.user_id = auth.uid()
      and ca.status = 'active'
  )
);
