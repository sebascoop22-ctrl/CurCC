drop extension if exists "pg_net";

create type "public"."bonus_type_v2" as enum ('none', 'flat', 'stacking');

create type "public"."logic_type_v2" as enum ('headcount_pay', 'commission_percent', 'flat_fee');

create type "public"."payment_status_v2" as enum ('expected', 'attended', 'paid_final');


  create table "public"."campaign_audience_members" (
    "id" uuid not null default gen_random_uuid(),
    "audience_id" uuid not null,
    "guest_profile_id" uuid not null,
    "added_at" timestamp with time zone not null default now()
      );


alter table "public"."campaign_audience_members" enable row level security;


  create table "public"."campaign_audiences" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text not null default ''::text,
    "filter_payload" jsonb not null default '{}'::jsonb,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."campaign_audiences" enable row level security;


  create table "public"."cars" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "name" text not null,
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."cars" enable row level security;


  create table "public"."client_attendances" (
    "id" uuid not null default gen_random_uuid(),
    "client_id" uuid not null,
    "event_date" date not null,
    "club_slug" text not null,
    "promoter_id" uuid,
    "spend_gbp" numeric(12,2) not null default 0,
    "source" text not null default 'manual'::text,
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."client_attendances" enable row level security;


  create table "public"."client_guestlist_activity" (
    "id" uuid not null default gen_random_uuid(),
    "client_id" uuid not null,
    "club_slug" text not null,
    "event_date" date not null,
    "promoter_id" uuid,
    "enquiry_id" uuid,
    "guest_profile_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."client_guestlist_activity" enable row level security;


  create table "public"."clients" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "email" text,
    "phone" text,
    "instagram" text,
    "gender" text,
    "referral_code" text,
    "created_at" timestamp with time zone not null default now(),
    "notes" text,
    "guest_profile_id" uuid,
    "typical_spend_gbp" numeric(12,2),
    "preferred_nights" text,
    "preferred_promoter_id" uuid,
    "preferred_club_slug" text
      );


alter table "public"."clients" enable row level security;


  create table "public"."club_accounts" (
    "id" uuid not null default gen_random_uuid(),
    "club_slug" text not null,
    "user_id" uuid,
    "role" text not null default 'owner'::text,
    "status" text not null default 'invited'::text,
    "invite_email" text,
    "invite_code" text,
    "created_by" uuid,
    "approved_by" uuid,
    "approved_at" timestamp with time zone,
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."club_accounts" enable row level security;


  create table "public"."club_edit_revisions" (
    "id" uuid not null default gen_random_uuid(),
    "club_slug" text not null,
    "submitted_by" uuid not null,
    "target_type" text not null,
    "target_id" uuid,
    "payload" jsonb not null default '{}'::jsonb,
    "status" text not null default 'pending'::text,
    "review_notes" text not null default ''::text,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."club_edit_revisions" enable row level security;


  create table "public"."club_weekly_flyers" (
    "id" uuid not null default gen_random_uuid(),
    "club_slug" text not null,
    "event_date" date not null,
    "title" text not null default ''::text,
    "description" text not null default ''::text,
    "image_path" text not null default ''::text,
    "image_url" text not null default ''::text,
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."club_weekly_flyers" enable row level security;


  create table "public"."clubs" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "name" text not null,
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "payment_details" jsonb not null default '{}'::jsonb,
    "tax_details" jsonb not null default '{}'::jsonb
      );


alter table "public"."clubs" enable row level security;


  create table "public"."enquiries" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "submitted_at" timestamp with time zone not null default now(),
    "form_name" text not null,
    "form_label" text not null,
    "service" text not null,
    "status" text not null default 'new'::text,
    "source" text not null default 'website'::text,
    "client_id" uuid,
    "client_key" text,
    "name" text,
    "email" text,
    "phone" text,
    "payload" jsonb not null default '{}'::jsonb
      );


alter table "public"."enquiries" enable row level security;


  create table "public"."enquiry_guests" (
    "id" uuid not null default gen_random_uuid(),
    "enquiry_id" uuid not null,
    "guest_name" text not null,
    "guest_contact" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."enquiry_guests" enable row level security;


  create table "public"."financial_booking_nightlife" (
    "financial_booking_id" uuid not null,
    "male_guests" integer not null default 0,
    "female_guests" integer not null default 0,
    "other_costs" numeric(12,2) not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."financial_booking_nightlife" enable row level security;


  create table "public"."financial_booking_service" (
    "financial_booking_id" uuid not null,
    "total_spend" numeric(12,2) not null default 0,
    "commission_percentage_override" numeric(6,2),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."financial_booking_service" enable row level security;


  create table "public"."financial_bookings" (
    "id" uuid not null default gen_random_uuid(),
    "booking_reference" text not null default ''::text,
    "booking_date" date not null,
    "department" text not null,
    "promoter_id" uuid,
    "client_id" uuid,
    "rule_id" uuid,
    "rule_snapshot_json" jsonb not null default '{}'::jsonb,
    "venue_or_service_name" text not null default ''::text,
    "payment_status" text not null default 'expected'::text,
    "is_archived" boolean not null default false,
    "created_by" uuid,
    "updated_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "club_slug" text,
    "customer_reference" text not null default ''::text,
    "notes" text not null default ''::text
      );


alter table "public"."financial_bookings" enable row level security;


  create table "public"."financial_config_change_requests" (
    "id" uuid not null default gen_random_uuid(),
    "target_type" text not null,
    "target_id" uuid not null,
    "payload" jsonb not null default '{}'::jsonb,
    "requested_by" uuid not null,
    "status" text not null default 'pending'::text,
    "reviewed_by" uuid,
    "review_notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "reviewed_at" timestamp with time zone
      );


alter table "public"."financial_config_change_requests" enable row level security;


  create table "public"."financial_payees" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null default ''::text,
    "default_payment_tag" text not null default ''::text,
    "default_currency" text not null default 'GBP'::text,
    "notes" text not null default ''::text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "payment_details" jsonb not null default '{}'::jsonb,
    "tax_details" jsonb not null default '{}'::jsonb
      );


alter table "public"."financial_payees" enable row level security;


  create table "public"."financial_promoters" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "name" text not null default ''::text,
    "commission_percentage" numeric(6,2) not null default 0,
    "is_active" boolean not null default true,
    "contact" text not null default ''::text,
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "email" text not null default ''::text,
    "phone" text not null default ''::text,
    "contact_details" jsonb not null default '{}'::jsonb
      );


alter table "public"."financial_promoters" enable row level security;


  create table "public"."financial_recurring_templates" (
    "id" uuid not null default gen_random_uuid(),
    "label" text not null default ''::text,
    "category" text not null default ''::text,
    "direction" text not null,
    "amount" numeric(12,2) not null default 0,
    "currency" text not null default 'GBP'::text,
    "notes" text not null default ''::text,
    "interval_days" integer not null,
    "next_due_date" date not null,
    "is_active" boolean not null default true,
    "last_generated_on" date,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "default_status" text not null default 'pending'::text,
    "payment_tag" text not null default ''::text,
    "convert_foreign" boolean not null default false,
    "payee_id" uuid,
    "payee_label" text not null default ''::text,
    "recurrence_unit" text not null default 'monthly'::text,
    "recurrence_every" integer not null default 1
      );


alter table "public"."financial_recurring_templates" enable row level security;


  create table "public"."financial_rules" (
    "id" uuid not null default gen_random_uuid(),
    "department" text not null,
    "venue_or_service_name" text not null default ''::text,
    "male_rate" numeric(12,2) not null default 0,
    "female_rate" numeric(12,2) not null default 0,
    "base_rate" numeric(12,2) not null default 0,
    "logic_type" text not null,
    "bonus_type" text not null default 'none'::text,
    "bonus_goal" integer not null default 0,
    "bonus_amount" numeric(12,2) not null default 0,
    "is_active" boolean not null default true,
    "effective_from" date not null default CURRENT_DATE,
    "effective_to" date,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "club_slug" text,
    "commission_rate" numeric(10,6) not null default 0
      );


alter table "public"."financial_rules" enable row level security;


  create table "public"."financial_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "tx_date" date not null,
    "category" text not null default ''::text,
    "direction" text not null,
    "amount" numeric(12,2) not null default 0,
    "currency" text not null default 'GBP'::text,
    "source_type" text not null default 'manual'::text,
    "source_ref" uuid,
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "status" text not null default 'pending'::text,
    "payment_tag" text not null default ''::text,
    "convert_foreign" boolean not null default false,
    "payee_id" uuid,
    "payee_label" text not null default ''::text
      );


alter table "public"."financial_transactions" enable row level security;


  create table "public"."guest_identity_links" (
    "id" uuid not null default gen_random_uuid(),
    "guest_profile_id" uuid not null,
    "identity_type" text not null,
    "identity_value" text not null,
    "normalized_value" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."guest_identity_links" enable row level security;


  create table "public"."guest_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "full_name" text not null default ''::text,
    "primary_phone" text,
    "primary_email" text,
    "primary_instagram" text,
    "age" smallint,
    "gender" text,
    "first_seen_at" timestamp with time zone not null default now(),
    "last_seen_at" timestamp with time zone not null default now(),
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."guest_profiles" enable row level security;


  create table "public"."guestlist_checkins" (
    "id" uuid not null default gen_random_uuid(),
    "guestlist_signup_id" uuid not null,
    "checked_in_at" timestamp with time zone not null default now(),
    "checkin_source" text not null,
    "checked_in_by" uuid,
    "notes" text not null default ''::text
      );


alter table "public"."guestlist_checkins" enable row level security;


  create table "public"."guestlist_demographics" (
    "id" uuid not null default gen_random_uuid(),
    "guest_profile_id" uuid not null,
    "guestlist_event_id" uuid,
    "age" smallint,
    "gender" text,
    "source" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."guestlist_demographics" enable row level security;


  create table "public"."guestlist_events" (
    "id" uuid not null default gen_random_uuid(),
    "club_slug" text not null,
    "event_date" date not null,
    "promoter_id" uuid,
    "capacity" integer not null default 0,
    "status" text not null default 'open'::text,
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."guestlist_events" enable row level security;


  create table "public"."guestlist_signups" (
    "id" uuid not null default gen_random_uuid(),
    "guestlist_event_id" uuid not null,
    "guest_profile_id" uuid not null,
    "source" text not null default 'website'::text,
    "signup_at" timestamp with time zone not null default now(),
    "status" text not null default 'signed_up'::text,
    "created_by" uuid,
    "metadata" jsonb not null default '{}'::jsonb
      );


alter table "public"."guestlist_signups" enable row level security;


  create table "public"."job_disputes" (
    "id" uuid not null default gen_random_uuid(),
    "club_slug" text not null,
    "promoter_job_id" uuid,
    "promoter_table_sale_id" uuid,
    "promoter_guestlist_entry_id" uuid,
    "raised_by_user_id" uuid not null,
    "raised_by_role" text not null default 'club'::text,
    "reason_code" text not null default 'other'::text,
    "description" text not null default ''::text,
    "evidence" jsonb not null default '{}'::jsonb,
    "status" text not null default 'open'::text,
    "resolution_notes" text not null default ''::text,
    "resolved_by" uuid,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."job_disputes" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "role" text not null default 'host'::text,
    "display_name" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."promoter_availability" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "weekday" smallint not null,
    "is_available" boolean not null default true,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."promoter_availability" enable row level security;


  create table "public"."promoter_club_preferences" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "club_slug" text not null,
    "weekdays" text[] not null default '{}'::text[],
    "notes" text not null default ''::text,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."promoter_club_preferences" enable row level security;


  create table "public"."promoter_earnings" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "promoter_job_id" uuid,
    "earning_date" date not null,
    "source" text not null default 'job'::text,
    "amount" numeric(12,2) not null default 0,
    "currency" text not null default 'GBP'::text,
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."promoter_earnings" enable row level security;


  create table "public"."promoter_guestlist_entries" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_job_id" uuid not null,
    "guest_name" text not null default ''::text,
    "guest_contact" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "approval_status" text not null default 'pending'::text,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid,
    "review_notes" text not null default ''::text
      );


alter table "public"."promoter_guestlist_entries" enable row level security;


  create table "public"."promoter_invoice_lines" (
    "id" uuid not null default gen_random_uuid(),
    "invoice_id" uuid not null,
    "promoter_job_id" uuid,
    "line_type" text not null default 'job'::text,
    "description" text not null default ''::text,
    "quantity" numeric(12,2) not null default 1,
    "unit_amount" numeric(12,2) not null default 0,
    "line_total" numeric(12,2) not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."promoter_invoice_lines" enable row level security;


  create table "public"."promoter_invoices" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "period_start" date not null,
    "period_end" date not null,
    "status" text not null default 'draft'::text,
    "subtotal" numeric(12,2) not null default 0,
    "adjustments" numeric(12,2) not null default 0,
    "total" numeric(12,2) not null default 0,
    "generated_at" timestamp with time zone not null default now(),
    "finalized_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "sent_to_email" text not null default ''::text,
    "emailed_via" text not null default ''::text
      );


alter table "public"."promoter_invoices" enable row level security;


  create table "public"."promoter_jobs" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "club_slug" text,
    "service" text not null default 'guestlist'::text,
    "job_date" date not null,
    "status" text not null default 'assigned'::text,
    "guests_count" integer not null default 0,
    "shift_fee" numeric(12,2) not null default 0,
    "guestlist_fee" numeric(12,2) not null default 0,
    "notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "client_name" text not null default ''::text,
    "client_contact" text not null default ''::text
      );


alter table "public"."promoter_jobs" enable row level security;


  create table "public"."promoter_night_adjustments" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "night_date" date not null,
    "available_override" boolean not null,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "notes" text not null default ''::text,
    "status" text not null default 'pending'::text,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid,
    "review_notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."promoter_night_adjustments" enable row level security;


  create table "public"."promoter_profile_revisions" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "payload" jsonb not null default '{}'::jsonb,
    "status" text not null default 'pending'::text,
    "reviewer_id" uuid,
    "review_notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "reviewed_at" timestamp with time zone
      );


alter table "public"."promoter_profile_revisions" enable row level security;


  create table "public"."promoter_signup_requests" (
    "id" uuid not null default gen_random_uuid(),
    "full_name" text not null,
    "email" text not null,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default now(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid,
    "denial_reason" text,
    "auth_user_id" uuid
      );


alter table "public"."promoter_signup_requests" enable row level security;


  create table "public"."promoter_table_sales" (
    "id" uuid not null default gen_random_uuid(),
    "promoter_id" uuid not null,
    "club_slug" text not null,
    "sale_date" date not null,
    "promoter_job_id" uuid,
    "entry_channel" text not null,
    "tier" text not null default 'other'::text,
    "table_count" integer not null default 1,
    "total_min_spend" numeric(12,2) not null default 0,
    "notes" text not null default ''::text,
    "approval_status" text not null default 'pending'::text,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid,
    "review_notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."promoter_table_sales" enable row level security;


  create table "public"."promoters" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "display_name" text not null default ''::text,
    "bio" text not null default ''::text,
    "profile_image_url" text not null default ''::text,
    "is_approved" boolean not null default false,
    "approval_status" text not null default 'pending'::text,
    "approval_notes" text not null default ''::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "profile_image_urls" jsonb not null default '[]'::jsonb,
    "portfolio_club_slugs" text[] not null default '{}'::text[],
    "payment_details" jsonb not null default '{}'::jsonb,
    "tax_details" jsonb not null default '{}'::jsonb
      );


alter table "public"."promoters" enable row level security;

CREATE UNIQUE INDEX campaign_audience_members_audience_id_guest_profile_id_key ON public.campaign_audience_members USING btree (audience_id, guest_profile_id);

CREATE UNIQUE INDEX campaign_audience_members_pkey ON public.campaign_audience_members USING btree (id);

CREATE UNIQUE INDEX campaign_audiences_pkey ON public.campaign_audiences USING btree (id);

CREATE UNIQUE INDEX cars_pkey ON public.cars USING btree (id);

CREATE UNIQUE INDEX cars_slug_key ON public.cars USING btree (slug);

CREATE INDEX cars_sort_idx ON public.cars USING btree (sort_order, name);

CREATE INDEX client_attendances_client_date_idx ON public.client_attendances USING btree (client_id, event_date DESC);

CREATE INDEX client_attendances_club_date_idx ON public.client_attendances USING btree (club_slug, event_date DESC);

CREATE UNIQUE INDEX client_attendances_pkey ON public.client_attendances USING btree (id);

CREATE INDEX client_guestlist_activity_client_idx ON public.client_guestlist_activity USING btree (client_id, event_date DESC);

CREATE UNIQUE INDEX client_guestlist_activity_pkey ON public.client_guestlist_activity USING btree (id);

CREATE UNIQUE INDEX client_guestlist_activity_uniq ON public.client_guestlist_activity USING btree (client_id, club_slug, event_date);

CREATE INDEX clients_email_idx ON public.clients USING btree (lower(email));

CREATE INDEX clients_guest_profile_id_idx ON public.clients USING btree (guest_profile_id) WHERE (guest_profile_id IS NOT NULL);

CREATE INDEX clients_guest_profile_idx ON public.clients USING btree (guest_profile_id);

CREATE INDEX clients_phone_idx ON public.clients USING btree (phone);

CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);

CREATE INDEX clients_preferred_club_idx ON public.clients USING btree (preferred_club_slug);

CREATE INDEX clients_preferred_promoter_idx ON public.clients USING btree (preferred_promoter_id) WHERE (preferred_promoter_id IS NOT NULL);

CREATE INDEX club_accounts_club_slug_idx ON public.club_accounts USING btree (club_slug, status);

CREATE UNIQUE INDEX club_accounts_club_slug_user_id_key ON public.club_accounts USING btree (club_slug, user_id);

CREATE INDEX club_accounts_invite_code_idx ON public.club_accounts USING btree (invite_code);

CREATE UNIQUE INDEX club_accounts_invite_code_key ON public.club_accounts USING btree (invite_code);

CREATE UNIQUE INDEX club_accounts_pkey ON public.club_accounts USING btree (id);

CREATE INDEX club_accounts_user_idx ON public.club_accounts USING btree (user_id, status);

CREATE UNIQUE INDEX club_edit_revisions_pkey ON public.club_edit_revisions USING btree (id);

CREATE INDEX club_edit_revisions_slug_idx ON public.club_edit_revisions USING btree (club_slug, status, created_at DESC);

CREATE INDEX club_weekly_flyers_date_idx ON public.club_weekly_flyers USING btree (event_date);

CREATE UNIQUE INDEX club_weekly_flyers_pkey ON public.club_weekly_flyers USING btree (id);

CREATE INDEX club_weekly_flyers_slug_date_idx ON public.club_weekly_flyers USING btree (club_slug, event_date, sort_order);

CREATE UNIQUE INDEX clubs_pkey ON public.clubs USING btree (id);

CREATE UNIQUE INDEX clubs_slug_key ON public.clubs USING btree (slug);

CREATE INDEX clubs_sort_idx ON public.clubs USING btree (sort_order, name);

CREATE INDEX enquiries_client_id_idx ON public.enquiries USING btree (client_id);

CREATE INDEX enquiries_client_key_idx ON public.enquiries USING btree (client_key);

CREATE INDEX enquiries_created_at_idx ON public.enquiries USING btree (created_at DESC);

CREATE UNIQUE INDEX enquiries_pkey ON public.enquiries USING btree (id);

CREATE INDEX enquiries_service_status_idx ON public.enquiries USING btree (service, status);

CREATE INDEX enquiry_guests_enquiry_id_idx ON public.enquiry_guests USING btree (enquiry_id);

CREATE UNIQUE INDEX enquiry_guests_pkey ON public.enquiry_guests USING btree (id);

CREATE UNIQUE INDEX financial_booking_nightlife_pkey ON public.financial_booking_nightlife USING btree (financial_booking_id);

CREATE UNIQUE INDEX financial_booking_service_pkey ON public.financial_booking_service USING btree (financial_booking_id);

CREATE UNIQUE INDEX financial_bookings_pkey ON public.financial_bookings USING btree (id);

CREATE UNIQUE INDEX financial_bookings_reference_idx ON public.financial_bookings USING btree (booking_reference);

CREATE UNIQUE INDEX financial_config_change_requests_pkey ON public.financial_config_change_requests USING btree (id);

CREATE INDEX financial_payees_name_idx ON public.financial_payees USING btree (name);

CREATE UNIQUE INDEX financial_payees_pkey ON public.financial_payees USING btree (id);

CREATE UNIQUE INDEX financial_promoters_pkey ON public.financial_promoters USING btree (id);

CREATE UNIQUE INDEX financial_promoters_user_id_uidx ON public.financial_promoters USING btree (user_id) WHERE (user_id IS NOT NULL);

CREATE INDEX financial_recurring_templates_due_idx ON public.financial_recurring_templates USING btree (next_due_date) WHERE (is_active = true);

CREATE UNIQUE INDEX financial_recurring_templates_pkey ON public.financial_recurring_templates USING btree (id);

CREATE UNIQUE INDEX financial_rules_pkey ON public.financial_rules USING btree (id);

CREATE INDEX financial_transactions_payee_idx ON public.financial_transactions USING btree (payee_id, tx_date DESC);

CREATE INDEX financial_transactions_period_idx ON public.financial_transactions USING btree (tx_date DESC, direction);

CREATE UNIQUE INDEX financial_transactions_pkey ON public.financial_transactions USING btree (id);

CREATE INDEX financial_transactions_status_idx ON public.financial_transactions USING btree (status, tx_date DESC);

CREATE INDEX financial_transactions_tag_idx ON public.financial_transactions USING btree (payment_tag, tx_date DESC);

CREATE UNIQUE INDEX guest_identity_links_identity_type_normalized_value_key ON public.guest_identity_links USING btree (identity_type, normalized_value);

CREATE UNIQUE INDEX guest_identity_links_pkey ON public.guest_identity_links USING btree (id);

CREATE INDEX guest_identity_lookup_idx ON public.guest_identity_links USING btree (identity_type, normalized_value);

CREATE UNIQUE INDEX guest_profiles_pkey ON public.guest_profiles USING btree (id);

CREATE INDEX guest_profiles_seen_idx ON public.guest_profiles USING btree (last_seen_at DESC);

CREATE UNIQUE INDEX guestlist_checkins_pkey ON public.guestlist_checkins USING btree (id);

CREATE INDEX guestlist_checkins_signup_idx ON public.guestlist_checkins USING btree (guestlist_signup_id, checked_in_at DESC);

CREATE INDEX guestlist_demographics_guest_idx ON public.guestlist_demographics USING btree (guest_profile_id, created_at DESC);

CREATE UNIQUE INDEX guestlist_demographics_pkey ON public.guestlist_demographics USING btree (id);

CREATE UNIQUE INDEX guestlist_events_club_slug_event_date_promoter_id_key ON public.guestlist_events USING btree (club_slug, event_date, promoter_id);

CREATE INDEX guestlist_events_date_idx ON public.guestlist_events USING btree (event_date DESC, club_slug);

CREATE UNIQUE INDEX guestlist_events_pkey ON public.guestlist_events USING btree (id);

CREATE INDEX guestlist_signups_event_idx ON public.guestlist_signups USING btree (guestlist_event_id, status);

CREATE INDEX guestlist_signups_guest_idx ON public.guestlist_signups USING btree (guest_profile_id, signup_at DESC);

CREATE UNIQUE INDEX guestlist_signups_guestlist_event_id_guest_profile_id_key ON public.guestlist_signups USING btree (guestlist_event_id, guest_profile_id);

CREATE UNIQUE INDEX guestlist_signups_pkey ON public.guestlist_signups USING btree (id);

CREATE INDEX job_disputes_club_status_idx ON public.job_disputes USING btree (club_slug, status, created_at DESC);

CREATE UNIQUE INDEX job_disputes_pkey ON public.job_disputes USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX promoter_availability_pkey ON public.promoter_availability USING btree (id);

CREATE UNIQUE INDEX promoter_availability_promoter_id_weekday_key ON public.promoter_availability USING btree (promoter_id, weekday);

CREATE UNIQUE INDEX promoter_club_preferences_pkey ON public.promoter_club_preferences USING btree (id);

CREATE UNIQUE INDEX promoter_club_preferences_promoter_id_club_slug_key ON public.promoter_club_preferences USING btree (promoter_id, club_slug);

CREATE UNIQUE INDEX promoter_earnings_pkey ON public.promoter_earnings USING btree (id);

CREATE INDEX promoter_earnings_promoter_date_idx ON public.promoter_earnings USING btree (promoter_id, earning_date DESC);

CREATE INDEX promoter_guestlist_entries_pending_idx ON public.promoter_guestlist_entries USING btree (created_at DESC) WHERE (approval_status = 'pending'::text);

CREATE UNIQUE INDEX promoter_guestlist_entries_pkey ON public.promoter_guestlist_entries USING btree (id);

CREATE UNIQUE INDEX promoter_invoice_lines_pkey ON public.promoter_invoice_lines USING btree (id);

CREATE UNIQUE INDEX promoter_invoices_pkey ON public.promoter_invoices USING btree (id);

CREATE INDEX promoter_invoices_promoter_period_idx ON public.promoter_invoices USING btree (promoter_id, period_start, period_end);

CREATE UNIQUE INDEX promoter_jobs_pkey ON public.promoter_jobs USING btree (id);

CREATE INDEX promoter_jobs_promoter_date_idx ON public.promoter_jobs USING btree (promoter_id, job_date DESC);

CREATE INDEX promoter_night_adj_pending_idx ON public.promoter_night_adjustments USING btree (created_at DESC) WHERE (status = 'pending'::text);

CREATE INDEX promoter_night_adj_promoter_date_idx ON public.promoter_night_adjustments USING btree (promoter_id, night_date DESC);

CREATE UNIQUE INDEX promoter_night_adjustments_pkey ON public.promoter_night_adjustments USING btree (id);

CREATE UNIQUE INDEX promoter_night_adjustments_promoter_id_night_date_key ON public.promoter_night_adjustments USING btree (promoter_id, night_date);

CREATE UNIQUE INDEX promoter_profile_revisions_pkey ON public.promoter_profile_revisions USING btree (id);

CREATE INDEX promoter_profile_revisions_promoter_idx ON public.promoter_profile_revisions USING btree (promoter_id, status);

CREATE UNIQUE INDEX promoter_signup_requests_pkey ON public.promoter_signup_requests USING btree (id);

CREATE INDEX promoter_signup_requests_status_created_idx ON public.promoter_signup_requests USING btree (status, created_at DESC);

CREATE INDEX promoter_table_sales_date_idx ON public.promoter_table_sales USING btree (sale_date DESC);

CREATE INDEX promoter_table_sales_pending_idx ON public.promoter_table_sales USING btree (created_at DESC) WHERE (approval_status = 'pending'::text);

CREATE UNIQUE INDEX promoter_table_sales_pkey ON public.promoter_table_sales USING btree (id);

CREATE INDEX promoter_table_sales_promoter_date_idx ON public.promoter_table_sales USING btree (promoter_id, sale_date DESC);

CREATE UNIQUE INDEX promoters_pkey ON public.promoters USING btree (id);

CREATE UNIQUE INDEX promoters_user_id_key ON public.promoters USING btree (user_id);

CREATE INDEX promoters_user_idx ON public.promoters USING btree (user_id);

alter table "public"."campaign_audience_members" add constraint "campaign_audience_members_pkey" PRIMARY KEY using index "campaign_audience_members_pkey";

alter table "public"."campaign_audiences" add constraint "campaign_audiences_pkey" PRIMARY KEY using index "campaign_audiences_pkey";

alter table "public"."cars" add constraint "cars_pkey" PRIMARY KEY using index "cars_pkey";

alter table "public"."client_attendances" add constraint "client_attendances_pkey" PRIMARY KEY using index "client_attendances_pkey";

alter table "public"."client_guestlist_activity" add constraint "client_guestlist_activity_pkey" PRIMARY KEY using index "client_guestlist_activity_pkey";

alter table "public"."clients" add constraint "clients_pkey" PRIMARY KEY using index "clients_pkey";

alter table "public"."club_accounts" add constraint "club_accounts_pkey" PRIMARY KEY using index "club_accounts_pkey";

alter table "public"."club_edit_revisions" add constraint "club_edit_revisions_pkey" PRIMARY KEY using index "club_edit_revisions_pkey";

alter table "public"."club_weekly_flyers" add constraint "club_weekly_flyers_pkey" PRIMARY KEY using index "club_weekly_flyers_pkey";

alter table "public"."clubs" add constraint "clubs_pkey" PRIMARY KEY using index "clubs_pkey";

alter table "public"."enquiries" add constraint "enquiries_pkey" PRIMARY KEY using index "enquiries_pkey";

alter table "public"."enquiry_guests" add constraint "enquiry_guests_pkey" PRIMARY KEY using index "enquiry_guests_pkey";

alter table "public"."financial_booking_nightlife" add constraint "financial_booking_nightlife_pkey" PRIMARY KEY using index "financial_booking_nightlife_pkey";

alter table "public"."financial_booking_service" add constraint "financial_booking_service_pkey" PRIMARY KEY using index "financial_booking_service_pkey";

alter table "public"."financial_bookings" add constraint "financial_bookings_pkey" PRIMARY KEY using index "financial_bookings_pkey";

alter table "public"."financial_config_change_requests" add constraint "financial_config_change_requests_pkey" PRIMARY KEY using index "financial_config_change_requests_pkey";

alter table "public"."financial_payees" add constraint "financial_payees_pkey" PRIMARY KEY using index "financial_payees_pkey";

alter table "public"."financial_promoters" add constraint "financial_promoters_pkey" PRIMARY KEY using index "financial_promoters_pkey";

alter table "public"."financial_recurring_templates" add constraint "financial_recurring_templates_pkey" PRIMARY KEY using index "financial_recurring_templates_pkey";

alter table "public"."financial_rules" add constraint "financial_rules_pkey" PRIMARY KEY using index "financial_rules_pkey";

alter table "public"."financial_transactions" add constraint "financial_transactions_pkey" PRIMARY KEY using index "financial_transactions_pkey";

alter table "public"."guest_identity_links" add constraint "guest_identity_links_pkey" PRIMARY KEY using index "guest_identity_links_pkey";

alter table "public"."guest_profiles" add constraint "guest_profiles_pkey" PRIMARY KEY using index "guest_profiles_pkey";

alter table "public"."guestlist_checkins" add constraint "guestlist_checkins_pkey" PRIMARY KEY using index "guestlist_checkins_pkey";

alter table "public"."guestlist_demographics" add constraint "guestlist_demographics_pkey" PRIMARY KEY using index "guestlist_demographics_pkey";

alter table "public"."guestlist_events" add constraint "guestlist_events_pkey" PRIMARY KEY using index "guestlist_events_pkey";

alter table "public"."guestlist_signups" add constraint "guestlist_signups_pkey" PRIMARY KEY using index "guestlist_signups_pkey";

alter table "public"."job_disputes" add constraint "job_disputes_pkey" PRIMARY KEY using index "job_disputes_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."promoter_availability" add constraint "promoter_availability_pkey" PRIMARY KEY using index "promoter_availability_pkey";

alter table "public"."promoter_club_preferences" add constraint "promoter_club_preferences_pkey" PRIMARY KEY using index "promoter_club_preferences_pkey";

alter table "public"."promoter_earnings" add constraint "promoter_earnings_pkey" PRIMARY KEY using index "promoter_earnings_pkey";

alter table "public"."promoter_guestlist_entries" add constraint "promoter_guestlist_entries_pkey" PRIMARY KEY using index "promoter_guestlist_entries_pkey";

alter table "public"."promoter_invoice_lines" add constraint "promoter_invoice_lines_pkey" PRIMARY KEY using index "promoter_invoice_lines_pkey";

alter table "public"."promoter_invoices" add constraint "promoter_invoices_pkey" PRIMARY KEY using index "promoter_invoices_pkey";

alter table "public"."promoter_jobs" add constraint "promoter_jobs_pkey" PRIMARY KEY using index "promoter_jobs_pkey";

alter table "public"."promoter_night_adjustments" add constraint "promoter_night_adjustments_pkey" PRIMARY KEY using index "promoter_night_adjustments_pkey";

alter table "public"."promoter_profile_revisions" add constraint "promoter_profile_revisions_pkey" PRIMARY KEY using index "promoter_profile_revisions_pkey";

alter table "public"."promoter_signup_requests" add constraint "promoter_signup_requests_pkey" PRIMARY KEY using index "promoter_signup_requests_pkey";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_pkey" PRIMARY KEY using index "promoter_table_sales_pkey";

alter table "public"."promoters" add constraint "promoters_pkey" PRIMARY KEY using index "promoters_pkey";

alter table "public"."campaign_audience_members" add constraint "campaign_audience_members_audience_id_fkey" FOREIGN KEY (audience_id) REFERENCES public.campaign_audiences(id) ON DELETE CASCADE not valid;

alter table "public"."campaign_audience_members" validate constraint "campaign_audience_members_audience_id_fkey";

alter table "public"."campaign_audience_members" add constraint "campaign_audience_members_audience_id_guest_profile_id_key" UNIQUE using index "campaign_audience_members_audience_id_guest_profile_id_key";

alter table "public"."campaign_audience_members" add constraint "campaign_audience_members_guest_profile_id_fkey" FOREIGN KEY (guest_profile_id) REFERENCES public.guest_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."campaign_audience_members" validate constraint "campaign_audience_members_guest_profile_id_fkey";

alter table "public"."campaign_audiences" add constraint "campaign_audiences_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."campaign_audiences" validate constraint "campaign_audiences_created_by_fkey";

alter table "public"."cars" add constraint "cars_slug_key" UNIQUE using index "cars_slug_key";

alter table "public"."client_attendances" add constraint "client_attendances_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE not valid;

alter table "public"."client_attendances" validate constraint "client_attendances_client_id_fkey";

alter table "public"."client_attendances" add constraint "client_attendances_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE RESTRICT not valid;

alter table "public"."client_attendances" validate constraint "client_attendances_club_slug_fkey";

alter table "public"."client_attendances" add constraint "client_attendances_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE SET NULL not valid;

alter table "public"."client_attendances" validate constraint "client_attendances_promoter_id_fkey";

alter table "public"."client_attendances" add constraint "client_attendances_spend_gbp_check" CHECK ((spend_gbp >= (0)::numeric)) not valid;

alter table "public"."client_attendances" validate constraint "client_attendances_spend_gbp_check";

alter table "public"."client_guestlist_activity" add constraint "client_guestlist_activity_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE not valid;

alter table "public"."client_guestlist_activity" validate constraint "client_guestlist_activity_client_id_fkey";

alter table "public"."client_guestlist_activity" add constraint "client_guestlist_activity_enquiry_id_fkey" FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id) ON DELETE SET NULL not valid;

alter table "public"."client_guestlist_activity" validate constraint "client_guestlist_activity_enquiry_id_fkey";

alter table "public"."client_guestlist_activity" add constraint "client_guestlist_activity_guest_profile_id_fkey" FOREIGN KEY (guest_profile_id) REFERENCES public.guest_profiles(id) ON DELETE SET NULL not valid;

alter table "public"."client_guestlist_activity" validate constraint "client_guestlist_activity_guest_profile_id_fkey";

alter table "public"."client_guestlist_activity" add constraint "client_guestlist_activity_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE SET NULL not valid;

alter table "public"."client_guestlist_activity" validate constraint "client_guestlist_activity_promoter_id_fkey";

alter table "public"."client_guestlist_activity" add constraint "client_guestlist_activity_uniq" UNIQUE using index "client_guestlist_activity_uniq";

alter table "public"."clients" add constraint "clients_guest_profile_id_fkey" FOREIGN KEY (guest_profile_id) REFERENCES public.guest_profiles(id) ON DELETE SET NULL not valid;

alter table "public"."clients" validate constraint "clients_guest_profile_id_fkey";

alter table "public"."clients" add constraint "clients_preferred_club_slug_fkey" FOREIGN KEY (preferred_club_slug) REFERENCES public.clubs(slug) ON DELETE SET NULL not valid;

alter table "public"."clients" validate constraint "clients_preferred_club_slug_fkey";

alter table "public"."clients" add constraint "clients_preferred_promoter_id_fkey" FOREIGN KEY (preferred_promoter_id) REFERENCES public.promoters(id) ON DELETE SET NULL not valid;

alter table "public"."clients" validate constraint "clients_preferred_promoter_id_fkey";

alter table "public"."club_accounts" add constraint "club_accounts_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."club_accounts" validate constraint "club_accounts_approved_by_fkey";

alter table "public"."club_accounts" add constraint "club_accounts_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE CASCADE not valid;

alter table "public"."club_accounts" validate constraint "club_accounts_club_slug_fkey";

alter table "public"."club_accounts" add constraint "club_accounts_club_slug_user_id_key" UNIQUE using index "club_accounts_club_slug_user_id_key";

alter table "public"."club_accounts" add constraint "club_accounts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."club_accounts" validate constraint "club_accounts_created_by_fkey";

alter table "public"."club_accounts" add constraint "club_accounts_invite_code_key" UNIQUE using index "club_accounts_invite_code_key";

alter table "public"."club_accounts" add constraint "club_accounts_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'editor'::text]))) not valid;

alter table "public"."club_accounts" validate constraint "club_accounts_role_check";

alter table "public"."club_accounts" add constraint "club_accounts_status_check" CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'revoked'::text]))) not valid;

