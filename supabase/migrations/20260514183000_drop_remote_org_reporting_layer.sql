-- Remote-only layer removal (linked CurCC project, inventory 2026-05-14).
-- Objects removed: org multi-tenant tables, reporting chain, finance aggregate views,
-- audit/status triggers, and org-scoped RPCs — not referenced by src/, edge/, supabase/functions/.
--
-- UNDO: full public schema snapshot (including everything below) is in:
--   supabase/rollback/pre-20260514183000_remote_public_schema.sql
-- See supabase/rollback/README.txt
--
-- Shadow DBs (e.g. supabase db pull) replay migrations on an empty database. This file
-- no-ops when public.financial_bookings is missing so DROP TRIGGER ... ON that table does
-- not error (PostgreSQL requires the relation to exist even for DROP TRIGGER IF EXISTS).

DO $migration$
BEGIN
  IF to_regclass('public.financial_bookings') IS NULL THEN
    RAISE NOTICE '20260514183000_drop_remote_org_reporting_layer: skipped (no public.financial_bookings)';
    RETURN;
  END IF;

  -- 1) Triggers
  EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_financial_bookings ON public.financial_bookings';
  EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_financial_promoters ON public.financial_promoters';
  EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_financial_rules ON public.financial_rules';
  EXECUTE 'DROP TRIGGER IF EXISTS trg_financial_booking_status_history ON public.financial_bookings';

  -- 2) Trigger functions
  EXECUTE 'DROP FUNCTION IF EXISTS public.log_booking_status_transition() CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.audit_row_change() CASCADE';

  -- 3) Financial RLS (align with repo supabase/schema.sql)
  EXECUTE 'DROP POLICY IF EXISTS financial_rules_read ON public.financial_rules';
  EXECUTE 'DROP POLICY IF EXISTS financial_rules_write ON public.financial_rules';
  EXECUTE $rls$
CREATE POLICY financial_rules_read ON public.financial_rules FOR SELECT TO authenticated
  USING (public.is_financial_reader())$rls$;
  EXECUTE $rls$
CREATE POLICY financial_rules_write ON public.financial_rules FOR ALL TO authenticated
  USING (public.is_financial_editor()) WITH CHECK (public.is_financial_editor())$rls$;

  EXECUTE 'DROP POLICY IF EXISTS financial_promoters_read ON public.financial_promoters';
  EXECUTE 'DROP POLICY IF EXISTS financial_promoters_write ON public.financial_promoters';
  EXECUTE $rls$
CREATE POLICY financial_promoters_read ON public.financial_promoters FOR SELECT TO authenticated
  USING (public.is_financial_reader())$rls$;
  EXECUTE $rls$
CREATE POLICY financial_promoters_write ON public.financial_promoters FOR ALL TO authenticated
  USING (public.is_financial_editor()) WITH CHECK (public.is_financial_editor())$rls$;

  EXECUTE 'DROP POLICY IF EXISTS financial_cfg_requests_read ON public.financial_config_change_requests';
  EXECUTE 'DROP POLICY IF EXISTS financial_cfg_requests_insert ON public.financial_config_change_requests';
  EXECUTE 'DROP POLICY IF EXISTS financial_cfg_requests_update ON public.financial_config_change_requests';
  EXECUTE $rls$
CREATE POLICY financial_cfg_requests_read ON public.financial_config_change_requests FOR SELECT TO authenticated
  USING (public.is_financial_reader())$rls$;
  EXECUTE $rls$
CREATE POLICY financial_cfg_requests_insert ON public.financial_config_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    (target_type = 'financial_rule' AND public.can_request_financial_rule_change(target_id))
    OR (target_type = 'financial_promoter' AND public.is_financial_editor())
  )$rls$;
  EXECUTE $rls$
CREATE POLICY financial_cfg_requests_update ON public.financial_config_change_requests FOR UPDATE TO authenticated
  USING (public.is_financial_editor()) WITH CHECK (public.is_financial_editor())$rls$;

  EXECUTE 'DROP POLICY IF EXISTS financial_bookings_read ON public.financial_bookings';
  EXECUTE 'DROP POLICY IF EXISTS financial_bookings_write ON public.financial_bookings';
  EXECUTE $rls$
CREATE POLICY financial_bookings_read ON public.financial_bookings FOR SELECT TO authenticated
  USING (public.is_financial_reader())$rls$;
  EXECUTE $rls$
CREATE POLICY financial_bookings_write ON public.financial_bookings FOR ALL TO authenticated
  USING (public.is_financial_reader()) WITH CHECK (public.is_financial_reader())$rls$;

  EXECUTE 'DROP POLICY IF EXISTS financial_booking_nightlife_read ON public.financial_booking_nightlife';
  EXECUTE 'DROP POLICY IF EXISTS financial_booking_nightlife_write ON public.financial_booking_nightlife';
  EXECUTE $rls$
CREATE POLICY financial_booking_nightlife_read ON public.financial_booking_nightlife FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_bookings fb
      WHERE fb.id = financial_booking_nightlife.financial_booking_id
        AND public.is_financial_reader()
    )
  )$rls$;
  EXECUTE $rls$
