Rollback for migration: 20260514183000_drop_remote_org_reporting_layer.sql

That migration was applied to the linked remote database on 2026-05-14, then recorded
with: supabase migration repair --status applied 20260514183000 --linked

Other migration versions still exist only on the remote history table; this repo does
not yet contain those SQL files. Use `supabase db pull` or copy them from the team
before relying on `supabase db push` for future changes.

1) Snapshot taken before authoring that migration:
   pre-20260514183000_remote_public_schema.sql
   (full public schema from the linked remote project at that time)

2) To undo on a clean database:
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f pre-20260514183000_remote_public_schema.sql

3) To undo on the same database after the migration ran:
   Prefer restoring from a Supabase backup / PITR, or re-apply the relevant
   sections from the snapshot file (tables, views, functions, triggers, FKs).

4) To create a new snapshot anytime:
   npx supabase db dump --linked -f supabase/rollback/pre-<timestamp>_remote_public_schema.sql -s public

5) supabase db pull / shadow DB: migration 20260514183000 is wrapped so it no-ops when
   public.financial_bookings is missing (empty shadow). Do not use migration repair --status
   reverted on remote versions unless you intend to erase history metadata; it does not
   restore missing local migration SQL files.