alter table "public"."club_accounts" validate constraint "club_accounts_status_check";

alter table "public"."club_accounts" add constraint "club_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."club_accounts" validate constraint "club_accounts_user_id_fkey";

alter table "public"."club_edit_revisions" add constraint "club_edit_revisions_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE CASCADE not valid;

alter table "public"."club_edit_revisions" validate constraint "club_edit_revisions_club_slug_fkey";

alter table "public"."club_edit_revisions" add constraint "club_edit_revisions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."club_edit_revisions" validate constraint "club_edit_revisions_reviewed_by_fkey";

alter table "public"."club_edit_revisions" add constraint "club_edit_revisions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."club_edit_revisions" validate constraint "club_edit_revisions_status_check";

alter table "public"."club_edit_revisions" add constraint "club_edit_revisions_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."club_edit_revisions" validate constraint "club_edit_revisions_submitted_by_fkey";

alter table "public"."club_edit_revisions" add constraint "club_edit_revisions_target_type_check" CHECK ((target_type = ANY (ARRAY['club_payload'::text, 'flyer'::text, 'media'::text]))) not valid;

alter table "public"."club_edit_revisions" validate constraint "club_edit_revisions_target_type_check";

alter table "public"."club_weekly_flyers" add constraint "club_weekly_flyers_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE CASCADE not valid;