CREATE POLICY financial_booking_nightlife_write ON public.financial_booking_nightlife FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_bookings fb
      WHERE fb.id = financial_booking_nightlife.financial_booking_id
        AND public.is_financial_reader()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.financial_bookings fb
      WHERE fb.id = financial_booking_nightlife.financial_booking_id
        AND public.is_financial_reader()
    )
  )$rls$;

  EXECUTE 'DROP POLICY IF EXISTS financial_booking_service_read ON public.financial_booking_service';
  EXECUTE 'DROP POLICY IF EXISTS financial_booking_service_write ON public.financial_booking_service';
  EXECUTE $rls$
CREATE POLICY financial_booking_service_read ON public.financial_booking_service FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_bookings fb
      WHERE fb.id = financial_booking_service.financial_booking_id
        AND public.is_financial_reader()
    )
  )$rls$;
  EXECUTE $rls$
CREATE POLICY financial_booking_service_write ON public.financial_booking_service FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_bookings fb
      WHERE fb.id = financial_booking_service.financial_booking_id
        AND public.is_financial_reader()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.financial_bookings fb
      WHERE fb.id = financial_booking_service.financial_booking_id
        AND public.is_financial_reader()
    )
  )$rls$;

  -- 4) Org / reporting RPCs
  EXECUTE 'DROP FUNCTION IF EXISTS public.rpc_promoter_commissions(uuid, date, date, text, text) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.rpc_finance_timeseries(uuid, date, date, text, text) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.rpc_finance_overview(uuid, date, date, text, text) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.rpc_finance_bookings_table(uuid, date, date, text, text) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.rpc_dashboard_org_context() CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.rpc_booking_detail_drawer(uuid) CASCADE';

  EXECUTE 'DROP FUNCTION IF EXISTS public.get_financial_dashboard(uuid, date, date) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_finance_bookings_table(uuid, date, date, text, text) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_finance_timeseries(uuid, date, date, text, text) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_department_breakdown(uuid, date, date) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_near_bonus_bookings(uuid, date, date) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_outstanding_bookings(uuid, date, date) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_promoter_leaderboard(uuid, date, date) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_promoter_payouts(uuid, date, date) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_venue_performance(uuid, date, date) CASCADE';

  EXECUTE 'DROP FUNCTION IF EXISTS public.create_report_run(uuid, text, text, jsonb) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.create_report_schedule(uuid, text, text, text[], jsonb) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.list_report_runs(uuid) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_audit_logs(uuid, text, text) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.record_audit_log(uuid, text, text, text, text, jsonb, text, inet) CASCADE';

  EXECUTE 'DROP FUNCTION IF EXISTS public.current_organisation_ids() CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.can_access_org_role(uuid, text[]) CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.has_organisation_access(uuid, member_role[]) CASCADE';

  -- 5) Views
  EXECUTE 'DROP VIEW IF EXISTS public.vw_department_performance';
  EXECUTE 'DROP VIEW IF EXISTS public.vw_finance_profit_fact';
  EXECUTE 'DROP VIEW IF EXISTS public.vw_near_bonus_alerts';
  EXECUTE 'DROP VIEW IF EXISTS public.vw_promoter_performance';
  EXECUTE 'DROP VIEW IF EXISTS public.vw_service_performance';
  EXECUTE 'DROP VIEW IF EXISTS public.vw_finance_booking_fact';
  EXECUTE 'DROP VIEW IF EXISTS public.booking_financials';

  -- 6) Tables
  EXECUTE 'DROP TABLE IF EXISTS public.report_deliveries CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.report_runs CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.report_schedules CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.report_templates CASCADE';

  EXECUTE 'DROP TABLE IF EXISTS public.audit_logs CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.booking_status_history CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.promoter_commissions CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.promoter_payouts CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.dashboard_layouts CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.saved_views CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.organisation_memberships CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.departments CASCADE';

  -- 7) Detach core tables from organisations
  EXECUTE 'ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_organisation_id_fkey';
  EXECUTE 'ALTER TABLE public.clubs DROP COLUMN IF EXISTS organisation_id';

  EXECUTE 'ALTER TABLE public.financial_bookings DROP CONSTRAINT IF EXISTS financial_bookings_organisation_id_fkey';
  EXECUTE 'ALTER TABLE public.financial_bookings DROP COLUMN IF EXISTS organisation_id';

  EXECUTE 'ALTER TABLE public.financial_config_change_requests DROP CONSTRAINT IF EXISTS financial_config_change_requests_organisation_id_fkey';
  EXECUTE 'ALTER TABLE public.financial_config_change_requests DROP COLUMN IF EXISTS organisation_id';

  EXECUTE 'ALTER TABLE public.financial_promoters DROP CONSTRAINT IF EXISTS financial_promoters_organisation_id_fkey';
  EXECUTE 'ALTER TABLE public.financial_promoters DROP COLUMN IF EXISTS organisation_id';

  EXECUTE 'ALTER TABLE public.financial_rules DROP CONSTRAINT IF EXISTS financial_rules_organisation_id_fkey';
  EXECUTE 'ALTER TABLE public.financial_rules DROP COLUMN IF EXISTS organisation_id';

  -- 8) Root org table + enum
  EXECUTE 'DROP TABLE IF EXISTS public.organisations CASCADE';
  EXECUTE 'DROP TYPE IF EXISTS public.member_role CASCADE';
END
$migration$;