alter table "public"."club_weekly_flyers" validate constraint "club_weekly_flyers_club_slug_fkey";

alter table "public"."clubs" add constraint "clubs_slug_key" UNIQUE using index "clubs_slug_key";

alter table "public"."enquiries" add constraint "enquiries_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."enquiries" validate constraint "enquiries_client_id_fkey";

alter table "public"."enquiry_guests" add constraint "enquiry_guests_enquiry_id_fkey" FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id) ON DELETE CASCADE not valid;

alter table "public"."enquiry_guests" validate constraint "enquiry_guests_enquiry_id_fkey";

alter table "public"."financial_booking_nightlife" add constraint "financial_booking_nightlife_female_guests_check" CHECK ((female_guests >= 0)) not valid;

alter table "public"."financial_booking_nightlife" validate constraint "financial_booking_nightlife_female_guests_check";

alter table "public"."financial_booking_nightlife" add constraint "financial_booking_nightlife_financial_booking_id_fkey" FOREIGN KEY (financial_booking_id) REFERENCES public.financial_bookings(id) ON DELETE CASCADE not valid;

alter table "public"."financial_booking_nightlife" validate constraint "financial_booking_nightlife_financial_booking_id_fkey";

alter table "public"."financial_booking_nightlife" add constraint "financial_booking_nightlife_male_guests_check" CHECK ((male_guests >= 0)) not valid;

alter table "public"."financial_booking_nightlife" validate constraint "financial_booking_nightlife_male_guests_check";

alter table "public"."financial_booking_service" add constraint "financial_booking_service_commission_percentage_override_check" CHECK (((commission_percentage_override >= (0)::numeric) AND (commission_percentage_override <= (100)::numeric))) not valid;

alter table "public"."financial_booking_service" validate constraint "financial_booking_service_commission_percentage_override_check";

alter table "public"."financial_booking_service" add constraint "financial_booking_service_financial_booking_id_fkey" FOREIGN KEY (financial_booking_id) REFERENCES public.financial_bookings(id) ON DELETE CASCADE not valid;

alter table "public"."financial_booking_service" validate constraint "financial_booking_service_financial_booking_id_fkey";

alter table "public"."financial_bookings" add constraint "financial_bookings_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_client_id_fkey";

alter table "public"."financial_bookings" add constraint "financial_bookings_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE SET NULL not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_club_slug_fkey";

alter table "public"."financial_bookings" add constraint "financial_bookings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_created_by_fkey";

alter table "public"."financial_bookings" add constraint "financial_bookings_department_check" CHECK ((department = ANY (ARRAY['nightlife'::text, 'transport'::text, 'protection'::text, 'other'::text]))) not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_department_check";

alter table "public"."financial_bookings" add constraint "financial_bookings_payment_status_check" CHECK ((payment_status = ANY (ARRAY['expected'::text, 'attended'::text, 'paid_final'::text, 'cancelled'::text]))) not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_payment_status_check";

alter table "public"."financial_bookings" add constraint "financial_bookings_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.financial_promoters(id) ON DELETE SET NULL not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_promoter_id_fkey";

alter table "public"."financial_bookings" add constraint "financial_bookings_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES public.financial_rules(id) ON DELETE SET NULL not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_rule_id_fkey";

alter table "public"."financial_bookings" add constraint "financial_bookings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."financial_bookings" validate constraint "financial_bookings_updated_by_fkey";

alter table "public"."financial_config_change_requests" add constraint "financial_config_change_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."financial_config_change_requests" validate constraint "financial_config_change_requests_requested_by_fkey";

alter table "public"."financial_config_change_requests" add constraint "financial_config_change_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."financial_config_change_requests" validate constraint "financial_config_change_requests_reviewed_by_fkey";

alter table "public"."financial_config_change_requests" add constraint "financial_config_change_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."financial_config_change_requests" validate constraint "financial_config_change_requests_status_check";

alter table "public"."financial_config_change_requests" add constraint "financial_config_change_requests_target_type_check" CHECK ((target_type = ANY (ARRAY['financial_rule'::text, 'financial_promoter'::text]))) not valid;

alter table "public"."financial_config_change_requests" validate constraint "financial_config_change_requests_target_type_check";

alter table "public"."financial_promoters" add constraint "financial_promoters_commission_percentage_check" CHECK (((commission_percentage >= (0)::numeric) AND (commission_percentage <= (100)::numeric))) not valid;

alter table "public"."financial_promoters" validate constraint "financial_promoters_commission_percentage_check";

alter table "public"."financial_promoters" add constraint "financial_promoters_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."financial_promoters" validate constraint "financial_promoters_user_id_fkey";

alter table "public"."financial_recurring_templates" add constraint "financial_recurring_templates_default_status_check" CHECK ((default_status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'failed'::text]))) not valid;

alter table "public"."financial_recurring_templates" validate constraint "financial_recurring_templates_default_status_check";

alter table "public"."financial_recurring_templates" add constraint "financial_recurring_templates_direction_check" CHECK ((direction = ANY (ARRAY['income'::text, 'expense'::text]))) not valid;

alter table "public"."financial_recurring_templates" validate constraint "financial_recurring_templates_direction_check";

alter table "public"."financial_recurring_templates" add constraint "financial_recurring_templates_interval_days_check" CHECK ((interval_days >= 1)) not valid;

alter table "public"."financial_recurring_templates" validate constraint "financial_recurring_templates_interval_days_check";

alter table "public"."financial_recurring_templates" add constraint "financial_recurring_templates_payee_fk" FOREIGN KEY (payee_id) REFERENCES public.financial_payees(id) ON DELETE SET NULL not valid;

alter table "public"."financial_recurring_templates" validate constraint "financial_recurring_templates_payee_fk";

alter table "public"."financial_recurring_templates" add constraint "financial_recurring_templates_recurrence_every_check" CHECK (((recurrence_every >= 1) AND (recurrence_every <= 24))) not valid;

alter table "public"."financial_recurring_templates" validate constraint "financial_recurring_templates_recurrence_every_check";

alter table "public"."financial_recurring_templates" add constraint "financial_recurring_templates_recurrence_unit_check" CHECK ((recurrence_unit = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text, 'custom_days'::text]))) not valid;

alter table "public"."financial_recurring_templates" validate constraint "financial_recurring_templates_recurrence_unit_check";

alter table "public"."financial_rules" add constraint "financial_rules_bonus_goal_check" CHECK ((bonus_goal >= 0)) not valid;

alter table "public"."financial_rules" validate constraint "financial_rules_bonus_goal_check";

alter table "public"."financial_rules" add constraint "financial_rules_bonus_type_check" CHECK ((bonus_type = ANY (ARRAY['flat'::text, 'stacking'::text, 'none'::text]))) not valid;

alter table "public"."financial_rules" validate constraint "financial_rules_bonus_type_check";

alter table "public"."financial_rules" add constraint "financial_rules_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE SET NULL not valid;

alter table "public"."financial_rules" validate constraint "financial_rules_club_slug_fkey";

alter table "public"."financial_rules" add constraint "financial_rules_department_check" CHECK ((department = ANY (ARRAY['nightlife'::text, 'transport'::text, 'protection'::text, 'other'::text]))) not valid;

alter table "public"."financial_rules" validate constraint "financial_rules_department_check";

alter table "public"."financial_rules" add constraint "financial_rules_logic_type_check" CHECK ((logic_type = ANY (ARRAY['headcount_pay'::text, 'commission_percent'::text, 'flat_fee'::text]))) not valid;

alter table "public"."financial_rules" validate constraint "financial_rules_logic_type_check";

alter table "public"."financial_transactions" add constraint "financial_transactions_direction_check" CHECK ((direction = ANY (ARRAY['income'::text, 'expense'::text]))) not valid;

alter table "public"."financial_transactions" validate constraint "financial_transactions_direction_check";

alter table "public"."financial_transactions" add constraint "financial_transactions_payee_fk" FOREIGN KEY (payee_id) REFERENCES public.financial_payees(id) ON DELETE SET NULL not valid;

alter table "public"."financial_transactions" validate constraint "financial_transactions_payee_fk";

alter table "public"."financial_transactions" add constraint "financial_transactions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'failed'::text]))) not valid;

alter table "public"."financial_transactions" validate constraint "financial_transactions_status_check";

alter table "public"."guest_identity_links" add constraint "guest_identity_links_guest_profile_id_fkey" FOREIGN KEY (guest_profile_id) REFERENCES public.guest_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."guest_identity_links" validate constraint "guest_identity_links_guest_profile_id_fkey";

alter table "public"."guest_identity_links" add constraint "guest_identity_links_identity_type_check" CHECK ((identity_type = ANY (ARRAY['phone'::text, 'email'::text, 'instagram'::text]))) not valid;

alter table "public"."guest_identity_links" validate constraint "guest_identity_links_identity_type_check";

alter table "public"."guest_identity_links" add constraint "guest_identity_links_identity_type_normalized_value_key" UNIQUE using index "guest_identity_links_identity_type_normalized_value_key";

alter table "public"."guestlist_checkins" add constraint "guestlist_checkins_checked_in_by_fkey" FOREIGN KEY (checked_in_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."guestlist_checkins" validate constraint "guestlist_checkins_checked_in_by_fkey";

alter table "public"."guestlist_checkins" add constraint "guestlist_checkins_checkin_source_check" CHECK ((checkin_source = ANY (ARRAY['self'::text, 'promoter'::text, 'admin'::text]))) not valid;

alter table "public"."guestlist_checkins" validate constraint "guestlist_checkins_checkin_source_check";

alter table "public"."guestlist_checkins" add constraint "guestlist_checkins_guestlist_signup_id_fkey" FOREIGN KEY (guestlist_signup_id) REFERENCES public.guestlist_signups(id) ON DELETE CASCADE not valid;

alter table "public"."guestlist_checkins" validate constraint "guestlist_checkins_guestlist_signup_id_fkey";

alter table "public"."guestlist_demographics" add constraint "guestlist_demographics_guest_profile_id_fkey" FOREIGN KEY (guest_profile_id) REFERENCES public.guest_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."guestlist_demographics" validate constraint "guestlist_demographics_guest_profile_id_fkey";

alter table "public"."guestlist_demographics" add constraint "guestlist_demographics_guestlist_event_id_fkey" FOREIGN KEY (guestlist_event_id) REFERENCES public.guestlist_events(id) ON DELETE SET NULL not valid;

alter table "public"."guestlist_demographics" validate constraint "guestlist_demographics_guestlist_event_id_fkey";

alter table "public"."guestlist_demographics" add constraint "guestlist_demographics_source_check" CHECK ((source = ANY (ARRAY['self'::text, 'promoter'::text, 'admin'::text]))) not valid;

alter table "public"."guestlist_demographics" validate constraint "guestlist_demographics_source_check";

alter table "public"."guestlist_events" add constraint "guestlist_events_club_slug_event_date_promoter_id_key" UNIQUE using index "guestlist_events_club_slug_event_date_promoter_id_key";

alter table "public"."guestlist_events" add constraint "guestlist_events_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE CASCADE not valid;

alter table "public"."guestlist_events" validate constraint "guestlist_events_club_slug_fkey";

alter table "public"."guestlist_events" add constraint "guestlist_events_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE SET NULL not valid;

alter table "public"."guestlist_events" validate constraint "guestlist_events_promoter_id_fkey";

alter table "public"."guestlist_events" add constraint "guestlist_events_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'cancelled'::text]))) not valid;

alter table "public"."guestlist_events" validate constraint "guestlist_events_status_check";

alter table "public"."guestlist_signups" add constraint "guestlist_signups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."guestlist_signups" validate constraint "guestlist_signups_created_by_fkey";

alter table "public"."guestlist_signups" add constraint "guestlist_signups_guest_profile_id_fkey" FOREIGN KEY (guest_profile_id) REFERENCES public.guest_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."guestlist_signups" validate constraint "guestlist_signups_guest_profile_id_fkey";

alter table "public"."guestlist_signups" add constraint "guestlist_signups_guestlist_event_id_fkey" FOREIGN KEY (guestlist_event_id) REFERENCES public.guestlist_events(id) ON DELETE CASCADE not valid;

alter table "public"."guestlist_signups" validate constraint "guestlist_signups_guestlist_event_id_fkey";

alter table "public"."guestlist_signups" add constraint "guestlist_signups_guestlist_event_id_guest_profile_id_key" UNIQUE using index "guestlist_signups_guestlist_event_id_guest_profile_id_key";

alter table "public"."guestlist_signups" add constraint "guestlist_signups_status_check" CHECK ((status = ANY (ARRAY['signed_up'::text, 'attended'::text, 'no_show'::text, 'cancelled'::text]))) not valid;

alter table "public"."guestlist_signups" validate constraint "guestlist_signups_status_check";

alter table "public"."job_disputes" add constraint "job_disputes_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE CASCADE not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_club_slug_fkey";

alter table "public"."job_disputes" add constraint "job_disputes_promoter_guestlist_entry_id_fkey" FOREIGN KEY (promoter_guestlist_entry_id) REFERENCES public.promoter_guestlist_entries(id) ON DELETE SET NULL not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_promoter_guestlist_entry_id_fkey";

alter table "public"."job_disputes" add constraint "job_disputes_promoter_job_id_fkey" FOREIGN KEY (promoter_job_id) REFERENCES public.promoter_jobs(id) ON DELETE SET NULL not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_promoter_job_id_fkey";

alter table "public"."job_disputes" add constraint "job_disputes_promoter_table_sale_id_fkey" FOREIGN KEY (promoter_table_sale_id) REFERENCES public.promoter_table_sales(id) ON DELETE SET NULL not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_promoter_table_sale_id_fkey";

alter table "public"."job_disputes" add constraint "job_disputes_raised_by_role_check" CHECK ((raised_by_role = ANY (ARRAY['club'::text, 'admin'::text, 'promoter'::text]))) not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_raised_by_role_check";

alter table "public"."job_disputes" add constraint "job_disputes_raised_by_user_id_fkey" FOREIGN KEY (raised_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_raised_by_user_id_fkey";

alter table "public"."job_disputes" add constraint "job_disputes_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_resolved_by_fkey";

alter table "public"."job_disputes" add constraint "job_disputes_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'under_review'::text, 'resolved'::text, 'rejected'::text]))) not valid;

alter table "public"."job_disputes" validate constraint "job_disputes_status_check";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'host'::text, 'promoter'::text, 'club'::text, 'owner'::text, 'manager'::text, 'finance'::text, 'operations'::text, 'viewer'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."promoter_availability" add constraint "promoter_availability_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_availability" validate constraint "promoter_availability_promoter_id_fkey";

alter table "public"."promoter_availability" add constraint "promoter_availability_promoter_id_weekday_key" UNIQUE using index "promoter_availability_promoter_id_weekday_key";

alter table "public"."promoter_availability" add constraint "promoter_availability_weekday_check" CHECK (((weekday >= 0) AND (weekday <= 6))) not valid;

alter table "public"."promoter_availability" validate constraint "promoter_availability_weekday_check";

alter table "public"."promoter_club_preferences" add constraint "promoter_club_preferences_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE CASCADE not valid;

alter table "public"."promoter_club_preferences" validate constraint "promoter_club_preferences_club_slug_fkey";

alter table "public"."promoter_club_preferences" add constraint "promoter_club_preferences_promoter_id_club_slug_key" UNIQUE using index "promoter_club_preferences_promoter_id_club_slug_key";

alter table "public"."promoter_club_preferences" add constraint "promoter_club_preferences_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_club_preferences" validate constraint "promoter_club_preferences_promoter_id_fkey";

alter table "public"."promoter_club_preferences" add constraint "promoter_club_preferences_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."promoter_club_preferences" validate constraint "promoter_club_preferences_status_check";

alter table "public"."promoter_earnings" add constraint "promoter_earnings_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_earnings" validate constraint "promoter_earnings_promoter_id_fkey";

alter table "public"."promoter_earnings" add constraint "promoter_earnings_promoter_job_id_fkey" FOREIGN KEY (promoter_job_id) REFERENCES public.promoter_jobs(id) ON DELETE SET NULL not valid;

alter table "public"."promoter_earnings" validate constraint "promoter_earnings_promoter_job_id_fkey";

alter table "public"."promoter_guestlist_entries" add constraint "promoter_guestlist_entries_approval_status_chk" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."promoter_guestlist_entries" validate constraint "promoter_guestlist_entries_approval_status_chk";

alter table "public"."promoter_guestlist_entries" add constraint "promoter_guestlist_entries_promoter_job_id_fkey" FOREIGN KEY (promoter_job_id) REFERENCES public.promoter_jobs(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_guestlist_entries" validate constraint "promoter_guestlist_entries_promoter_job_id_fkey";

alter table "public"."promoter_guestlist_entries" add constraint "promoter_guestlist_entries_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."promoter_guestlist_entries" validate constraint "promoter_guestlist_entries_reviewed_by_fkey";

alter table "public"."promoter_invoice_lines" add constraint "promoter_invoice_lines_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.promoter_invoices(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_invoice_lines" validate constraint "promoter_invoice_lines_invoice_id_fkey";

alter table "public"."promoter_invoice_lines" add constraint "promoter_invoice_lines_promoter_job_id_fkey" FOREIGN KEY (promoter_job_id) REFERENCES public.promoter_jobs(id) ON DELETE SET NULL not valid;

alter table "public"."promoter_invoice_lines" validate constraint "promoter_invoice_lines_promoter_job_id_fkey";

alter table "public"."promoter_invoices" add constraint "promoter_invoices_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_invoices" validate constraint "promoter_invoices_promoter_id_fkey";

alter table "public"."promoter_invoices" add constraint "promoter_invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'paid'::text, 'cancelled'::text]))) not valid;

alter table "public"."promoter_invoices" validate constraint "promoter_invoices_status_check";

alter table "public"."promoter_jobs" add constraint "promoter_jobs_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE SET NULL not valid;

alter table "public"."promoter_jobs" validate constraint "promoter_jobs_club_slug_fkey";

alter table "public"."promoter_jobs" add constraint "promoter_jobs_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_jobs" validate constraint "promoter_jobs_promoter_id_fkey";

alter table "public"."promoter_jobs" add constraint "promoter_jobs_status_check" CHECK ((status = ANY (ARRAY['assigned'::text, 'completed'::text, 'cancelled'::text]))) not valid;

alter table "public"."promoter_jobs" validate constraint "promoter_jobs_status_check";

alter table "public"."promoter_night_adjustments" add constraint "promoter_night_adjustments_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_night_adjustments" validate constraint "promoter_night_adjustments_promoter_id_fkey";

alter table "public"."promoter_night_adjustments" add constraint "promoter_night_adjustments_promoter_id_night_date_key" UNIQUE using index "promoter_night_adjustments_promoter_id_night_date_key";

alter table "public"."promoter_night_adjustments" add constraint "promoter_night_adjustments_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."promoter_night_adjustments" validate constraint "promoter_night_adjustments_reviewed_by_fkey";

alter table "public"."promoter_night_adjustments" add constraint "promoter_night_adjustments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."promoter_night_adjustments" validate constraint "promoter_night_adjustments_status_check";

alter table "public"."promoter_profile_revisions" add constraint "promoter_profile_revisions_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_profile_revisions" validate constraint "promoter_profile_revisions_promoter_id_fkey";

alter table "public"."promoter_profile_revisions" add constraint "promoter_profile_revisions_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."promoter_profile_revisions" validate constraint "promoter_profile_revisions_reviewer_id_fkey";

alter table "public"."promoter_profile_revisions" add constraint "promoter_profile_revisions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."promoter_profile_revisions" validate constraint "promoter_profile_revisions_status_check";

alter table "public"."promoter_signup_requests" add constraint "promoter_signup_requests_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) not valid;

alter table "public"."promoter_signup_requests" validate constraint "promoter_signup_requests_auth_user_id_fkey";

alter table "public"."promoter_signup_requests" add constraint "promoter_signup_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."promoter_signup_requests" validate constraint "promoter_signup_requests_reviewed_by_fkey";

alter table "public"."promoter_signup_requests" add constraint "promoter_signup_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text]))) not valid;

alter table "public"."promoter_signup_requests" validate constraint "promoter_signup_requests_status_check";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_approval_status_check";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_club_slug_fkey" FOREIGN KEY (club_slug) REFERENCES public.clubs(slug) ON DELETE RESTRICT not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_club_slug_fkey";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_entry_channel_check" CHECK ((entry_channel = ANY (ARRAY['promoter'::text, 'admin'::text]))) not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_entry_channel_check";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES public.promoters(id) ON DELETE CASCADE not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_promoter_id_fkey";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_promoter_job_id_fkey" FOREIGN KEY (promoter_job_id) REFERENCES public.promoter_jobs(id) ON DELETE SET NULL not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_promoter_job_id_fkey";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_reviewed_by_fkey";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_table_count_check" CHECK (((table_count >= 1) AND (table_count <= 99))) not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_table_count_check";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_tier_check" CHECK ((tier = ANY (ARRAY['standard'::text, 'luxury'::text, 'vip'::text, 'other'::text]))) not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_tier_check";

alter table "public"."promoter_table_sales" add constraint "promoter_table_sales_total_min_spend_check" CHECK ((total_min_spend >= (0)::numeric)) not valid;

alter table "public"."promoter_table_sales" validate constraint "promoter_table_sales_total_min_spend_check";

alter table "public"."promoters" add constraint "promoters_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."promoters" validate constraint "promoters_approval_status_check";

alter table "public"."promoters" add constraint "promoters_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."promoters" validate constraint "promoters_user_id_fkey";

alter table "public"."promoters" add constraint "promoters_user_id_key" UNIQUE using index "promoters_user_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._club_day_key(raw text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._pref_weekdays_include_dow(p_weekdays text[], p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.accept_club_invite(p_invite_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  update public.club_accounts
  set user_id = auth.uid(),
      status = 'active',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where invite_code = p_invite_code
    and status = 'invited'
  returning id into v_id;

  if v_id is null then
    raise exception 'invite not found';
  end if;

  insert into public.profiles (id, role, display_name)
  values (auth.uid(), 'club', null)
  on conflict (id) do update set role = 'club';

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_insert_table_sale(p_promoter_id uuid, p_sale_date date, p_club_slug text, p_promoter_job_id uuid, p_tier text, p_table_count integer, p_total_min_spend numeric, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_issue_club_invite(p_club_slug text, p_invite_email text, p_role text DEFAULT 'owner'::text, p_notes text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code text;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.clubs c where c.slug = p_club_slug) then
    raise exception 'club not found';
  end if;
  if p_role not in ('owner', 'manager', 'editor') then
    raise exception 'invalid role';
  end if;

  v_code := md5(
    random()::text
    || clock_timestamp()::text
    || coalesce(auth.uid()::text, '')
    || coalesce(p_club_slug, '')
    || coalesce(p_invite_email, '')
  );
  insert into public.club_accounts (
    club_slug, role, status, invite_email, invite_code, created_by, notes
  )
  values (
    p_club_slug,
    p_role,
    'invited',
    nullif(trim(both from p_invite_email), ''),
    v_code,
    auth.uid(),
    coalesce(p_notes, '')
  );
  return v_code;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_review_guestlist_entry(p_entry_id uuid, p_approve boolean, p_review_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_review_night_adjustment(p_adjustment_id uuid, p_approve boolean, p_review_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_review_table_sale(p_entry_id uuid, p_approve boolean, p_review_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.apply_recurring_financial_transactions(p_through date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.approve_promoter_profile_revision(p_revision_id uuid, p_approve boolean, p_review_notes text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_promoter_earnings(p_promoter_id uuid, p_from date, p_to date)
 RETURNS numeric
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(amount), 0)::numeric
  from public.promoter_earnings
  where promoter_id = p_promoter_id
    and earning_date between p_from and p_to;
$function$
;

CREATE OR REPLACE FUNCTION public.can_request_financial_rule_change(p_target_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select
    public.is_financial_editor()
    or exists (
      select 1
      from public.financial_rules fr
      join public.club_accounts ca on ca.club_slug = fr.club_slug
      where fr.id = p_target_id
        and ca.user_id = auth.uid()
        and ca.status = 'active'
        and ca.role in ('owner', 'manager')
    );
$function$
;

CREATE OR REPLACE FUNCTION public.client_attendance_recalc_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.club_account_for_user(p_user_id uuid, p_club_slug text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.club_accounts ca
    where ca.user_id = p_user_id
      and ca.club_slug = p_club_slug
      and ca.status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.club_decide_promoter_job(p_job_id uuid, p_decision text, p_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slug text;
begin
  select club_slug into v_slug
  from public.promoter_jobs
  where id = p_job_id;

  if v_slug is null then
    raise exception 'job not found';
  end if;

  if p_decision not in ('approve', 'deny') then
    raise exception 'invalid decision';
  end if;

  if not (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or public.club_account_for_user(auth.uid(), v_slug)
  ) then
    raise exception 'forbidden';
  end if;

  update public.promoter_jobs
  set status = case
    when p_decision = 'deny' then 'cancelled'
    else status
  end,
  notes = trim(
    both from concat_ws(
      E'\n',
      nullif(notes, ''),
      case
        when coalesce(trim(both from p_note), '') = '' then null
        else '[club_' || p_decision || '] ' || trim(both from p_note)
      end
    )
  )
  where id = p_job_id;

  return p_job_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.club_set_promoter_preference_access(p_preference_id uuid, p_allow boolean, p_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slug text;
begin
  select club_slug into v_slug
  from public.promoter_club_preferences
  where id = p_preference_id;

  if v_slug is null then
    raise exception 'preference not found';
  end if;

  if not (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or public.club_account_for_user(auth.uid(), v_slug)
  ) then
    raise exception 'forbidden';
  end if;

  update public.promoter_club_preferences
  set status = case when p_allow then 'approved' else 'rejected' end,
      notes = trim(
        both from concat_ws(
          E'\n',
          nullif(notes, ''),
          case
            when coalesce(trim(both from p_note), '') = '' then null
            else '[club_access] ' || trim(both from p_note)
          end
        )
      )
  where id = p_preference_id;

  return p_preference_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_clients_from_enquiry(p_enquiry_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_guestlist_signup_bundle(p_club_slug text, p_event_date date, p_source text, p_guests jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_promoter_job_safe(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_campaign_audience(p_name text, p_description text DEFAULT ''::text, p_filter_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_promoter_invoice(p_promoter_id uuid, p_period_start date, p_period_end date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_booking_detail_drawer(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select public.rpc_booking_detail_drawer(p_booking_id);
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_org_context()
 RETURNS TABLE(organisation_id uuid, organisation_name text, organisation_slug text, role text, status text, is_default boolean)
 LANGUAGE sql
 STABLE
AS $function$
  select *
  from public.rpc_dashboard_org_context();
$function$
;

CREATE OR REPLACE FUNCTION public.get_financial_dashboard_snapshot(p_from date, p_to date)
 RETURNS TABLE(total_realized_profit numeric, nightlife_realized_profit numeric, transport_realized_profit numeric, protection_realized_profit numeric, other_realized_profit numeric, total_nightlife_guests integer, avg_nightlife_profit_per_guest numeric, outstanding_projected_profit numeric, realized_projected_profit numeric, top_promoter_name text, top_promoter_realized_profit numeric)
 LANGUAGE sql
 STABLE
AS $function$
  with base as (
    select
      fb.id,
      fb.department,
      fb.payment_status,
      fb.booking_date,
      coalesce(fp.name, '') as promoter_name,
      coalesce(n.male_guests, 0) + coalesce(n.female_guests, 0) as total_guests,
      coalesce((fb.rule_snapshot_json->>'projectedAgencyProfit')::numeric, 0) as projected_profit,
      case
        when fb.payment_status = 'paid_final' then coalesce((fb.rule_snapshot_json->>'projectedAgencyProfit')::numeric, 0)
        else 0
      end as realized_profit
    from public.financial_bookings fb
    left join public.financial_booking_nightlife n on n.financial_booking_id = fb.id
    left join public.financial_promoters fp on fp.id = fb.promoter_id
    where fb.booking_date >= p_from
      and fb.booking_date <= p_to
      and fb.is_archived = false
  ),
  top_promoter as (
    select promoter_name, sum(realized_profit) as realized_sum
    from base
    group by promoter_name
    order by realized_sum desc nulls last
    limit 1
  )
  select
    coalesce(sum(base.realized_profit), 0) as total_realized_profit,
    coalesce(sum(case when base.department = 'nightlife' then base.realized_profit else 0 end), 0) as nightlife_realized_profit,
    coalesce(sum(case when base.department = 'transport' then base.realized_profit else 0 end), 0) as transport_realized_profit,
    coalesce(sum(case when base.department = 'protection' then base.realized_profit else 0 end), 0) as protection_realized_profit,
    coalesce(sum(case when base.department = 'other' then base.realized_profit else 0 end), 0) as other_realized_profit,
    coalesce(sum(case when base.department = 'nightlife' then base.total_guests else 0 end), 0)::integer as total_nightlife_guests,
    case
      when coalesce(sum(case when base.department = 'nightlife' then base.total_guests else 0 end), 0) = 0
        then 0
      else
        coalesce(sum(case when base.department = 'nightlife' then base.realized_profit else 0 end), 0)
        / nullif(sum(case when base.department = 'nightlife' then base.total_guests else 0 end), 0)
    end as avg_nightlife_profit_per_guest,
    coalesce(sum(case when base.payment_status <> 'paid_final' then base.projected_profit else 0 end), 0) as outstanding_projected_profit,
    coalesce(sum(case when base.payment_status = 'paid_final' then base.projected_profit else 0 end), 0) as realized_projected_profit,
    (select promoter_name from top_promoter) as top_promoter_name,
    coalesce((select realized_sum from top_promoter), 0) as top_promoter_realized_profit
  from base;
$function$
;

CREATE OR REPLACE FUNCTION public.get_financial_period_summary(p_from date, p_to date, p_direction text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_payment_tag text DEFAULT NULL::text, p_payee_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(income numeric, expense numeric, net numeric, tx_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_financial_report(p_period_type text, p_from date, p_to date, p_direction text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_payment_tag text DEFAULT NULL::text, p_payee_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(period_label text, income numeric, expense numeric, net numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_guestlist_conversion_metrics(p_club_slug text DEFAULT NULL::text, p_promoter_id uuid DEFAULT NULL::uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(event_id uuid, club_slug text, promoter_id uuid, event_date date, signups integer, attended integer, conversion numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_report_templates()
 RETURNS TABLE(id uuid, code text, name text, description text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select rt.id, rt.code, rt.name, rt.description
  from public.report_templates rt
  where rt.is_active = true
  order by rt.name asc;
$function$
;

CREATE OR REPLACE FUNCTION public.guestlist_hosts_for_date(p_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.insert_promoter_guestlist_entry(p_job_id uuid, p_guest_name text, p_guest_contact text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.insert_promoter_job_self(p_club_slug text, p_job_date date, p_service text DEFAULT 'guestlist'::text, p_shift_fee numeric DEFAULT 0, p_guestlist_fee numeric DEFAULT 0, p_guests_count integer DEFAULT 0, p_notes text DEFAULT ''::text, p_status text DEFAULT 'assigned'::text, p_client_name text DEFAULT ''::text, p_client_contact text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.insert_promoter_table_sale(p_sale_date date, p_club_slug text, p_promoter_job_id uuid, p_tier text, p_table_count integer, p_total_min_spend numeric, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_financial_club_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.club_accounts ca
    where ca.user_id = auth.uid()
      and ca.status = 'active'
      and ca.role in ('owner', 'manager')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_financial_editor()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_financial_reader()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
    or exists (
      select 1
      from public.club_accounts ca
      where ca.user_id = auth.uid()
        and ca.status = 'active'
        and ca.role in ('owner', 'manager')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('host', 'promoter')
    );
$function$
;

CREATE OR REPLACE FUNCTION public.promote_signup_to_attended(p_signup_id uuid, p_source text, p_checked_in_by uuid DEFAULT NULL::uuid, p_age smallint DEFAULT NULL::smallint, p_gender text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_client_preferences(p_client_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.review_club_edit_revision(p_revision_id uuid, p_approve boolean, p_review_notes text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slug text;
  v_target_type text;
  v_target_id uuid;
  v_payload jsonb;
  v_status text := case when p_approve then 'approved' else 'rejected' end;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;

  update public.club_edit_revisions
  set status = v_status,
      review_notes = coalesce(p_review_notes, ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_revision_id
  returning club_slug, target_type, target_id, payload
  into v_slug, v_target_type, v_target_id, v_payload;

  if v_slug is null then
    raise exception 'revision not found';
  end if;

  if p_approve then
    if v_target_type = 'club_payload' then
      update public.clubs
      set payload = coalesce(v_payload, '{}'::jsonb),
          name = coalesce(nullif(trim(both from (coalesce(v_payload, '{}'::jsonb)->>'name')), ''), name),
          updated_at = now()
      where slug = v_slug;
    elsif v_target_type = 'flyer' and v_target_id is not null then
      update public.club_weekly_flyers
      set title = coalesce(nullif((coalesce(v_payload, '{}'::jsonb)->>'title'), ''), title),
          description = coalesce(nullif((coalesce(v_payload, '{}'::jsonb)->>'description'), ''), description),
          image_path = coalesce(nullif((coalesce(v_payload, '{}'::jsonb)->>'image_path'), ''), image_path),
          image_url = coalesce(nullif((coalesce(v_payload, '{}'::jsonb)->>'image_url'), ''), image_url),
          sort_order = coalesce(((coalesce(v_payload, '{}'::jsonb)->>'sort_order')::int), sort_order),
          is_active = coalesce(((coalesce(v_payload, '{}'::jsonb)->>'is_active')::boolean), is_active),
          updated_at = now()
      where id = v_target_id;
    end if;
  end if;

  return p_revision_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.review_job_dispute(p_dispute_id uuid, p_status text, p_resolution_notes text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;
  if p_status not in ('under_review', 'resolved', 'rejected') then
    raise exception 'invalid status';
  end if;

  update public.job_disputes
  set status = p_status,
      resolution_notes = coalesce(p_resolution_notes, ''),
      resolved_by = case when p_status in ('resolved', 'rejected') then auth.uid() else resolved_by end,
      resolved_at = case when p_status in ('resolved', 'rejected') then now() else resolved_at end,
      updated_at = now()
  where id = p_dispute_id;

  if not found then
    raise exception 'dispute not found';
  end if;
  return p_dispute_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_department_performance(p_org_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_department text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS TABLE(department text, bookings_count bigint, revenue numeric, projected_profit numeric, realized_profit numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select
    result.department,
    result.bookings_count,
    result.total_revenue as revenue,
    result.total_projected_profit as projected_profit,
    result.total_realised_profit as realized_profit
  from public.get_department_breakdown(
    p_org_id,
    coalesce(p_date_from, '1900-01-01'::date),
    coalesce(p_date_to, '2999-12-31'::date)
  ) result
  where p_department is null or result.department = p_department;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_near_bonus_alerts(p_org_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_department text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS TABLE(booking_id uuid, booking_reference text, booking_date date, venue_or_service_name text, guests_needed integer, current_guests integer, bonus_goal integer, promoter_name text)
 LANGUAGE sql
 STABLE
AS $function$
  select
    nb.booking_id,
    nb.booking_reference,
    nb.booking_date,
    nb.venue_or_service_name,
    nb.guests_until_bonus as guests_needed,
    nb.current_guests,
    (nb.current_guests + nb.guests_until_bonus) as bonus_goal,
    nb.promoter_name
  from public.get_near_bonus_bookings(
    p_org_id,
    coalesce(p_date_from, '1900-01-01'::date),
    coalesce(p_date_to, '2999-12-31'::date)
  ) nb
  where p_search is null
    or nb.booking_reference ilike '%' || p_search || '%'
    or nb.venue_or_service_name ilike '%' || p_search || '%'
    or coalesce(nb.promoter_name, '') ilike '%' || p_search || '%';
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_service_performance(p_org_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_department text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS TABLE(venue_or_service_name text, department text, bookings_count bigint, revenue numeric, projected_profit numeric, realized_profit numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select
    v.venue_or_service_name,
    v.department,
    v.bookings_count,
    v.total_revenue as revenue,
    v.total_revenue as projected_profit,
    v.total_realised_profit as realized_profit
  from public.get_venue_performance(
    p_org_id,
    coalesce(p_date_from, '1900-01-01'::date),
    coalesce(p_date_to, '2999-12-31'::date)
  ) v
  where (p_department is null or v.department = p_department)
    and (p_search is null or v.venue_or_service_name ilike '%' || p_search || '%');
$function$
;

CREATE OR REPLACE FUNCTION public.submit_club_edit_revision(p_club_slug text, p_target_type text, p_target_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_target_type not in ('club_payload', 'flyer', 'media') then
    raise exception 'invalid target_type';
  end if;
  if not (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or public.club_account_for_user(auth.uid(), p_club_slug)
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.club_edit_revisions (
    club_slug, submitted_by, target_type, target_id, payload, status
  )
  values (
    p_club_slug, auth.uid(), p_target_type, p_target_id, coalesce(p_payload, '{}'::jsonb), 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_job_dispute(p_promoter_job_id uuid, p_reason_code text DEFAULT 'other'::text, p_description text DEFAULT ''::text, p_evidence jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slug text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select club_slug into v_slug
  from public.promoter_jobs
  where id = p_promoter_job_id;
  if v_slug is null then
    raise exception 'job not found';
  end if;

  if not (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or public.club_account_for_user(auth.uid(), v_slug)
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.job_disputes (
    club_slug,
    promoter_job_id,
    raised_by_user_id,
    raised_by_role,
    reason_code,
    description,
    evidence,
    status
  )
  values (
    v_slug,
    p_promoter_job_id,
    auth.uid(),
    case when exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then 'admin' else 'club' end,
    coalesce(nullif(trim(both from p_reason_code), ''), 'other'),
    coalesce(p_description, ''),
    coalesce(p_evidence, '{}'::jsonb),
    'open'
  )
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_website_enquiry(p_form_name text, p_form_label text, p_service text, p_client_key text, p_name text, p_email text, p_phone text, p_payload jsonb, p_guests jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_crm_clients_from_guestlist_batch(p_enquiry_id uuid, p_club_slug text, p_event_date date, p_guests jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n int := 0;
  i int := 0;
  ni int;
  g jsonb;
  v_name text;
  v_contact text;
  v_email text;
  v_phone text;
  v_ig text;
  v_gp uuid;
  v_client_id uuid;
  v_slug text;
  v_promoter uuid;
  enquiry_ok boolean;
BEGIN
  v_slug := lower(trim(p_club_slug));
  IF p_enquiry_id IS NULL OR length(v_slug) < 1 THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
      SELECT 1
      FROM public.enquiries e
      WHERE e.id = p_enquiry_id
        AND e.form_name = 'nightlife_guestlist'
        AND e.created_at > now() - interval '36 hours'
    )
  INTO enquiry_ok;

  IF NOT enquiry_ok THEN
    RAISE EXCEPTION 'invalid_or_expired_enquiry';
  END IF;

  SELECT ge.promoter_id
  INTO v_promoter
  FROM public.guestlist_events ge
  WHERE lower(trim(ge.club_slug)) = v_slug
    AND ge.event_date = p_event_date
  ORDER BY ge.created_at DESC NULLS LAST
  LIMIT 1;

  ni := coalesce(jsonb_array_length(p_guests), 0);
  WHILE i < ni LOOP
    g := p_guests -> i;
    i := i + 1;

    v_name := nullif(trim(coalesce(g ->> 'guestName', '')), '');
    v_contact := nullif(trim(coalesce(g ->> 'guestContact', '')), '');
    IF v_name IS NULL THEN
      CONTINUE;
    END IF;

    v_email := NULL;
    v_phone := NULL;
    v_ig := NULL;
    IF v_contact IS NOT NULL THEN
      IF v_contact ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        v_email := lower(v_contact);
      ELSIF length(regexp_replace(v_contact, '\D', '', 'g')) >= 8 THEN
        v_phone := regexp_replace(v_contact, '\D', '', 'g');
      ELSE
        v_ig := lower(regexp_replace(v_contact, '^@+', ''));
      END IF;
    END IF;

    BEGIN
      v_gp := public.upsert_guest_profile_from_identity (
        p_full_name := v_name,
        p_phone := v_phone,
        p_email := v_email,
        p_instagram := v_ig,
        p_age := NULL::integer,
        p_gender := NULL::text
      );
    EXCEPTION
      WHEN OTHERS THEN
        v_gp := NULL;
    END;

    v_client_id := NULL;
    IF v_email IS NOT NULL THEN
      SELECT c.id
      INTO v_client_id
      FROM public.clients c
      WHERE c.email IS NOT NULL
        AND lower(trim(c.email)) = v_email
      LIMIT 1;
    END IF;

    IF v_client_id IS NULL AND v_phone IS NOT NULL THEN
      SELECT c.id
      INTO v_client_id
      FROM public.clients c
      WHERE c.phone IS NOT NULL
        AND regexp_replace(c.phone, '\D', '', 'g') = v_phone
      LIMIT 1;
    END IF;

    IF v_client_id IS NULL AND v_ig IS NOT NULL THEN
      SELECT c.id
      INTO v_client_id
      FROM public.clients c
      WHERE c.instagram IS NOT NULL
        AND lower(regexp_replace(trim(c.instagram), '^@+', '')) = v_ig
      LIMIT 1;
    END IF;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (name, email, phone, instagram, guest_profile_id)
      VALUES (v_name, v_email, v_phone, v_ig, v_gp)
      RETURNING id
      INTO v_client_id;
    ELSE
      UPDATE public.clients c
      SET
        name = coalesce(nullif(trim(c.name), ''), v_name),
        email = coalesce(c.email, v_email),
        phone = coalesce(c.phone, v_phone),
        instagram = coalesce(c.instagram, v_ig),
        guest_profile_id = coalesce(c.guest_profile_id, v_gp)
      WHERE c.id = v_client_id;
    END IF;

    INSERT INTO public.client_guestlist_activity (
      client_id,
      club_slug,
      event_date,
      promoter_id,
      enquiry_id,
      guest_profile_id
    )
    VALUES (
      v_client_id,
      v_slug,
      p_event_date,
      v_promoter,
      p_enquiry_id,
      v_gp
    )
    ON CONFLICT (client_id, club_slug, event_date) DO UPDATE
    SET
      promoter_id = coalesce(excluded.promoter_id, client_guestlist_activity.promoter_id),
      enquiry_id = coalesce(client_guestlist_activity.enquiry_id, excluded.enquiry_id),
      guest_profile_id = coalesce(client_guestlist_activity.guest_profile_id, excluded.guest_profile_id),
      updated_at = now();

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_guest_profile_from_identity(p_full_name text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_instagram text DEFAULT NULL::text, p_age smallint DEFAULT NULL::smallint, p_gender text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_promoter_night_adjustment(p_night_date date, p_available_override boolean, p_start_time time without time zone, p_end_time time without time zone, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

grant delete on table "public"."campaign_audience_members" to "anon";

grant insert on table "public"."campaign_audience_members" to "anon";

grant references on table "public"."campaign_audience_members" to "anon";

grant select on table "public"."campaign_audience_members" to "anon";

grant trigger on table "public"."campaign_audience_members" to "anon";

grant truncate on table "public"."campaign_audience_members" to "anon";

grant update on table "public"."campaign_audience_members" to "anon";

grant delete on table "public"."campaign_audience_members" to "authenticated";

grant insert on table "public"."campaign_audience_members" to "authenticated";

grant references on table "public"."campaign_audience_members" to "authenticated";

grant select on table "public"."campaign_audience_members" to "authenticated";

grant trigger on table "public"."campaign_audience_members" to "authenticated";

grant truncate on table "public"."campaign_audience_members" to "authenticated";

grant update on table "public"."campaign_audience_members" to "authenticated";

grant delete on table "public"."campaign_audience_members" to "service_role";

grant insert on table "public"."campaign_audience_members" to "service_role";

grant references on table "public"."campaign_audience_members" to "service_role";

grant select on table "public"."campaign_audience_members" to "service_role";

grant trigger on table "public"."campaign_audience_members" to "service_role";

grant truncate on table "public"."campaign_audience_members" to "service_role";

grant update on table "public"."campaign_audience_members" to "service_role";

grant delete on table "public"."campaign_audiences" to "anon";

grant insert on table "public"."campaign_audiences" to "anon";

grant references on table "public"."campaign_audiences" to "anon";

grant select on table "public"."campaign_audiences" to "anon";

grant trigger on table "public"."campaign_audiences" to "anon";

grant truncate on table "public"."campaign_audiences" to "anon";

grant update on table "public"."campaign_audiences" to "anon";

grant delete on table "public"."campaign_audiences" to "authenticated";

grant insert on table "public"."campaign_audiences" to "authenticated";

grant references on table "public"."campaign_audiences" to "authenticated";

grant select on table "public"."campaign_audiences" to "authenticated";

grant trigger on table "public"."campaign_audiences" to "authenticated";

grant truncate on table "public"."campaign_audiences" to "authenticated";

grant update on table "public"."campaign_audiences" to "authenticated";

grant delete on table "public"."campaign_audiences" to "service_role";

grant insert on table "public"."campaign_audiences" to "service_role";

grant references on table "public"."campaign_audiences" to "service_role";

grant select on table "public"."campaign_audiences" to "service_role";

grant trigger on table "public"."campaign_audiences" to "service_role";

grant truncate on table "public"."campaign_audiences" to "service_role";

grant update on table "public"."campaign_audiences" to "service_role";

grant delete on table "public"."cars" to "anon";

grant insert on table "public"."cars" to "anon";

grant references on table "public"."cars" to "anon";

grant select on table "public"."cars" to "anon";

grant trigger on table "public"."cars" to "anon";

grant truncate on table "public"."cars" to "anon";

grant update on table "public"."cars" to "anon";

grant delete on table "public"."cars" to "authenticated";

grant insert on table "public"."cars" to "authenticated";

grant references on table "public"."cars" to "authenticated";

grant select on table "public"."cars" to "authenticated";

grant trigger on table "public"."cars" to "authenticated";

grant truncate on table "public"."cars" to "authenticated";

grant update on table "public"."cars" to "authenticated";

grant delete on table "public"."cars" to "service_role";

grant insert on table "public"."cars" to "service_role";

grant references on table "public"."cars" to "service_role";

grant select on table "public"."cars" to "service_role";

grant trigger on table "public"."cars" to "service_role";

grant truncate on table "public"."cars" to "service_role";

grant update on table "public"."cars" to "service_role";

grant delete on table "public"."client_attendances" to "anon";

grant insert on table "public"."client_attendances" to "anon";

grant references on table "public"."client_attendances" to "anon";

grant select on table "public"."client_attendances" to "anon";

grant trigger on table "public"."client_attendances" to "anon";

grant truncate on table "public"."client_attendances" to "anon";

grant update on table "public"."client_attendances" to "anon";

grant delete on table "public"."client_attendances" to "authenticated";

grant insert on table "public"."client_attendances" to "authenticated";

grant references on table "public"."client_attendances" to "authenticated";

grant select on table "public"."client_attendances" to "authenticated";

grant trigger on table "public"."client_attendances" to "authenticated";

grant truncate on table "public"."client_attendances" to "authenticated";

grant update on table "public"."client_attendances" to "authenticated";

grant delete on table "public"."client_attendances" to "service_role";

grant insert on table "public"."client_attendances" to "service_role";

grant references on table "public"."client_attendances" to "service_role";

grant select on table "public"."client_attendances" to "service_role";

grant trigger on table "public"."client_attendances" to "service_role";

grant truncate on table "public"."client_attendances" to "service_role";

grant update on table "public"."client_attendances" to "service_role";

grant delete on table "public"."client_guestlist_activity" to "anon";

grant insert on table "public"."client_guestlist_activity" to "anon";

grant references on table "public"."client_guestlist_activity" to "anon";

grant select on table "public"."client_guestlist_activity" to "anon";

grant trigger on table "public"."client_guestlist_activity" to "anon";

grant truncate on table "public"."client_guestlist_activity" to "anon";

grant update on table "public"."client_guestlist_activity" to "anon";

grant delete on table "public"."client_guestlist_activity" to "authenticated";

grant insert on table "public"."client_guestlist_activity" to "authenticated";

grant references on table "public"."client_guestlist_activity" to "authenticated";

grant select on table "public"."client_guestlist_activity" to "authenticated";

grant trigger on table "public"."client_guestlist_activity" to "authenticated";

grant truncate on table "public"."client_guestlist_activity" to "authenticated";

grant update on table "public"."client_guestlist_activity" to "authenticated";

grant delete on table "public"."client_guestlist_activity" to "service_role";

grant insert on table "public"."client_guestlist_activity" to "service_role";

grant references on table "public"."client_guestlist_activity" to "service_role";

grant select on table "public"."client_guestlist_activity" to "service_role";

grant trigger on table "public"."client_guestlist_activity" to "service_role";

grant truncate on table "public"."client_guestlist_activity" to "service_role";

grant update on table "public"."client_guestlist_activity" to "service_role";

grant delete on table "public"."clients" to "anon";

grant insert on table "public"."clients" to "anon";

grant references on table "public"."clients" to "anon";

grant select on table "public"."clients" to "anon";

grant trigger on table "public"."clients" to "anon";

grant truncate on table "public"."clients" to "anon";

grant update on table "public"."clients" to "anon";

grant delete on table "public"."clients" to "authenticated";

grant insert on table "public"."clients" to "authenticated";

grant references on table "public"."clients" to "authenticated";

grant select on table "public"."clients" to "authenticated";

grant trigger on table "public"."clients" to "authenticated";

grant truncate on table "public"."clients" to "authenticated";

grant update on table "public"."clients" to "authenticated";

grant delete on table "public"."clients" to "service_role";

grant insert on table "public"."clients" to "service_role";

grant references on table "public"."clients" to "service_role";

grant select on table "public"."clients" to "service_role";

grant trigger on table "public"."clients" to "service_role";

grant truncate on table "public"."clients" to "service_role";

grant update on table "public"."clients" to "service_role";

grant delete on table "public"."club_accounts" to "anon";

grant insert on table "public"."club_accounts" to "anon";

grant references on table "public"."club_accounts" to "anon";

grant select on table "public"."club_accounts" to "anon";

grant trigger on table "public"."club_accounts" to "anon";

grant truncate on table "public"."club_accounts" to "anon";

grant update on table "public"."club_accounts" to "anon";

grant delete on table "public"."club_accounts" to "authenticated";

grant insert on table "public"."club_accounts" to "authenticated";

grant references on table "public"."club_accounts" to "authenticated";

grant select on table "public"."club_accounts" to "authenticated";

grant trigger on table "public"."club_accounts" to "authenticated";

grant truncate on table "public"."club_accounts" to "authenticated";

grant update on table "public"."club_accounts" to "authenticated";

grant delete on table "public"."club_accounts" to "service_role";

grant insert on table "public"."club_accounts" to "service_role";

grant references on table "public"."club_accounts" to "service_role";

grant select on table "public"."club_accounts" to "service_role";

grant trigger on table "public"."club_accounts" to "service_role";

grant truncate on table "public"."club_accounts" to "service_role";

grant update on table "public"."club_accounts" to "service_role";

grant delete on table "public"."club_edit_revisions" to "anon";

grant insert on table "public"."club_edit_revisions" to "anon";

grant references on table "public"."club_edit_revisions" to "anon";

grant select on table "public"."club_edit_revisions" to "anon";

grant trigger on table "public"."club_edit_revisions" to "anon";

grant truncate on table "public"."club_edit_revisions" to "anon";

grant update on table "public"."club_edit_revisions" to "anon";

grant delete on table "public"."club_edit_revisions" to "authenticated";

grant insert on table "public"."club_edit_revisions" to "authenticated";

grant references on table "public"."club_edit_revisions" to "authenticated";

grant select on table "public"."club_edit_revisions" to "authenticated";

grant trigger on table "public"."club_edit_revisions" to "authenticated";

grant truncate on table "public"."club_edit_revisions" to "authenticated";

grant update on table "public"."club_edit_revisions" to "authenticated";

grant delete on table "public"."club_edit_revisions" to "service_role";

grant insert on table "public"."club_edit_revisions" to "service_role";

grant references on table "public"."club_edit_revisions" to "service_role";

grant select on table "public"."club_edit_revisions" to "service_role";

grant trigger on table "public"."club_edit_revisions" to "service_role";

grant truncate on table "public"."club_edit_revisions" to "service_role";

grant update on table "public"."club_edit_revisions" to "service_role";

grant delete on table "public"."club_weekly_flyers" to "anon";

grant insert on table "public"."club_weekly_flyers" to "anon";

grant references on table "public"."club_weekly_flyers" to "anon";

grant select on table "public"."club_weekly_flyers" to "anon";

grant trigger on table "public"."club_weekly_flyers" to "anon";

grant truncate on table "public"."club_weekly_flyers" to "anon";

grant update on table "public"."club_weekly_flyers" to "anon";

grant delete on table "public"."club_weekly_flyers" to "authenticated";

grant insert on table "public"."club_weekly_flyers" to "authenticated";

grant references on table "public"."club_weekly_flyers" to "authenticated";

grant select on table "public"."club_weekly_flyers" to "authenticated";

grant trigger on table "public"."club_weekly_flyers" to "authenticated";

grant truncate on table "public"."club_weekly_flyers" to "authenticated";

grant update on table "public"."club_weekly_flyers" to "authenticated";

grant delete on table "public"."club_weekly_flyers" to "service_role";

grant insert on table "public"."club_weekly_flyers" to "service_role";

grant references on table "public"."club_weekly_flyers" to "service_role";

grant select on table "public"."club_weekly_flyers" to "service_role";

grant trigger on table "public"."club_weekly_flyers" to "service_role";

grant truncate on table "public"."club_weekly_flyers" to "service_role";

grant update on table "public"."club_weekly_flyers" to "service_role";

grant delete on table "public"."clubs" to "anon";

grant insert on table "public"."clubs" to "anon";

grant references on table "public"."clubs" to "anon";

grant select on table "public"."clubs" to "anon";

grant trigger on table "public"."clubs" to "anon";

grant truncate on table "public"."clubs" to "anon";

grant update on table "public"."clubs" to "anon";

grant delete on table "public"."clubs" to "authenticated";

grant insert on table "public"."clubs" to "authenticated";

grant references on table "public"."clubs" to "authenticated";

grant select on table "public"."clubs" to "authenticated";

grant trigger on table "public"."clubs" to "authenticated";

grant truncate on table "public"."clubs" to "authenticated";

grant update on table "public"."clubs" to "authenticated";

grant delete on table "public"."clubs" to "service_role";

grant insert on table "public"."clubs" to "service_role";

grant references on table "public"."clubs" to "service_role";

grant select on table "public"."clubs" to "service_role";

grant trigger on table "public"."clubs" to "service_role";

grant truncate on table "public"."clubs" to "service_role";

grant update on table "public"."clubs" to "service_role";

grant delete on table "public"."enquiries" to "anon";

grant insert on table "public"."enquiries" to "anon";

grant references on table "public"."enquiries" to "anon";

grant select on table "public"."enquiries" to "anon";

grant trigger on table "public"."enquiries" to "anon";

grant truncate on table "public"."enquiries" to "anon";

grant update on table "public"."enquiries" to "anon";

grant delete on table "public"."enquiries" to "authenticated";

grant insert on table "public"."enquiries" to "authenticated";

grant references on table "public"."enquiries" to "authenticated";

grant select on table "public"."enquiries" to "authenticated";

grant trigger on table "public"."enquiries" to "authenticated";

grant truncate on table "public"."enquiries" to "authenticated";

grant update on table "public"."enquiries" to "authenticated";

grant delete on table "public"."enquiries" to "service_role";

grant insert on table "public"."enquiries" to "service_role";

grant references on table "public"."enquiries" to "service_role";

grant select on table "public"."enquiries" to "service_role";

grant trigger on table "public"."enquiries" to "service_role";

grant truncate on table "public"."enquiries" to "service_role";

grant update on table "public"."enquiries" to "service_role";

grant delete on table "public"."enquiry_guests" to "anon";

grant insert on table "public"."enquiry_guests" to "anon";

grant references on table "public"."enquiry_guests" to "anon";

grant select on table "public"."enquiry_guests" to "anon";

grant trigger on table "public"."enquiry_guests" to "anon";

grant truncate on table "public"."enquiry_guests" to "anon";

grant update on table "public"."enquiry_guests" to "anon";

grant delete on table "public"."enquiry_guests" to "authenticated";

grant insert on table "public"."enquiry_guests" to "authenticated";

grant references on table "public"."enquiry_guests" to "authenticated";

grant select on table "public"."enquiry_guests" to "authenticated";

grant trigger on table "public"."enquiry_guests" to "authenticated";

grant truncate on table "public"."enquiry_guests" to "authenticated";

grant update on table "public"."enquiry_guests" to "authenticated";

grant delete on table "public"."enquiry_guests" to "service_role";

grant insert on table "public"."enquiry_guests" to "service_role";

grant references on table "public"."enquiry_guests" to "service_role";

grant select on table "public"."enquiry_guests" to "service_role";

grant trigger on table "public"."enquiry_guests" to "service_role";

grant truncate on table "public"."enquiry_guests" to "service_role";

grant update on table "public"."enquiry_guests" to "service_role";

grant delete on table "public"."financial_booking_nightlife" to "anon";

grant insert on table "public"."financial_booking_nightlife" to "anon";

grant references on table "public"."financial_booking_nightlife" to "anon";

grant select on table "public"."financial_booking_nightlife" to "anon";

grant trigger on table "public"."financial_booking_nightlife" to "anon";

grant truncate on table "public"."financial_booking_nightlife" to "anon";

grant update on table "public"."financial_booking_nightlife" to "anon";

grant delete on table "public"."financial_booking_nightlife" to "authenticated";

grant insert on table "public"."financial_booking_nightlife" to "authenticated";

grant references on table "public"."financial_booking_nightlife" to "authenticated";

grant select on table "public"."financial_booking_nightlife" to "authenticated";

grant trigger on table "public"."financial_booking_nightlife" to "authenticated";

grant truncate on table "public"."financial_booking_nightlife" to "authenticated";

grant update on table "public"."financial_booking_nightlife" to "authenticated";

grant delete on table "public"."financial_booking_nightlife" to "service_role";

grant insert on table "public"."financial_booking_nightlife" to "service_role";

grant references on table "public"."financial_booking_nightlife" to "service_role";

grant select on table "public"."financial_booking_nightlife" to "service_role";

grant trigger on table "public"."financial_booking_nightlife" to "service_role";

grant truncate on table "public"."financial_booking_nightlife" to "service_role";

grant update on table "public"."financial_booking_nightlife" to "service_role";

grant delete on table "public"."financial_booking_service" to "anon";

grant insert on table "public"."financial_booking_service" to "anon";

grant references on table "public"."financial_booking_service" to "anon";

grant select on table "public"."financial_booking_service" to "anon";

grant trigger on table "public"."financial_booking_service" to "anon";

grant truncate on table "public"."financial_booking_service" to "anon";

grant update on table "public"."financial_booking_service" to "anon";

grant delete on table "public"."financial_booking_service" to "authenticated";

grant insert on table "public"."financial_booking_service" to "authenticated";

grant references on table "public"."financial_booking_service" to "authenticated";

grant select on table "public"."financial_booking_service" to "authenticated";

grant trigger on table "public"."financial_booking_service" to "authenticated";

grant truncate on table "public"."financial_booking_service" to "authenticated";

grant update on table "public"."financial_booking_service" to "authenticated";

grant delete on table "public"."financial_booking_service" to "service_role";

grant insert on table "public"."financial_booking_service" to "service_role";

grant references on table "public"."financial_booking_service" to "service_role";

grant select on table "public"."financial_booking_service" to "service_role";

grant trigger on table "public"."financial_booking_service" to "service_role";

grant truncate on table "public"."financial_booking_service" to "service_role";

grant update on table "public"."financial_booking_service" to "service_role";

grant delete on table "public"."financial_bookings" to "anon";

grant insert on table "public"."financial_bookings" to "anon";

grant references on table "public"."financial_bookings" to "anon";

grant select on table "public"."financial_bookings" to "anon";

grant trigger on table "public"."financial_bookings" to "anon";

grant truncate on table "public"."financial_bookings" to "anon";

grant update on table "public"."financial_bookings" to "anon";

grant delete on table "public"."financial_bookings" to "authenticated";

grant insert on table "public"."financial_bookings" to "authenticated";

grant references on table "public"."financial_bookings" to "authenticated";

grant select on table "public"."financial_bookings" to "authenticated";

grant trigger on table "public"."financial_bookings" to "authenticated";

grant truncate on table "public"."financial_bookings" to "authenticated";

grant update on table "public"."financial_bookings" to "authenticated";

grant delete on table "public"."financial_bookings" to "service_role";

grant insert on table "public"."financial_bookings" to "service_role";

grant references on table "public"."financial_bookings" to "service_role";

grant select on table "public"."financial_bookings" to "service_role";

grant trigger on table "public"."financial_bookings" to "service_role";

grant truncate on table "public"."financial_bookings" to "service_role";

grant update on table "public"."financial_bookings" to "service_role";

grant delete on table "public"."financial_config_change_requests" to "anon";

grant insert on table "public"."financial_config_change_requests" to "anon";

grant references on table "public"."financial_config_change_requests" to "anon";

grant select on table "public"."financial_config_change_requests" to "anon";

grant trigger on table "public"."financial_config_change_requests" to "anon";

grant truncate on table "public"."financial_config_change_requests" to "anon";

grant update on table "public"."financial_config_change_requests" to "anon";

grant delete on table "public"."financial_config_change_requests" to "authenticated";

grant insert on table "public"."financial_config_change_requests" to "authenticated";

grant references on table "public"."financial_config_change_requests" to "authenticated";

grant select on table "public"."financial_config_change_requests" to "authenticated";

grant trigger on table "public"."financial_config_change_requests" to "authenticated";

grant truncate on table "public"."financial_config_change_requests" to "authenticated";

grant update on table "public"."financial_config_change_requests" to "authenticated";

grant delete on table "public"."financial_config_change_requests" to "service_role";

grant insert on table "public"."financial_config_change_requests" to "service_role";

grant references on table "public"."financial_config_change_requests" to "service_role";

grant select on table "public"."financial_config_change_requests" to "service_role";

grant trigger on table "public"."financial_config_change_requests" to "service_role";

grant truncate on table "public"."financial_config_change_requests" to "service_role";

grant update on table "public"."financial_config_change_requests" to "service_role";

grant delete on table "public"."financial_payees" to "anon";

grant insert on table "public"."financial_payees" to "anon";

grant references on table "public"."financial_payees" to "anon";

grant select on table "public"."financial_payees" to "anon";

grant trigger on table "public"."financial_payees" to "anon";

grant truncate on table "public"."financial_payees" to "anon";

grant update on table "public"."financial_payees" to "anon";

grant delete on table "public"."financial_payees" to "authenticated";

grant insert on table "public"."financial_payees" to "authenticated";

grant references on table "public"."financial_payees" to "authenticated";

grant select on table "public"."financial_payees" to "authenticated";

grant trigger on table "public"."financial_payees" to "authenticated";

grant truncate on table "public"."financial_payees" to "authenticated";

grant update on table "public"."financial_payees" to "authenticated";

grant delete on table "public"."financial_payees" to "service_role";

grant insert on table "public"."financial_payees" to "service_role";

grant references on table "public"."financial_payees" to "service_role";

grant select on table "public"."financial_payees" to "service_role";

grant trigger on table "public"."financial_payees" to "service_role";

grant truncate on table "public"."financial_payees" to "service_role";

grant update on table "public"."financial_payees" to "service_role";

grant delete on table "public"."financial_promoters" to "anon";

grant insert on table "public"."financial_promoters" to "anon";

grant references on table "public"."financial_promoters" to "anon";

grant select on table "public"."financial_promoters" to "anon";

grant trigger on table "public"."financial_promoters" to "anon";

grant truncate on table "public"."financial_promoters" to "anon";

grant update on table "public"."financial_promoters" to "anon";

grant delete on table "public"."financial_promoters" to "authenticated";

grant insert on table "public"."financial_promoters" to "authenticated";

grant references on table "public"."financial_promoters" to "authenticated";

grant select on table "public"."financial_promoters" to "authenticated";

grant trigger on table "public"."financial_promoters" to "authenticated";

grant truncate on table "public"."financial_promoters" to "authenticated";

grant update on table "public"."financial_promoters" to "authenticated";

grant delete on table "public"."financial_promoters" to "service_role";

grant insert on table "public"."financial_promoters" to "service_role";

grant references on table "public"."financial_promoters" to "service_role";

grant select on table "public"."financial_promoters" to "service_role";

grant trigger on table "public"."financial_promoters" to "service_role";

grant truncate on table "public"."financial_promoters" to "service_role";

grant update on table "public"."financial_promoters" to "service_role";

grant delete on table "public"."financial_recurring_templates" to "anon";

grant insert on table "public"."financial_recurring_templates" to "anon";

grant references on table "public"."financial_recurring_templates" to "anon";

grant select on table "public"."financial_recurring_templates" to "anon";

grant trigger on table "public"."financial_recurring_templates" to "anon";

grant truncate on table "public"."financial_recurring_templates" to "anon";

grant update on table "public"."financial_recurring_templates" to "anon";

grant delete on table "public"."financial_recurring_templates" to "authenticated";

grant insert on table "public"."financial_recurring_templates" to "authenticated";

grant references on table "public"."financial_recurring_templates" to "authenticated";

grant select on table "public"."financial_recurring_templates" to "authenticated";

grant trigger on table "public"."financial_recurring_templates" to "authenticated";

grant truncate on table "public"."financial_recurring_templates" to "authenticated";

grant update on table "public"."financial_recurring_templates" to "authenticated";

grant delete on table "public"."financial_recurring_templates" to "service_role";

grant insert on table "public"."financial_recurring_templates" to "service_role";

grant references on table "public"."financial_recurring_templates" to "service_role";

grant select on table "public"."financial_recurring_templates" to "service_role";

grant trigger on table "public"."financial_recurring_templates" to "service_role";

grant truncate on table "public"."financial_recurring_templates" to "service_role";

grant update on table "public"."financial_recurring_templates" to "service_role";

grant delete on table "public"."financial_rules" to "anon";

grant insert on table "public"."financial_rules" to "anon";

grant references on table "public"."financial_rules" to "anon";

grant select on table "public"."financial_rules" to "anon";

grant trigger on table "public"."financial_rules" to "anon";

grant truncate on table "public"."financial_rules" to "anon";

grant update on table "public"."financial_rules" to "anon";

grant delete on table "public"."financial_rules" to "authenticated";

grant insert on table "public"."financial_rules" to "authenticated";

grant references on table "public"."financial_rules" to "authenticated";

grant select on table "public"."financial_rules" to "authenticated";

grant trigger on table "public"."financial_rules" to "authenticated";

grant truncate on table "public"."financial_rules" to "authenticated";

grant update on table "public"."financial_rules" to "authenticated";

grant delete on table "public"."financial_rules" to "service_role";

grant insert on table "public"."financial_rules" to "service_role";

grant references on table "public"."financial_rules" to "service_role";

grant select on table "public"."financial_rules" to "service_role";

grant trigger on table "public"."financial_rules" to "service_role";

grant truncate on table "public"."financial_rules" to "service_role";

grant update on table "public"."financial_rules" to "service_role";

grant delete on table "public"."financial_transactions" to "anon";

grant insert on table "public"."financial_transactions" to "anon";

grant references on table "public"."financial_transactions" to "anon";

grant select on table "public"."financial_transactions" to "anon";

grant trigger on table "public"."financial_transactions" to "anon";

grant truncate on table "public"."financial_transactions" to "anon";

grant update on table "public"."financial_transactions" to "anon";

grant delete on table "public"."financial_transactions" to "authenticated";

grant insert on table "public"."financial_transactions" to "authenticated";

grant references on table "public"."financial_transactions" to "authenticated";

grant select on table "public"."financial_transactions" to "authenticated";

grant trigger on table "public"."financial_transactions" to "authenticated";

grant truncate on table "public"."financial_transactions" to "authenticated";

grant update on table "public"."financial_transactions" to "authenticated";

grant delete on table "public"."financial_transactions" to "service_role";

grant insert on table "public"."financial_transactions" to "service_role";

grant references on table "public"."financial_transactions" to "service_role";

grant select on table "public"."financial_transactions" to "service_role";

grant trigger on table "public"."financial_transactions" to "service_role";

grant truncate on table "public"."financial_transactions" to "service_role";

grant update on table "public"."financial_transactions" to "service_role";

grant delete on table "public"."guest_identity_links" to "anon";

grant insert on table "public"."guest_identity_links" to "anon";

grant references on table "public"."guest_identity_links" to "anon";

grant select on table "public"."guest_identity_links" to "anon";

grant trigger on table "public"."guest_identity_links" to "anon";

grant truncate on table "public"."guest_identity_links" to "anon";

grant update on table "public"."guest_identity_links" to "anon";

grant delete on table "public"."guest_identity_links" to "authenticated";

grant insert on table "public"."guest_identity_links" to "authenticated";

grant references on table "public"."guest_identity_links" to "authenticated";

grant select on table "public"."guest_identity_links" to "authenticated";

grant trigger on table "public"."guest_identity_links" to "authenticated";

grant truncate on table "public"."guest_identity_links" to "authenticated";

grant update on table "public"."guest_identity_links" to "authenticated";

grant delete on table "public"."guest_identity_links" to "service_role";

grant insert on table "public"."guest_identity_links" to "service_role";

grant references on table "public"."guest_identity_links" to "service_role";

grant select on table "public"."guest_identity_links" to "service_role";

grant trigger on table "public"."guest_identity_links" to "service_role";

grant truncate on table "public"."guest_identity_links" to "service_role";

grant update on table "public"."guest_identity_links" to "service_role";

grant delete on table "public"."guest_profiles" to "anon";

grant insert on table "public"."guest_profiles" to "anon";

grant references on table "public"."guest_profiles" to "anon";

grant select on table "public"."guest_profiles" to "anon";

grant trigger on table "public"."guest_profiles" to "anon";

grant truncate on table "public"."guest_profiles" to "anon";

grant update on table "public"."guest_profiles" to "anon";

grant delete on table "public"."guest_profiles" to "authenticated";

grant insert on table "public"."guest_profiles" to "authenticated";

grant references on table "public"."guest_profiles" to "authenticated";

grant select on table "public"."guest_profiles" to "authenticated";

grant trigger on table "public"."guest_profiles" to "authenticated";

grant truncate on table "public"."guest_profiles" to "authenticated";

grant update on table "public"."guest_profiles" to "authenticated";

grant delete on table "public"."guest_profiles" to "service_role";

grant insert on table "public"."guest_profiles" to "service_role";

grant references on table "public"."guest_profiles" to "service_role";

grant select on table "public"."guest_profiles" to "service_role";

grant trigger on table "public"."guest_profiles" to "service_role";

grant truncate on table "public"."guest_profiles" to "service_role";

grant update on table "public"."guest_profiles" to "service_role";

grant delete on table "public"."guestlist_checkins" to "anon";

grant insert on table "public"."guestlist_checkins" to "anon";

grant references on table "public"."guestlist_checkins" to "anon";

grant select on table "public"."guestlist_checkins" to "anon";

grant trigger on table "public"."guestlist_checkins" to "anon";

grant truncate on table "public"."guestlist_checkins" to "anon";

grant update on table "public"."guestlist_checkins" to "anon";

grant delete on table "public"."guestlist_checkins" to "authenticated";

grant insert on table "public"."guestlist_checkins" to "authenticated";

grant references on table "public"."guestlist_checkins" to "authenticated";

grant select on table "public"."guestlist_checkins" to "authenticated";

grant trigger on table "public"."guestlist_checkins" to "authenticated";

grant truncate on table "public"."guestlist_checkins" to "authenticated";

grant update on table "public"."guestlist_checkins" to "authenticated";

grant delete on table "public"."guestlist_checkins" to "service_role";

grant insert on table "public"."guestlist_checkins" to "service_role";

grant references on table "public"."guestlist_checkins" to "service_role";

grant select on table "public"."guestlist_checkins" to "service_role";

grant trigger on table "public"."guestlist_checkins" to "service_role";

grant truncate on table "public"."guestlist_checkins" to "service_role";

grant update on table "public"."guestlist_checkins" to "service_role";

grant delete on table "public"."guestlist_demographics" to "anon";

grant insert on table "public"."guestlist_demographics" to "anon";

grant references on table "public"."guestlist_demographics" to "anon";

grant select on table "public"."guestlist_demographics" to "anon";

grant trigger on table "public"."guestlist_demographics" to "anon";

grant truncate on table "public"."guestlist_demographics" to "anon";

grant update on table "public"."guestlist_demographics" to "anon";

grant delete on table "public"."guestlist_demographics" to "authenticated";

grant insert on table "public"."guestlist_demographics" to "authenticated";

grant references on table "public"."guestlist_demographics" to "authenticated";

grant select on table "public"."guestlist_demographics" to "authenticated";

grant trigger on table "public"."guestlist_demographics" to "authenticated";

grant truncate on table "public"."guestlist_demographics" to "authenticated";

grant update on table "public"."guestlist_demographics" to "authenticated";

grant delete on table "public"."guestlist_demographics" to "service_role";

grant insert on table "public"."guestlist_demographics" to "service_role";

grant references on table "public"."guestlist_demographics" to "service_role";

grant select on table "public"."guestlist_demographics" to "service_role";

grant trigger on table "public"."guestlist_demographics" to "service_role";

grant truncate on table "public"."guestlist_demographics" to "service_role";

grant update on table "public"."guestlist_demographics" to "service_role";

grant delete on table "public"."guestlist_events" to "anon";

grant insert on table "public"."guestlist_events" to "anon";

grant references on table "public"."guestlist_events" to "anon";

grant select on table "public"."guestlist_events" to "anon";

grant trigger on table "public"."guestlist_events" to "anon";

grant truncate on table "public"."guestlist_events" to "anon";

grant update on table "public"."guestlist_events" to "anon";

grant delete on table "public"."guestlist_events" to "authenticated";

grant insert on table "public"."guestlist_events" to "authenticated";

grant references on table "public"."guestlist_events" to "authenticated";

grant select on table "public"."guestlist_events" to "authenticated";

grant trigger on table "public"."guestlist_events" to "authenticated";

grant truncate on table "public"."guestlist_events" to "authenticated";

grant update on table "public"."guestlist_events" to "authenticated";

grant delete on table "public"."guestlist_events" to "service_role";

grant insert on table "public"."guestlist_events" to "service_role";

grant references on table "public"."guestlist_events" to "service_role";

grant select on table "public"."guestlist_events" to "service_role";

grant trigger on table "public"."guestlist_events" to "service_role";

grant truncate on table "public"."guestlist_events" to "service_role";

grant update on table "public"."guestlist_events" to "service_role";

grant delete on table "public"."guestlist_signups" to "anon";

grant insert on table "public"."guestlist_signups" to "anon";

grant references on table "public"."guestlist_signups" to "anon";

grant select on table "public"."guestlist_signups" to "anon";

grant trigger on table "public"."guestlist_signups" to "anon";

grant truncate on table "public"."guestlist_signups" to "anon";

grant update on table "public"."guestlist_signups" to "anon";

grant delete on table "public"."guestlist_signups" to "authenticated";

grant insert on table "public"."guestlist_signups" to "authenticated";

grant references on table "public"."guestlist_signups" to "authenticated";

grant select on table "public"."guestlist_signups" to "authenticated";

grant trigger on table "public"."guestlist_signups" to "authenticated";

grant truncate on table "public"."guestlist_signups" to "authenticated";

grant update on table "public"."guestlist_signups" to "authenticated";

grant delete on table "public"."guestlist_signups" to "service_role";

grant insert on table "public"."guestlist_signups" to "service_role";

grant references on table "public"."guestlist_signups" to "service_role";

grant select on table "public"."guestlist_signups" to "service_role";

grant trigger on table "public"."guestlist_signups" to "service_role";

grant truncate on table "public"."guestlist_signups" to "service_role";

grant update on table "public"."guestlist_signups" to "service_role";

grant delete on table "public"."job_disputes" to "anon";

grant insert on table "public"."job_disputes" to "anon";

grant references on table "public"."job_disputes" to "anon";

grant select on table "public"."job_disputes" to "anon";

grant trigger on table "public"."job_disputes" to "anon";

grant truncate on table "public"."job_disputes" to "anon";

grant update on table "public"."job_disputes" to "anon";

grant delete on table "public"."job_disputes" to "authenticated";

grant insert on table "public"."job_disputes" to "authenticated";

grant references on table "public"."job_disputes" to "authenticated";

grant select on table "public"."job_disputes" to "authenticated";

grant trigger on table "public"."job_disputes" to "authenticated";

grant truncate on table "public"."job_disputes" to "authenticated";

grant update on table "public"."job_disputes" to "authenticated";

grant delete on table "public"."job_disputes" to "service_role";

grant insert on table "public"."job_disputes" to "service_role";

grant references on table "public"."job_disputes" to "service_role";

grant select on table "public"."job_disputes" to "service_role";

grant trigger on table "public"."job_disputes" to "service_role";

grant truncate on table "public"."job_disputes" to "service_role";

grant update on table "public"."job_disputes" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."promoter_availability" to "anon";

grant insert on table "public"."promoter_availability" to "anon";

grant references on table "public"."promoter_availability" to "anon";

grant select on table "public"."promoter_availability" to "anon";

grant trigger on table "public"."promoter_availability" to "anon";

grant truncate on table "public"."promoter_availability" to "anon";

grant update on table "public"."promoter_availability" to "anon";

grant delete on table "public"."promoter_availability" to "authenticated";

grant insert on table "public"."promoter_availability" to "authenticated";

grant references on table "public"."promoter_availability" to "authenticated";

grant select on table "public"."promoter_availability" to "authenticated";

grant trigger on table "public"."promoter_availability" to "authenticated";

grant truncate on table "public"."promoter_availability" to "authenticated";

grant update on table "public"."promoter_availability" to "authenticated";

grant delete on table "public"."promoter_availability" to "service_role";

grant insert on table "public"."promoter_availability" to "service_role";

grant references on table "public"."promoter_availability" to "service_role";

grant select on table "public"."promoter_availability" to "service_role";

grant trigger on table "public"."promoter_availability" to "service_role";

grant truncate on table "public"."promoter_availability" to "service_role";

grant update on table "public"."promoter_availability" to "service_role";

grant delete on table "public"."promoter_club_preferences" to "anon";

grant insert on table "public"."promoter_club_preferences" to "anon";

grant references on table "public"."promoter_club_preferences" to "anon";

grant select on table "public"."promoter_club_preferences" to "anon";

grant trigger on table "public"."promoter_club_preferences" to "anon";

grant truncate on table "public"."promoter_club_preferences" to "anon";

grant update on table "public"."promoter_club_preferences" to "anon";

grant delete on table "public"."promoter_club_preferences" to "authenticated";

grant insert on table "public"."promoter_club_preferences" to "authenticated";

grant references on table "public"."promoter_club_preferences" to "authenticated";

grant select on table "public"."promoter_club_preferences" to "authenticated";

grant trigger on table "public"."promoter_club_preferences" to "authenticated";

grant truncate on table "public"."promoter_club_preferences" to "authenticated";

grant update on table "public"."promoter_club_preferences" to "authenticated";

grant delete on table "public"."promoter_club_preferences" to "service_role";

grant insert on table "public"."promoter_club_preferences" to "service_role";

grant references on table "public"."promoter_club_preferences" to "service_role";

grant select on table "public"."promoter_club_preferences" to "service_role";

grant trigger on table "public"."promoter_club_preferences" to "service_role";

grant truncate on table "public"."promoter_club_preferences" to "service_role";

grant update on table "public"."promoter_club_preferences" to "service_role";

grant delete on table "public"."promoter_earnings" to "anon";

grant insert on table "public"."promoter_earnings" to "anon";

grant references on table "public"."promoter_earnings" to "anon";

grant select on table "public"."promoter_earnings" to "anon";

grant trigger on table "public"."promoter_earnings" to "anon";

grant truncate on table "public"."promoter_earnings" to "anon";

grant update on table "public"."promoter_earnings" to "anon";

grant delete on table "public"."promoter_earnings" to "authenticated";

grant insert on table "public"."promoter_earnings" to "authenticated";

grant references on table "public"."promoter_earnings" to "authenticated";

grant select on table "public"."promoter_earnings" to "authenticated";

grant trigger on table "public"."promoter_earnings" to "authenticated";

grant truncate on table "public"."promoter_earnings" to "authenticated";

grant update on table "public"."promoter_earnings" to "authenticated";

grant delete on table "public"."promoter_earnings" to "service_role";

grant insert on table "public"."promoter_earnings" to "service_role";

grant references on table "public"."promoter_earnings" to "service_role";

grant select on table "public"."promoter_earnings" to "service_role";

grant trigger on table "public"."promoter_earnings" to "service_role";

grant truncate on table "public"."promoter_earnings" to "service_role";

grant update on table "public"."promoter_earnings" to "service_role";

grant delete on table "public"."promoter_guestlist_entries" to "anon";

grant insert on table "public"."promoter_guestlist_entries" to "anon";

grant references on table "public"."promoter_guestlist_entries" to "anon";

grant select on table "public"."promoter_guestlist_entries" to "anon";

grant trigger on table "public"."promoter_guestlist_entries" to "anon";

grant truncate on table "public"."promoter_guestlist_entries" to "anon";

grant update on table "public"."promoter_guestlist_entries" to "anon";

grant delete on table "public"."promoter_guestlist_entries" to "authenticated";

grant insert on table "public"."promoter_guestlist_entries" to "authenticated";

grant references on table "public"."promoter_guestlist_entries" to "authenticated";

grant select on table "public"."promoter_guestlist_entries" to "authenticated";

grant trigger on table "public"."promoter_guestlist_entries" to "authenticated";

grant truncate on table "public"."promoter_guestlist_entries" to "authenticated";

grant update on table "public"."promoter_guestlist_entries" to "authenticated";

grant delete on table "public"."promoter_guestlist_entries" to "service_role";

grant insert on table "public"."promoter_guestlist_entries" to "service_role";

grant references on table "public"."promoter_guestlist_entries" to "service_role";

grant select on table "public"."promoter_guestlist_entries" to "service_role";

grant trigger on table "public"."promoter_guestlist_entries" to "service_role";

grant truncate on table "public"."promoter_guestlist_entries" to "service_role";

grant update on table "public"."promoter_guestlist_entries" to "service_role";

grant delete on table "public"."promoter_invoice_lines" to "anon";

grant insert on table "public"."promoter_invoice_lines" to "anon";

grant references on table "public"."promoter_invoice_lines" to "anon";

grant select on table "public"."promoter_invoice_lines" to "anon";

grant trigger on table "public"."promoter_invoice_lines" to "anon";

grant truncate on table "public"."promoter_invoice_lines" to "anon";

grant update on table "public"."promoter_invoice_lines" to "anon";

grant delete on table "public"."promoter_invoice_lines" to "authenticated";

grant insert on table "public"."promoter_invoice_lines" to "authenticated";

grant references on table "public"."promoter_invoice_lines" to "authenticated";

grant select on table "public"."promoter_invoice_lines" to "authenticated";

grant trigger on table "public"."promoter_invoice_lines" to "authenticated";

grant truncate on table "public"."promoter_invoice_lines" to "authenticated";

grant update on table "public"."promoter_invoice_lines" to "authenticated";

grant delete on table "public"."promoter_invoice_lines" to "service_role";

grant insert on table "public"."promoter_invoice_lines" to "service_role";

grant references on table "public"."promoter_invoice_lines" to "service_role";

grant select on table "public"."promoter_invoice_lines" to "service_role";

grant trigger on table "public"."promoter_invoice_lines" to "service_role";

grant truncate on table "public"."promoter_invoice_lines" to "service_role";

grant update on table "public"."promoter_invoice_lines" to "service_role";

grant delete on table "public"."promoter_invoices" to "anon";

grant insert on table "public"."promoter_invoices" to "anon";

grant references on table "public"."promoter_invoices" to "anon";

grant select on table "public"."promoter_invoices" to "anon";

grant trigger on table "public"."promoter_invoices" to "anon";

grant truncate on table "public"."promoter_invoices" to "anon";

grant update on table "public"."promoter_invoices" to "anon";

grant delete on table "public"."promoter_invoices" to "authenticated";

grant insert on table "public"."promoter_invoices" to "authenticated";

grant references on table "public"."promoter_invoices" to "authenticated";

grant select on table "public"."promoter_invoices" to "authenticated";

grant trigger on table "public"."promoter_invoices" to "authenticated";

grant truncate on table "public"."promoter_invoices" to "authenticated";

grant update on table "public"."promoter_invoices" to "authenticated";

grant delete on table "public"."promoter_invoices" to "service_role";

grant insert on table "public"."promoter_invoices" to "service_role";

grant references on table "public"."promoter_invoices" to "service_role";

grant select on table "public"."promoter_invoices" to "service_role";

grant trigger on table "public"."promoter_invoices" to "service_role";

grant truncate on table "public"."promoter_invoices" to "service_role";

grant update on table "public"."promoter_invoices" to "service_role";

grant delete on table "public"."promoter_jobs" to "anon";

grant insert on table "public"."promoter_jobs" to "anon";

grant references on table "public"."promoter_jobs" to "anon";

grant select on table "public"."promoter_jobs" to "anon";

grant trigger on table "public"."promoter_jobs" to "anon";

grant truncate on table "public"."promoter_jobs" to "anon";

grant update on table "public"."promoter_jobs" to "anon";

grant delete on table "public"."promoter_jobs" to "authenticated";

grant insert on table "public"."promoter_jobs" to "authenticated";

grant references on table "public"."promoter_jobs" to "authenticated";

grant select on table "public"."promoter_jobs" to "authenticated";

grant trigger on table "public"."promoter_jobs" to "authenticated";

grant truncate on table "public"."promoter_jobs" to "authenticated";

grant update on table "public"."promoter_jobs" to "authenticated";

grant delete on table "public"."promoter_jobs" to "service_role";

grant insert on table "public"."promoter_jobs" to "service_role";

grant references on table "public"."promoter_jobs" to "service_role";

grant select on table "public"."promoter_jobs" to "service_role";

grant trigger on table "public"."promoter_jobs" to "service_role";

grant truncate on table "public"."promoter_jobs" to "service_role";

grant update on table "public"."promoter_jobs" to "service_role";

grant delete on table "public"."promoter_night_adjustments" to "anon";

grant insert on table "public"."promoter_night_adjustments" to "anon";

grant references on table "public"."promoter_night_adjustments" to "anon";

grant select on table "public"."promoter_night_adjustments" to "anon";

grant trigger on table "public"."promoter_night_adjustments" to "anon";

grant truncate on table "public"."promoter_night_adjustments" to "anon";

grant update on table "public"."promoter_night_adjustments" to "anon";

grant delete on table "public"."promoter_night_adjustments" to "authenticated";

grant insert on table "public"."promoter_night_adjustments" to "authenticated";

grant references on table "public"."promoter_night_adjustments" to "authenticated";

grant select on table "public"."promoter_night_adjustments" to "authenticated";

grant trigger on table "public"."promoter_night_adjustments" to "authenticated";

grant truncate on table "public"."promoter_night_adjustments" to "authenticated";

grant update on table "public"."promoter_night_adjustments" to "authenticated";

grant delete on table "public"."promoter_night_adjustments" to "service_role";

grant insert on table "public"."promoter_night_adjustments" to "service_role";

grant references on table "public"."promoter_night_adjustments" to "service_role";

grant select on table "public"."promoter_night_adjustments" to "service_role";

grant trigger on table "public"."promoter_night_adjustments" to "service_role";

grant truncate on table "public"."promoter_night_adjustments" to "service_role";

grant update on table "public"."promoter_night_adjustments" to "service_role";

grant delete on table "public"."promoter_profile_revisions" to "anon";

grant insert on table "public"."promoter_profile_revisions" to "anon";

grant references on table "public"."promoter_profile_revisions" to "anon";

grant select on table "public"."promoter_profile_revisions" to "anon";

grant trigger on table "public"."promoter_profile_revisions" to "anon";

grant truncate on table "public"."promoter_profile_revisions" to "anon";

grant update on table "public"."promoter_profile_revisions" to "anon";

grant delete on table "public"."promoter_profile_revisions" to "authenticated";

grant insert on table "public"."promoter_profile_revisions" to "authenticated";

grant references on table "public"."promoter_profile_revisions" to "authenticated";

grant select on table "public"."promoter_profile_revisions" to "authenticated";

grant trigger on table "public"."promoter_profile_revisions" to "authenticated";

grant truncate on table "public"."promoter_profile_revisions" to "authenticated";

grant update on table "public"."promoter_profile_revisions" to "authenticated";

grant delete on table "public"."promoter_profile_revisions" to "service_role";

grant insert on table "public"."promoter_profile_revisions" to "service_role";

grant references on table "public"."promoter_profile_revisions" to "service_role";

grant select on table "public"."promoter_profile_revisions" to "service_role";

grant trigger on table "public"."promoter_profile_revisions" to "service_role";

grant truncate on table "public"."promoter_profile_revisions" to "service_role";

grant update on table "public"."promoter_profile_revisions" to "service_role";

grant delete on table "public"."promoter_signup_requests" to "anon";

grant insert on table "public"."promoter_signup_requests" to "anon";

grant references on table "public"."promoter_signup_requests" to "anon";

grant select on table "public"."promoter_signup_requests" to "anon";

grant trigger on table "public"."promoter_signup_requests" to "anon";

grant truncate on table "public"."promoter_signup_requests" to "anon";

grant update on table "public"."promoter_signup_requests" to "anon";

grant delete on table "public"."promoter_signup_requests" to "authenticated";

grant insert on table "public"."promoter_signup_requests" to "authenticated";

grant references on table "public"."promoter_signup_requests" to "authenticated";

grant select on table "public"."promoter_signup_requests" to "authenticated";

grant trigger on table "public"."promoter_signup_requests" to "authenticated";

grant truncate on table "public"."promoter_signup_requests" to "authenticated";

grant update on table "public"."promoter_signup_requests" to "authenticated";

grant delete on table "public"."promoter_signup_requests" to "service_role";

grant insert on table "public"."promoter_signup_requests" to "service_role";

grant references on table "public"."promoter_signup_requests" to "service_role";

grant select on table "public"."promoter_signup_requests" to "service_role";

grant trigger on table "public"."promoter_signup_requests" to "service_role";

grant truncate on table "public"."promoter_signup_requests" to "service_role";

grant update on table "public"."promoter_signup_requests" to "service_role";

grant delete on table "public"."promoter_table_sales" to "anon";

grant insert on table "public"."promoter_table_sales" to "anon";

grant references on table "public"."promoter_table_sales" to "anon";

grant select on table "public"."promoter_table_sales" to "anon";

grant trigger on table "public"."promoter_table_sales" to "anon";

grant truncate on table "public"."promoter_table_sales" to "anon";

grant update on table "public"."promoter_table_sales" to "anon";

grant delete on table "public"."promoter_table_sales" to "authenticated";

grant insert on table "public"."promoter_table_sales" to "authenticated";

grant references on table "public"."promoter_table_sales" to "authenticated";

grant select on table "public"."promoter_table_sales" to "authenticated";

grant trigger on table "public"."promoter_table_sales" to "authenticated";

grant truncate on table "public"."promoter_table_sales" to "authenticated";

grant update on table "public"."promoter_table_sales" to "authenticated";

grant delete on table "public"."promoter_table_sales" to "service_role";

grant insert on table "public"."promoter_table_sales" to "service_role";

grant references on table "public"."promoter_table_sales" to "service_role";

grant select on table "public"."promoter_table_sales" to "service_role";

grant trigger on table "public"."promoter_table_sales" to "service_role";

grant truncate on table "public"."promoter_table_sales" to "service_role";

grant update on table "public"."promoter_table_sales" to "service_role";

grant delete on table "public"."promoters" to "anon";

grant insert on table "public"."promoters" to "anon";

grant references on table "public"."promoters" to "anon";

grant select on table "public"."promoters" to "anon";

grant trigger on table "public"."promoters" to "anon";

grant truncate on table "public"."promoters" to "anon";

grant update on table "public"."promoters" to "anon";

grant delete on table "public"."promoters" to "authenticated";

grant insert on table "public"."promoters" to "authenticated";

grant references on table "public"."promoters" to "authenticated";

grant select on table "public"."promoters" to "authenticated";

grant trigger on table "public"."promoters" to "authenticated";

grant truncate on table "public"."promoters" to "authenticated";

grant update on table "public"."promoters" to "authenticated";

grant delete on table "public"."promoters" to "service_role";

grant insert on table "public"."promoters" to "service_role";

grant references on table "public"."promoters" to "service_role";

grant select on table "public"."promoters" to "service_role";

grant trigger on table "public"."promoters" to "service_role";

grant truncate on table "public"."promoters" to "service_role";

grant update on table "public"."promoters" to "service_role";


  create policy "campaign_audience_members_admin"
  on "public"."campaign_audience_members"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "campaign_audiences_admin"
  on "public"."campaign_audiences"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "cars_admin_write"
  on "public"."cars"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "cars_public_read"
  on "public"."cars"
  as permissive
  for select
  to anon, authenticated
using ((is_active = true));



  create policy "client_attendances_admin_all"
  on "public"."client_attendances"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "client_attendances_promoter_delete"
  on "public"."client_attendances"
  as permissive
  for delete
  to authenticated
using ((promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)));



  create policy "client_attendances_promoter_select"
  on "public"."client_attendances"
  as permissive
  for select
  to authenticated
using (((promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)) OR (EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_attendances.client_id) AND (c.preferred_promoter_id = ( SELECT pr.id
           FROM public.promoters pr
          WHERE (pr.user_id = auth.uid())
         LIMIT 1)))))));



  create policy "client_attendances_promoter_update"
  on "public"."client_attendances"
  as permissive
  for update
  to authenticated
using ((promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)))
with check ((promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)));



  create policy "client_attendances_promoter_write"
  on "public"."client_attendances"
  as permissive
  for insert
  to authenticated
with check ((promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)));



  create policy "client_guestlist_activity_admin_all"
  on "public"."client_guestlist_activity"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "clients_admin_insert"
  on "public"."clients"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "clients_admin_select"
  on "public"."clients"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "clients_delete_admin"
  on "public"."clients"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "clients_insert_admin"
  on "public"."clients"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "clients_promoter_insert"
  on "public"."clients"
  as permissive
  for insert
  to authenticated
with check ((preferred_promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)));



  create policy "clients_promoter_select"
  on "public"."clients"
  as permissive
  for select
  to authenticated
using ((preferred_promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)));



  create policy "clients_promoter_update"
  on "public"."clients"
  as permissive
  for update
  to authenticated
using ((preferred_promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)))
with check ((preferred_promoter_id = ( SELECT pr.id
   FROM public.promoters pr
  WHERE (pr.user_id = auth.uid())
 LIMIT 1)));



  create policy "clients_select_admin"
  on "public"."clients"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "clients_update_admin"
  on "public"."clients"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "club_accounts_admin_or_owner_read"
  on "public"."club_accounts"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (user_id = auth.uid())));



  create policy "club_accounts_admin_write"
  on "public"."club_accounts"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "club_edit_revisions_admin_or_scoped"
  on "public"."club_edit_revisions"
  as permissive
  for all
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (submitted_by = auth.uid()) OR public.club_account_for_user(auth.uid(), club_slug)))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (submitted_by = auth.uid()) OR public.club_account_for_user(auth.uid(), club_slug)));



  create policy "flyers_admin_write"
  on "public"."club_weekly_flyers"
  as permissive
  for all
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.club_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.status = 'active'::text) AND (ca.club_slug = club_weekly_flyers.club_slug))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.club_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.status = 'active'::text) AND (ca.club_slug = club_weekly_flyers.club_slug))))));



  create policy "flyers_public_read"
  on "public"."club_weekly_flyers"
  as permissive
  for select
  to anon, authenticated
using ((is_active = true));



  create policy "clubs_admin_write"
  on "public"."clubs"
  as permissive
  for all
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.club_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.status = 'active'::text) AND (ca.club_slug = clubs.slug))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.club_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.status = 'active'::text) AND (ca.club_slug = clubs.slug))))));



  create policy "clubs_public_read"
  on "public"."clubs"
  as permissive
  for select
  to anon, authenticated
using ((is_active = true));



  create policy "enquiries_admin_update"
  on "public"."enquiries"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "enquiries_no_public_read"
  on "public"."enquiries"
  as permissive
  for select
  to anon
using (false);



  create policy "enquiries_public_insert"
  on "public"."enquiries"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "enquiries_team_read"
  on "public"."enquiries"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'host'::text]))))));



  create policy "enquiry_guests_public_insert"
  on "public"."enquiry_guests"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "enquiry_guests_team_read"
  on "public"."enquiry_guests"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'host'::text]))))));



  create policy "financial_booking_nightlife_read"
  on "public"."financial_booking_nightlife"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.financial_bookings fb
  WHERE ((fb.id = financial_booking_nightlife.financial_booking_id) AND public.is_financial_reader()))));



  create policy "financial_booking_nightlife_write"
  on "public"."financial_booking_nightlife"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.financial_bookings fb
  WHERE ((fb.id = financial_booking_nightlife.financial_booking_id) AND public.is_financial_reader()))))
with check ((EXISTS ( SELECT 1
   FROM public.financial_bookings fb
  WHERE ((fb.id = financial_booking_nightlife.financial_booking_id) AND public.is_financial_reader()))));



  create policy "financial_booking_service_read"
  on "public"."financial_booking_service"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.financial_bookings fb
  WHERE ((fb.id = financial_booking_service.financial_booking_id) AND public.is_financial_reader()))));



  create policy "financial_booking_service_write"
  on "public"."financial_booking_service"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.financial_bookings fb
  WHERE ((fb.id = financial_booking_service.financial_booking_id) AND public.is_financial_reader()))))
with check ((EXISTS ( SELECT 1
   FROM public.financial_bookings fb
  WHERE ((fb.id = financial_booking_service.financial_booking_id) AND public.is_financial_reader()))));



  create policy "financial_bookings_read"
  on "public"."financial_bookings"
  as permissive
  for select
  to authenticated
using (public.is_financial_reader());



  create policy "financial_bookings_write"
  on "public"."financial_bookings"
  as permissive
  for all
  to authenticated
using (public.is_financial_reader())
with check (public.is_financial_reader());



  create policy "financial_cfg_requests_insert"
  on "public"."financial_config_change_requests"
  as permissive
  for insert
  to authenticated
with check ((((target_type = 'financial_rule'::text) AND public.can_request_financial_rule_change(target_id)) OR ((target_type = 'financial_promoter'::text) AND public.is_financial_editor())));



  create policy "financial_cfg_requests_read"
  on "public"."financial_config_change_requests"
  as permissive
  for select
  to authenticated
using (public.is_financial_reader());



  create policy "financial_cfg_requests_update"
  on "public"."financial_config_change_requests"
  as permissive
  for update
  to authenticated
using (public.is_financial_editor())
with check (public.is_financial_editor());



  create policy "financial_payees_admin"
  on "public"."financial_payees"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "financial_promoters_read"
  on "public"."financial_promoters"
  as permissive
  for select
  to authenticated
using (public.is_financial_reader());



  create policy "financial_promoters_write"
  on "public"."financial_promoters"
  as permissive
  for all
  to authenticated
using (public.is_financial_editor())
with check (public.is_financial_editor());



  create policy "financial_recurring_templates_admin"
  on "public"."financial_recurring_templates"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "financial_rules_read"
  on "public"."financial_rules"
  as permissive
  for select
  to authenticated
using (public.is_financial_reader());



  create policy "financial_rules_write"
  on "public"."financial_rules"
  as permissive
  for all
  to authenticated
using (public.is_financial_editor())
with check (public.is_financial_editor());



  create policy "financial_transactions_admin"
  on "public"."financial_transactions"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "guest_identity_links_admin"
  on "public"."guest_identity_links"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "guest_profiles_admin"
  on "public"."guest_profiles"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "guestlist_checkins_admin"
  on "public"."guestlist_checkins"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "guestlist_demographics_admin"
  on "public"."guestlist_demographics"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "guestlist_events_admin"
  on "public"."guestlist_events"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "guestlist_signups_admin"
  on "public"."guestlist_signups"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'promoter'::text]))))));



  create policy "job_disputes_admin_or_scoped"
  on "public"."job_disputes"
  as permissive
  for all
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (raised_by_user_id = auth.uid()) OR public.club_account_for_user(auth.uid(), club_slug)))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (raised_by_user_id = auth.uid()) OR public.club_account_for_user(auth.uid(), club_slug)));



  create policy "profiles_self_insert"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((id = auth.uid()));



  create policy "profiles_self_read"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((id = auth.uid()));



  create policy "profiles_self_update"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((id = auth.uid()))
with check ((id = auth.uid()));



  create policy "promoter_availability_admin"
  on "public"."promoter_availability"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_availability_self"
  on "public"."promoter_availability"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_availability.promoter_id) AND (pr.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_availability.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_preferences_admin"
  on "public"."promoter_club_preferences"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_preferences_self"
  on "public"."promoter_club_preferences"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_club_preferences.promoter_id) AND (pr.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_club_preferences.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_earnings_admin"
  on "public"."promoter_earnings"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_earnings_promoter_select"
  on "public"."promoter_earnings"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_earnings.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_guestlist_entries_admin"
  on "public"."promoter_guestlist_entries"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.promoter_jobs j
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((j.id = promoter_guestlist_entries.promoter_job_id) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM (public.promoter_jobs j
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((j.id = promoter_guestlist_entries.promoter_job_id) AND (p.role = 'admin'::text)))));



  create policy "promoter_guestlist_entries_promoter_select"
  on "public"."promoter_guestlist_entries"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.promoter_jobs j
     JOIN public.promoters pr ON ((pr.id = j.promoter_id)))
  WHERE ((j.id = promoter_guestlist_entries.promoter_job_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_invoice_lines_admin"
  on "public"."promoter_invoice_lines"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.promoter_invoices i
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((i.id = promoter_invoice_lines.invoice_id) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM (public.promoter_invoices i
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((i.id = promoter_invoice_lines.invoice_id) AND (p.role = 'admin'::text)))));



  create policy "promoter_invoice_lines_promoter_select"
  on "public"."promoter_invoice_lines"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.promoter_invoices i
     JOIN public.promoters pr ON ((pr.id = i.promoter_id)))
  WHERE ((i.id = promoter_invoice_lines.invoice_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_invoices_admin"
  on "public"."promoter_invoices"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_invoices_promoter_select"
  on "public"."promoter_invoices"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_invoices.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_jobs_admin"
  on "public"."promoter_jobs"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_jobs_promoter_select"
  on "public"."promoter_jobs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_jobs.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_night_adj_admin"
  on "public"."promoter_night_adjustments"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_night_adj_promoter_select"
  on "public"."promoter_night_adjustments"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_night_adjustments.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "profile_revisions_admin"
  on "public"."promoter_profile_revisions"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "profile_revisions_promoter_insert"
  on "public"."promoter_profile_revisions"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_profile_revisions.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "profile_revisions_promoter_select"
  on "public"."promoter_profile_revisions"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_profile_revisions.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "promoter_signup_requests_insert_public"
  on "public"."promoter_signup_requests"
  as permissive
  for insert
  to anon, authenticated
with check (((status = 'pending'::text) AND (length(TRIM(BOTH FROM full_name)) >= 1) AND (length(TRIM(BOTH FROM email)) >= 3)));



  create policy "promoter_signup_requests_select_admin"
  on "public"."promoter_signup_requests"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_table_sales_admin"
  on "public"."promoter_table_sales"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoter_table_sales_promoter_select"
  on "public"."promoter_table_sales"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.promoters pr
  WHERE ((pr.id = promoter_table_sales.promoter_id) AND (pr.user_id = auth.uid())))));



  create policy "promoters_admin_select"
  on "public"."promoters"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoters_admin_write"
  on "public"."promoters"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "promoters_self_insert"
  on "public"."promoters"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "promoters_self_select"
  on "public"."promoters"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "promoters_self_update"
  on "public"."promoters"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


CREATE TRIGGER client_attendance_recalc_after_change AFTER INSERT OR DELETE OR UPDATE ON public.client_attendances FOR EACH ROW EXECUTE FUNCTION public.client_attendance_recalc_trigger();


  create policy "flyers_storage_public_read"
  on "storage"."objects"
  as permissive
  for select
  to anon, authenticated
using ((bucket_id = 'club-flyers'::text));



  create policy "flyers_storage_write"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using ((((bucket_id = 'club-flyers'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) OR ((bucket_id = 'club-flyers'::text) AND (EXISTS ( SELECT 1
   FROM public.club_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.status = 'active'::text) AND ((split_part(objects.name, '/'::text, 1) = ca.club_slug) OR (split_part(objects.name, '/'::text, 2) = ca.club_slug))))))))
with check ((((bucket_id = 'club-flyers'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) OR ((bucket_id = 'club-flyers'::text) AND (EXISTS ( SELECT 1
   FROM public.club_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.status = 'active'::text) AND ((split_part(objects.name, '/'::text, 1) = ca.club_slug) OR (split_part(objects.name, '/'::text, 2) = ca.club_slug))))))));



  create policy "promoter_profile_images_delete_own c3fytm_0"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'club-flyers'::text) AND ((storage.foldername(name))[1] = 'promoter-profiles'::text) AND ((storage.foldername(name))[2] = ( SELECT (p.id)::text AS id
   FROM public.promoters p
  WHERE (p.user_id = auth.uid())
 LIMIT 1))));



  create policy "promoter_profile_images_delete_own c3fytm_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'club-flyers'::text) AND ((storage.foldername(name))[1] = 'promoter-profiles'::text) AND ((storage.foldername(name))[2] = ( SELECT (p.id)::text AS id
   FROM public.promoters p
  WHERE (p.user_id = auth.uid())
 LIMIT 1))));



  create policy "promoter_profile_images_insert_own c3fytm_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'club-flyers'::text) AND ((storage.foldername(name))[1] = 'promoter-profiles'::text) AND ((storage.foldername(name))[2] = ( SELECT (p.id)::text AS id
   FROM public.promoters p
  WHERE (p.user_id = auth.uid())
 LIMIT 1))));



  create policy "promoter_profile_images_update_own c3fytm_0"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'club-flyers'::text) AND ((storage.foldername(name))[1] = 'promoter-profiles'::text) AND ((storage.foldername(name))[2] = ( SELECT (p.id)::text AS id
   FROM public.promoters p
  WHERE (p.user_id = auth.uid())
 LIMIT 1))));



  create policy "promoter_profile_images_update_own c3fytm_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'club-flyers'::text) AND ((storage.foldername(name))[1] = 'promoter-profiles'::text) AND ((storage.foldername(name))[2] = ( SELECT (p.id)::text AS id
   FROM public.promoters p
  WHERE (p.user_id = auth.uid())
 LIMIT 1))));



