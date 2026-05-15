


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."bonus_type_v2" AS ENUM (
    'none',
    'flat',
    'stacking'
);


ALTER TYPE "public"."bonus_type_v2" OWNER TO "postgres";


CREATE TYPE "public"."logic_type_v2" AS ENUM (
    'headcount_pay',
    'commission_percent',
    'flat_fee'
);


ALTER TYPE "public"."logic_type_v2" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'admin',
    'manager',
    'analyst',
    'staff',
    'finance',
    'operations',
    'promoter',
    'viewer'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."payment_status_v2" AS ENUM (
    'expected',
    'attended',
    'paid_final'
);


ALTER TYPE "public"."payment_status_v2" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_club_day_key"("raw" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $_$
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
$_$;


ALTER FUNCTION "public"."_club_day_key"("raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_pref_weekdays_include_dow"("p_weekdays" "text"[], "p_date" "date") RETURNS boolean
    LANGUAGE "sql" STABLE PARALLEL SAFE
    AS $$
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
$$;


ALTER FUNCTION "public"."_pref_weekdays_include_dow"("p_weekdays" "text"[], "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_club_invite"("p_invite_code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_club_invite"("p_invite_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_insert_table_sale"("p_promoter_id" "uuid", "p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."admin_insert_table_sale"("p_promoter_id" "uuid", "p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_issue_club_invite"("p_club_slug" "text", "p_invite_email" "text", "p_role" "text" DEFAULT 'owner'::"text", "p_notes" "text" DEFAULT ''::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."admin_issue_club_invite"("p_club_slug" "text", "p_invite_email" "text", "p_role" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_guestlist_entry"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."admin_review_guestlist_entry"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_night_adjustment"("p_adjustment_id" "uuid", "p_approve" boolean, "p_review_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."admin_review_night_adjustment"("p_adjustment_id" "uuid", "p_approve" boolean, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_table_sale"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."admin_review_table_sale"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_recurring_financial_transactions"("p_through" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."apply_recurring_financial_transactions"("p_through" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_promoter_profile_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."approve_promoter_profile_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_row_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org uuid;
  v_entity_id text;
  v_summary text;
  v_changes jsonb;
begin
  if tg_op = 'DELETE' then
    v_org := old.organisation_id;
    v_entity_id := old.id::text;
    v_changes := jsonb_build_object('before', to_jsonb(old));
  else
    v_org := new.organisation_id;
    v_entity_id := new.id::text;
    v_changes := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  end if;

  v_summary := tg_table_name || ' ' || lower(tg_op);

  insert into public.audit_logs (
    organisation_id, actor_user_id, entity_type, entity_id, action, summary, changes, source
  )
  values (
    v_org,
    auth.uid(),
    replace(tg_table_name, 'financial_', ''),
    v_entity_id,
    lower(tg_op),
    v_summary,
    coalesce(v_changes, '{}'::jsonb),
    'trigger'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."audit_row_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_promoter_earnings"("p_promoter_id" "uuid", "p_from" "date", "p_to" "date") RETURNS numeric
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(amount), 0)::numeric
  from public.promoter_earnings
  where promoter_id = p_promoter_id
    and earning_date between p_from and p_to;
$$;


ALTER FUNCTION "public"."calculate_promoter_earnings"("p_promoter_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_org_role"("p_organisation_id" "uuid", "p_roles" "text"[] DEFAULT NULL::"text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.organisation_memberships om
    where om.user_id = auth.uid()
      and om.organisation_id = p_organisation_id
      and om.status = 'active'
      and (
        p_roles is null
        or om.role::text = any (p_roles)
      )
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."can_access_org_role"("p_organisation_id" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_request_financial_rule_change"("p_target_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."can_request_financial_rule_change"("p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."client_attendance_recalc_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."client_attendance_recalc_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_account_for_user"("p_user_id" "uuid", "p_club_slug" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.club_accounts ca
    where ca.user_id = p_user_id
      and ca.club_slug = p_club_slug
      and ca.status = 'active'
  );
$$;


ALTER FUNCTION "public"."club_account_for_user"("p_user_id" "uuid", "p_club_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_decide_promoter_job"("p_job_id" "uuid", "p_decision" "text", "p_note" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."club_decide_promoter_job"("p_job_id" "uuid", "p_decision" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_set_promoter_preference_access"("p_preference_id" "uuid", "p_allow" boolean, "p_note" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."club_set_promoter_preference_access"("p_preference_id" "uuid", "p_allow" boolean, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_clients_from_enquiry"("p_enquiry_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."create_clients_from_enquiry"("p_enquiry_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_guestlist_signup_bundle"("p_club_slug" "text", "p_event_date" "date", "p_source" "text", "p_guests" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."create_guestlist_signup_bundle"("p_club_slug" "text", "p_event_date" "date", "p_source" "text", "p_guests" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_report_run"("p_organisation_id" "uuid", "p_template_code" "text", "p_format" "text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if not public.can_access_org_role(p_organisation_id, array['owner','admin','finance']::text[]) then
    raise exception 'insufficient privileges';
  end if;

  insert into public.report_runs (
    organisation_id, template_code, format, status, filters, created_by, file_name, payload
  )
  values (
    p_organisation_id,
    p_template_code,
    p_format,
    'completed',
    coalesce(p_filters, '{}'::jsonb),
    auth.uid(),
    p_template_code || '-' || to_char(now(), 'YYYYMMDDHH24MISS') || '.' || p_format,
    jsonb_build_object('generated_at', now())
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_report_run"("p_organisation_id" "uuid", "p_template_code" "text", "p_format" "text", "p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_report_schedule"("p_organisation_id" "uuid", "p_template_code" "text", "p_frequency" "text", "p_recipients" "text"[], "p_filters" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if not public.can_access_org_role(p_organisation_id, array['owner','admin','finance']::text[]) then
    raise exception 'insufficient privileges';
  end if;

  insert into public.report_schedules (
    organisation_id, template_code, frequency, recipients, filters, created_by
  )
  values (
    p_organisation_id,
    p_template_code,
    p_frequency,
    coalesce(p_recipients, '{}'::text[]),
    coalesce(p_filters, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_report_schedule"("p_organisation_id" "uuid", "p_template_code" "text", "p_frequency" "text", "p_recipients" "text"[], "p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_organisation_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select om.organisation_id
  from public.organisation_memberships om
  where om.user_id = auth.uid()
    and om.status = 'active';
$$;


ALTER FUNCTION "public"."current_organisation_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_promoter_job_safe"("p_job_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."delete_promoter_job_safe"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_campaign_audience"("p_name" "text", "p_description" "text" DEFAULT ''::"text", "p_filter_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_campaign_audience"("p_name" "text", "p_description" "text", "p_filter_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_promoter_invoice"("p_promoter_id" "uuid", "p_period_start" "date", "p_period_end" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_promoter_invoice"("p_promoter_id" "uuid", "p_period_start" "date", "p_period_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_audit_logs"("p_organisation_id" "uuid", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "entity_type" "text", "entity_id" "text", "action" "text", "summary" "text", "actor_user_id" "uuid", "created_at" timestamp with time zone, "ip_address" "inet", "changes" "jsonb")
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select al.id, al.entity_type, al.entity_id, al.action, al.summary, al.actor_user_id, al.created_at, al.ip_address, al.changes
  from public.audit_logs al
  where al.organisation_id = p_organisation_id
    and (p_entity_type is null or al.entity_type = p_entity_type)
    and (p_entity_id is null or al.entity_id = p_entity_id)
    and public.has_organisation_access(al.organisation_id)
  order by al.created_at desc
  limit 500;
$$;


ALTER FUNCTION "public"."get_audit_logs"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booking_detail_drawer"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select public.rpc_booking_detail_drawer(p_booking_id);
$$;


ALTER FUNCTION "public"."get_booking_detail_drawer"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_org_context"() RETURNS TABLE("organisation_id" "uuid", "organisation_name" "text", "organisation_slug" "text", "role" "text", "status" "text", "is_default" boolean)
    LANGUAGE "sql" STABLE
    AS $$
  select *
  from public.rpc_dashboard_org_context();
$$;


ALTER FUNCTION "public"."get_dashboard_org_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_department_breakdown"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("department" "text", "bookings_count" bigint, "total_revenue" numeric, "total_projected_profit" numeric, "total_realised_profit" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  select
    bf.department,
    count(*)::bigint as bookings_count,
    coalesce(sum(bf.total_revenue), 0) as total_revenue,
    coalesce(sum(bf.projected_agency_profit), 0) as total_projected_profit,
    coalesce(sum(bf.realised_agency_profit), 0) as total_realised_profit
  from public.booking_financials bf
  where bf.organisation_id = p_organisation_id
    and public.can_access_org_role(bf.organisation_id)
    and bf.booking_date between p_start_date and p_end_date
  group by bf.department
  order by total_realised_profit desc, bf.department asc;
$$;


ALTER FUNCTION "public"."get_department_breakdown"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_finance_bookings_table"("p_organisation_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("booking_id" "uuid", "booking_reference" "text", "booking_date" "date", "department" "text", "payment_status" "text", "venue_or_service_name" "text", "promoter_name" "text", "club_name" "text", "total_guests" integer, "total_revenue" numeric, "projected_agency_profit" numeric, "realized_agency_profit" numeric, "promoter_commission_due" numeric, "near_bonus_alert" boolean)
    LANGUAGE "sql" STABLE
    AS $$
  select *
  from public.rpc_finance_bookings_table(
    p_organisation_id,
    p_start_date,
    p_end_date,
    p_department,
    p_search
  );
$$;


ALTER FUNCTION "public"."get_finance_bookings_table"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_finance_timeseries"("p_organisation_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("period_date" "date", "revenue" numeric, "projected_profit" numeric, "realized_profit" numeric, "bookings_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  select *
  from public.rpc_finance_timeseries(
    p_organisation_id,
    p_start_date,
    p_end_date,
    p_department,
    p_search
  );
$$;


ALTER FUNCTION "public"."get_finance_timeseries"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_dashboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("total_agency_profit" numeric, "total_projected_profit" numeric, "total_outstanding" numeric, "total_realised" numeric, "nightlife_guests" bigint, "average_profit_per_guest" numeric, "top_promoter" "text", "department_breakdown" "jsonb", "promoter_leaderboard" "jsonb", "venue_performance" "jsonb", "near_bonus_bookings" "jsonb", "recent_paid_final_bookings" "jsonb")
    LANGUAGE "sql" STABLE
    AS $$
  with scoped as (
    select *
    from public.booking_financials bf
    where bf.organisation_id = p_organisation_id
      and public.can_access_org_role(bf.organisation_id)
      and bf.booking_date between p_start_date and p_end_date
  ),
  top_promoter_row as (
    select coalesce(promoter_name, 'Unassigned') as promoter_name
    from scoped
    group by coalesce(promoter_name, 'Unassigned')
    order by sum(realised_agency_profit) desc nulls last
    limit 1
  )
  select
    coalesce(sum(scoped.net_agency_profit_after_commission), 0) as total_agency_profit,
    coalesce(sum(scoped.projected_agency_profit), 0) as total_projected_profit,
    coalesce(sum(scoped.projected_agency_profit) filter (where scoped.payment_status in ('expected', 'attended')), 0) as total_outstanding,
    coalesce(sum(scoped.realised_agency_profit), 0) as total_realised,
    coalesce(sum(scoped.total_guests) filter (where scoped.department = 'nightlife'), 0)::bigint as nightlife_guests,
    case
      when coalesce(sum(scoped.total_guests) filter (where scoped.department = 'nightlife'), 0) > 0 then
        round(
          coalesce(sum(scoped.net_agency_profit_after_commission) filter (where scoped.department = 'nightlife'), 0)
          / nullif(sum(scoped.total_guests) filter (where scoped.department = 'nightlife'), 0),
          2
        )
      else 0::numeric
    end as average_profit_per_guest,
    coalesce((select promoter_name from top_promoter_row), 'Unassigned') as top_promoter,
    coalesce(
      (
        select jsonb_agg(to_jsonb(x))
        from public.get_department_breakdown(p_organisation_id, p_start_date, p_end_date) x
      ),
      '[]'::jsonb
    ) as department_breakdown,
    coalesce(
      (
        select jsonb_agg(to_jsonb(x))
        from public.get_promoter_leaderboard(p_organisation_id, p_start_date, p_end_date) x
      ),
      '[]'::jsonb
    ) as promoter_leaderboard,
    coalesce(
      (
        select jsonb_agg(to_jsonb(x))
        from public.get_venue_performance(p_organisation_id, p_start_date, p_end_date) x
      ),
      '[]'::jsonb
    ) as venue_performance,
    coalesce(
      (
        select jsonb_agg(to_jsonb(x))
        from public.get_near_bonus_bookings(p_organisation_id, p_start_date, p_end_date) x
      ),
      '[]'::jsonb
    ) as near_bonus_bookings,
    coalesce(
      (
        select jsonb_agg(to_jsonb(x))
        from (
          select
            scoped.booking_id,
            scoped.booking_reference,
            scoped.booking_date,
            scoped.venue_or_service_name,
            scoped.realised_agency_profit,
            scoped.net_agency_profit_after_commission
          from scoped
          where scoped.payment_status = 'paid_final'
          order by scoped.booking_date desc
          limit 15
        ) x
      ),
      '[]'::jsonb
    ) as recent_paid_final_bookings
  from scoped;
$$;


ALTER FUNCTION "public"."get_financial_dashboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_dashboard_snapshot"("p_from" "date", "p_to" "date") RETURNS TABLE("total_realized_profit" numeric, "nightlife_realized_profit" numeric, "transport_realized_profit" numeric, "protection_realized_profit" numeric, "other_realized_profit" numeric, "total_nightlife_guests" integer, "avg_nightlife_profit_per_guest" numeric, "outstanding_projected_profit" numeric, "realized_projected_profit" numeric, "top_promoter_name" "text", "top_promoter_realized_profit" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_financial_dashboard_snapshot"("p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_period_summary"("p_from" "date", "p_to" "date", "p_direction" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_payment_tag" "text" DEFAULT NULL::"text", "p_payee_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("income" numeric, "expense" numeric, "net" numeric, "tx_count" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_financial_period_summary"("p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_report"("p_period_type" "text", "p_from" "date", "p_to" "date", "p_direction" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_payment_tag" "text" DEFAULT NULL::"text", "p_payee_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("period_label" "text", "income" numeric, "expense" numeric, "net" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_financial_report"("p_period_type" "text", "p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_guestlist_conversion_metrics"("p_club_slug" "text" DEFAULT NULL::"text", "p_promoter_id" "uuid" DEFAULT NULL::"uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("event_id" "uuid", "club_slug" "text", "promoter_id" "uuid", "event_date" "date", "signups" integer, "attended" integer, "conversion" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_guestlist_conversion_metrics"("p_club_slug" "text", "p_promoter_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_near_bonus_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("booking_id" "uuid", "booking_reference" "text", "booking_date" "date", "venue_or_service_name" "text", "current_guests" integer, "guests_until_bonus" integer, "promoter_name" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    bf.booking_id,
    bf.booking_reference,
    bf.booking_date,
    bf.venue_or_service_name,
    bf.total_guests as current_guests,
    bf.guests_until_bonus,
    bf.promoter_name
  from public.booking_financials bf
  where bf.organisation_id = p_organisation_id
    and public.can_access_org_role(bf.organisation_id)
    and bf.booking_date between p_start_date and p_end_date
    and bf.is_near_bonus = true
  order by bf.booking_date desc, bf.guests_until_bonus asc;
$$;


ALTER FUNCTION "public"."get_near_bonus_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_outstanding_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("booking_id" "uuid", "booking_reference" "text", "booking_date" "date", "department" "text", "payment_status" "text", "projected_agency_profit" numeric, "promoter_name" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    bf.booking_id,
    bf.booking_reference,
    bf.booking_date,
    bf.department,
    bf.payment_status,
    bf.projected_agency_profit,
    bf.promoter_name
  from public.booking_financials bf
  where bf.organisation_id = p_organisation_id
    and public.can_access_org_role(bf.organisation_id)
    and bf.booking_date between p_start_date and p_end_date
    and bf.payment_status in ('expected', 'attended')
  order by bf.booking_date desc, bf.booking_reference asc;
$$;


ALTER FUNCTION "public"."get_outstanding_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_promoter_leaderboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("promoter_id" "uuid", "promoter_name" "text", "bookings_count" bigint, "realised_profit" numeric, "promoter_commission_due" numeric, "net_agency_profit_after_commission" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  select
    bf.promoter_id,
    coalesce(bf.promoter_name, 'Unassigned') as promoter_name,
    count(*)::bigint as bookings_count,
    coalesce(sum(bf.realised_agency_profit), 0) as realised_profit,
    coalesce(sum(bf.promoter_commission_due), 0) as promoter_commission_due,
    coalesce(sum(bf.net_agency_profit_after_commission), 0) as net_agency_profit_after_commission
  from public.booking_financials bf
  where bf.organisation_id = p_organisation_id
    and public.can_access_org_role(bf.organisation_id)
    and bf.booking_date between p_start_date and p_end_date
  group by bf.promoter_id, coalesce(bf.promoter_name, 'Unassigned')
  order by realised_profit desc, promoter_name asc;
$$;


ALTER FUNCTION "public"."get_promoter_leaderboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_promoter_payouts"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("promoter_id" "uuid", "promoter_name" "text", "realised_profit" numeric, "commission_due" numeric, "commission_paid" numeric, "payout_outstanding" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  with requester as (
    select
      exists (
        select 1
        from public.organisation_memberships om
        where om.user_id = auth.uid()
          and om.organisation_id = p_organisation_id
          and om.status = 'active'
          and om.role = 'promoter'
      ) as is_promoter,
      exists (
        select 1
        from public.organisation_memberships om
        where om.user_id = auth.uid()
          and om.organisation_id = p_organisation_id
          and om.status = 'active'
          and om.role in ('owner', 'admin', 'manager', 'finance', 'operations', 'viewer')
      ) as is_elevated
  ),
  commissions as (
    select
      bf.promoter_id,
      coalesce(bf.promoter_name, 'Unassigned') as promoter_name,
      sum(bf.realised_agency_profit) as realised_profit,
      sum(bf.promoter_commission_due) as commission_due
    from public.booking_financials bf
    cross join requester req
    where bf.organisation_id = p_organisation_id
      and public.can_access_org_role(bf.organisation_id)
      and bf.booking_date between p_start_date and p_end_date
      and bf.department = 'nightlife'
      and (
        not req.is_promoter
        or req.is_elevated
        or bf.promoter_user_id = auth.uid()
      )
    group by bf.promoter_id, coalesce(bf.promoter_name, 'Unassigned')
  ),
  paid as (
    select
      pc.promoter_id,
      sum(pc.commission_paid) as commission_paid
    from public.promoter_commissions pc
    left join public.financial_promoters fp on fp.id = pc.promoter_id
    cross join requester req
    where pc.organisation_id = p_organisation_id
      and (
        not req.is_promoter
        or req.is_elevated
        or fp.user_id = auth.uid()
      )
    group by pc.promoter_id
  )
  select
    c.promoter_id,
    c.promoter_name,
    coalesce(c.realised_profit, 0) as realised_profit,
    coalesce(c.commission_due, 0) as commission_due,
    coalesce(p.commission_paid, 0) as commission_paid,
    coalesce(c.commission_due, 0) - coalesce(p.commission_paid, 0) as payout_outstanding
  from commissions c
  left join paid p on p.promoter_id = c.promoter_id
  order by payout_outstanding desc, promoter_name asc;
$$;


ALTER FUNCTION "public"."get_promoter_payouts"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_report_templates"() RETURNS TABLE("id" "uuid", "code" "text", "name" "text", "description" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select rt.id, rt.code, rt.name, rt.description
  from public.report_templates rt
  where rt.is_active = true
  order by rt.name asc;
$$;


ALTER FUNCTION "public"."get_report_templates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_venue_performance"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("venue_or_service_name" "text", "department" "text", "bookings_count" bigint, "total_revenue" numeric, "total_realised_profit" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  select
    bf.venue_or_service_name,
    bf.department,
    count(*)::bigint as bookings_count,
    coalesce(sum(bf.total_revenue), 0) as total_revenue,
    coalesce(sum(bf.realised_agency_profit), 0) as total_realised_profit
  from public.booking_financials bf
  where bf.organisation_id = p_organisation_id
    and public.can_access_org_role(bf.organisation_id)
    and bf.booking_date between p_start_date and p_end_date
  group by bf.venue_or_service_name, bf.department
  order by total_realised_profit desc, venue_or_service_name asc;
$$;


ALTER FUNCTION "public"."get_venue_performance"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guestlist_hosts_for_date"("p_date" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."guestlist_hosts_for_date"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_organisation_access"("p_organisation_id" "uuid", "p_roles" "public"."member_role"[] DEFAULT NULL::"public"."member_role"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.organisation_memberships om
    where om.user_id = auth.uid()
      and om.organisation_id = p_organisation_id
      and om.status = 'active'
      and (
        p_roles is null
        or om.role = any (p_roles)
      )
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."has_organisation_access"("p_organisation_id" "uuid", "p_roles" "public"."member_role"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_promoter_guestlist_entry"("p_job_id" "uuid", "p_guest_name" "text", "p_guest_contact" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."insert_promoter_guestlist_entry"("p_job_id" "uuid", "p_guest_name" "text", "p_guest_contact" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_promoter_job_self"("p_club_slug" "text", "p_job_date" "date", "p_service" "text" DEFAULT 'guestlist'::"text", "p_shift_fee" numeric DEFAULT 0, "p_guestlist_fee" numeric DEFAULT 0, "p_guests_count" integer DEFAULT 0, "p_notes" "text" DEFAULT ''::"text", "p_status" "text" DEFAULT 'assigned'::"text", "p_client_name" "text" DEFAULT ''::"text", "p_client_contact" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."insert_promoter_job_self"("p_club_slug" "text", "p_job_date" "date", "p_service" "text", "p_shift_fee" numeric, "p_guestlist_fee" numeric, "p_guests_count" integer, "p_notes" "text", "p_status" "text", "p_client_name" "text", "p_client_contact" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_promoter_table_sale"("p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."insert_promoter_table_sale"("p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_financial_club_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.club_accounts ca
    where ca.user_id = auth.uid()
      and ca.status = 'active'
      and ca.role in ('owner', 'manager')
  );
$$;


ALTER FUNCTION "public"."is_financial_club_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_financial_editor"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_financial_editor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_financial_reader"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."is_financial_reader"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_report_runs"("p_organisation_id" "uuid") RETURNS TABLE("id" "uuid", "template_code" "text", "format" "text", "status" "text", "created_at" timestamp with time zone, "file_name" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select rr.id, rr.template_code, rr.format, rr.status, rr.created_at, rr.file_name
  from public.report_runs rr
  where rr.organisation_id = p_organisation_id
    and public.has_organisation_access(rr.organisation_id)
  order by rr.created_at desc
  limit 100;
$$;


ALTER FUNCTION "public"."list_report_runs"("p_organisation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_booking_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_status_history (
      organisation_id,
      financial_booking_id,
      previous_status,
      next_status,
      changed_by,
      changed_at,
      reason
    )
    values (
      new.organisation_id,
      new.id,
      null,
      new.payment_status,
      auth.uid(),
      now(),
      'initial status'
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.payment_status is distinct from old.payment_status then
    insert into public.booking_status_history (
      organisation_id,
      financial_booking_id,
      previous_status,
      next_status,
      changed_by,
      changed_at,
      reason
    )
    values (
      new.organisation_id,
      new.id,
      old.payment_status,
      new.payment_status,
      auth.uid(),
      now(),
      'status transition'
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."log_booking_status_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_signup_to_attended"("p_signup_id" "uuid", "p_source" "text", "p_checked_in_by" "uuid" DEFAULT NULL::"uuid", "p_age" smallint DEFAULT NULL::smallint, "p_gender" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."promote_signup_to_attended"("p_signup_id" "uuid", "p_source" "text", "p_checked_in_by" "uuid", "p_age" smallint, "p_gender" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_client_preferences"("p_client_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."recalculate_client_preferences"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_audit_log"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text", "p_action" "text", "p_summary" "text", "p_changes" "jsonb" DEFAULT '{}'::"jsonb", "p_source" "text" DEFAULT 'app'::"text", "p_ip_address" "inet" DEFAULT NULL::"inet") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if not public.has_organisation_access(p_organisation_id) then
    raise exception 'insufficient privileges';
  end if;

  insert into public.audit_logs (
    organisation_id, actor_user_id, entity_type, entity_id, action, summary, changes, source, ip_address
  )
  values (
    p_organisation_id,
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_action,
    p_summary,
    coalesce(p_changes, '{}'::jsonb),
    p_source,
    p_ip_address
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."record_audit_log"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text", "p_action" "text", "p_summary" "text", "p_changes" "jsonb", "p_source" "text", "p_ip_address" "inet") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_club_edit_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."review_club_edit_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_job_dispute"("p_dispute_id" "uuid", "p_status" "text", "p_resolution_notes" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."review_job_dispute"("p_dispute_id" "uuid", "p_status" "text", "p_resolution_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_booking_detail_drawer"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  with scoped as (
    select *
    from public.vw_finance_booking_fact fact
    where fact.booking_id = p_booking_id
      and public.has_organisation_access(fact.organisation_id)
  )
  select coalesce(
    (
      select jsonb_build_object(
        'booking_id', scoped.booking_id,
        'booking_reference', scoped.booking_reference,
        'booking_date', scoped.booking_date,
        'department', scoped.department,
        'payment_status', scoped.payment_status,
        'venue_or_service_name', scoped.venue_or_service_name,
        'club_name', scoped.club_name,
        'promoter_name', scoped.promoter_name,
        'rule_name', scoped.rule_name,
        'narrative', concat(
          'Booking ',
          scoped.booking_reference,
          ' is currently ',
          replace(scoped.payment_status, '_', ' '),
          ' with all financial metrics calculated inside Postgres.'
        ),
        'metrics', jsonb_build_array(
          jsonb_build_object('id', 'revenue', 'label', 'Revenue', 'value', scoped.total_revenue, 'format', 'currency', 'tone', 'neutral'),
          jsonb_build_object('id', 'projected', 'label', 'Projected profit', 'value', scoped.projected_agency_profit, 'format', 'currency', 'tone', 'info'),
          jsonb_build_object('id', 'realized', 'label', 'Realised profit', 'value', scoped.realized_agency_profit, 'format', 'currency', 'tone', 'success'),
          jsonb_build_object('id', 'commission', 'label', 'Promoter commission due', 'value', scoped.promoter_commission_due, 'format', 'currency', 'tone', 'warning'),
          jsonb_build_object('id', 'guests', 'label', 'Total guests', 'value', scoped.total_guests, 'format', 'integer', 'tone', 'neutral')
        )
      )
      from scoped
      limit 1
    ),
    '{}'::jsonb
  );
$$;


ALTER FUNCTION "public"."rpc_booking_detail_drawer"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_dashboard_org_context"() RETURNS TABLE("organisation_id" "uuid", "organisation_name" "text", "organisation_slug" "text", "role" "text", "status" "text", "is_default" boolean)
    LANGUAGE "sql" STABLE
    AS $$
  select
    o.id,
    o.name,
    o.slug,
    om.role::text,
    om.status,
    om.is_default
  from public.organisation_memberships om
  join public.organisations o on o.id = om.organisation_id
  where om.user_id = auth.uid()
    and om.status = 'active'
  order by om.is_default desc, o.name asc;
$$;


ALTER FUNCTION "public"."rpc_dashboard_org_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_department_performance"("p_org_id" "uuid", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("department" "text", "bookings_count" bigint, "revenue" numeric, "projected_profit" numeric, "realized_profit" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."rpc_department_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_finance_bookings_table"("p_org_id" "uuid", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("booking_id" "uuid", "booking_reference" "text", "booking_date" "date", "department" "text", "payment_status" "text", "venue_or_service_name" "text", "promoter_name" "text", "club_name" "text", "total_guests" integer, "total_revenue" numeric, "projected_agency_profit" numeric, "realized_agency_profit" numeric, "promoter_commission_due" numeric, "near_bonus_alert" boolean)
    LANGUAGE "sql" STABLE
    AS $$
  select
    fact.booking_id,
    fact.booking_reference,
    fact.booking_date,
    fact.department,
    fact.payment_status,
    fact.venue_or_service_name,
    fact.promoter_name,
    fact.club_name,
    fact.total_guests,
    fact.total_revenue,
    fact.projected_agency_profit,
    fact.realized_agency_profit,
    fact.promoter_commission_due,
    fact.near_bonus_alert
  from public.vw_finance_booking_fact fact
  where fact.organisation_id = p_org_id
    and public.has_organisation_access(fact.organisation_id)
    and (p_date_from is null or fact.booking_date >= p_date_from)
    and (p_date_to is null or fact.booking_date <= p_date_to)
    and (p_department is null or fact.department = p_department)
    and (
      p_search is null
      or fact.booking_reference ilike '%' || p_search || '%'
      or fact.venue_or_service_name ilike '%' || p_search || '%'
      or coalesce(fact.promoter_name, '') ilike '%' || p_search || '%'
    )
  order by fact.booking_date desc, fact.booking_reference asc;
$$;


ALTER FUNCTION "public"."rpc_finance_bookings_table"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_finance_overview"("p_org_id" "uuid", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("revenue" numeric, "projected_profit" numeric, "realized_profit" numeric, "outstanding_profit" numeric, "bookings_count" bigint, "paid_final_count" bigint, "attended_count" bigint, "average_booking_value" numeric, "transport_commission" numeric, "protection_commission" numeric, "promoter_payouts_due" numeric, "top_promoter_name" "text", "top_promoter_profit" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  with filtered as (
    select *
    from public.booking_financials bf
    where bf.organisation_id = p_org_id
      and public.can_access_org_role(bf.organisation_id)
      and (p_date_from is null or bf.booking_date >= p_date_from)
      and (p_date_to is null or bf.booking_date <= p_date_to)
      and (p_department is null or bf.department = p_department)
      and (
        p_search is null
        or bf.booking_reference ilike '%' || p_search || '%'
        or bf.venue_or_service_name ilike '%' || p_search || '%'
        or coalesce(bf.promoter_name, '') ilike '%' || p_search || '%'
      )
  ),
  top_promoter as (
    select coalesce(promoter_name, 'Unassigned') as promoter_name, sum(realised_agency_profit) as realised_profit
    from filtered
    group by coalesce(promoter_name, 'Unassigned')
    order by realised_profit desc
    limit 1
  )
  select
    coalesce(sum(filtered.total_revenue), 0),
    coalesce(sum(filtered.projected_agency_profit), 0),
    coalesce(sum(filtered.realised_agency_profit), 0),
    coalesce(sum(filtered.projected_agency_profit) filter (where filtered.payment_status in ('expected', 'attended')), 0),
    count(*)::bigint,
    count(*) filter (where filtered.payment_status = 'paid_final')::bigint,
    count(*) filter (where filtered.payment_status = 'attended')::bigint,
    coalesce(avg(filtered.total_revenue), 0),
    coalesce(sum(filtered.promoter_commission_due) filter (where filtered.department = 'transport'), 0),
    coalesce(sum(filtered.promoter_commission_due) filter (where filtered.department = 'protection'), 0),
    coalesce(sum(filtered.promoter_commission_due), 0),
    coalesce((select promoter_name from top_promoter), 'Unassigned'),
    coalesce((select realised_profit from top_promoter), 0)
  from filtered;
$$;


ALTER FUNCTION "public"."rpc_finance_overview"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_finance_timeseries"("p_org_id" "uuid", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("period_date" "date", "revenue" numeric, "projected_profit" numeric, "realized_profit" numeric, "bookings_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  select
    booking_date as period_date,
    sum(total_revenue) as revenue,
    sum(projected_agency_profit) as projected_profit,
    sum(realized_agency_profit) as realized_profit,
    count(*)::bigint as bookings_count
  from public.vw_finance_booking_fact fact
  where fact.organisation_id = p_org_id
    and public.has_organisation_access(fact.organisation_id)
    and (p_date_from is null or fact.booking_date >= p_date_from)
    and (p_date_to is null or fact.booking_date <= p_date_to)
    and (p_department is null or fact.department = p_department)
    and (
      p_search is null
      or fact.booking_reference ilike '%' || p_search || '%'
      or fact.venue_or_service_name ilike '%' || p_search || '%'
      or coalesce(fact.promoter_name, '') ilike '%' || p_search || '%'
    )
  group by booking_date
  order by booking_date asc;
$$;


ALTER FUNCTION "public"."rpc_finance_timeseries"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_near_bonus_alerts"("p_org_id" "uuid", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("booking_id" "uuid", "booking_reference" "text", "booking_date" "date", "venue_or_service_name" "text", "guests_needed" integer, "current_guests" integer, "bonus_goal" integer, "promoter_name" "text")
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."rpc_near_bonus_alerts"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_promoter_commissions"("p_org_id" "uuid", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("promoter_id" "uuid", "promoter_name" "text", "bookings_count" bigint, "total_revenue" numeric, "projected_profit" numeric, "realized_profit" numeric, "commission_due" numeric, "commission_paid" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  with payouts as (
    select *
    from public.get_promoter_payouts(
      p_org_id,
      coalesce(p_date_from, '1900-01-01'::date),
      coalesce(p_date_to, '2999-12-31'::date)
    )
  )
  select
    p.promoter_id,
    p.promoter_name,
    l.bookings_count,
    coalesce(sum(bf.total_revenue), 0) as total_revenue,
    coalesce(sum(bf.projected_agency_profit), 0) as projected_profit,
    p.realised_profit as realized_profit,
    p.commission_due,
    p.commission_paid
  from payouts p
  left join public.get_promoter_leaderboard(
    p_org_id,
    coalesce(p_date_from, '1900-01-01'::date),
    coalesce(p_date_to, '2999-12-31'::date)
  ) l on l.promoter_id = p.promoter_id
  left join public.booking_financials bf on bf.promoter_id = p.promoter_id
    and bf.organisation_id = p_org_id
    and (p_date_from is null or bf.booking_date >= p_date_from)
    and (p_date_to is null or bf.booking_date <= p_date_to)
  where p_search is null or p.promoter_name ilike '%' || p_search || '%'
  group by p.promoter_id, p.promoter_name, l.bookings_count, p.realised_profit, p.commission_due, p.commission_paid
  order by p.commission_due desc, p.promoter_name asc;
$$;


ALTER FUNCTION "public"."rpc_promoter_commissions"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_service_performance"("p_org_id" "uuid", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_department" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("venue_or_service_name" "text", "department" "text", "bookings_count" bigint, "revenue" numeric, "projected_profit" numeric, "realized_profit" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."rpc_service_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_club_edit_revision"("p_club_slug" "text", "p_target_type" "text", "p_target_id" "uuid", "p_payload" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."submit_club_edit_revision"("p_club_slug" "text", "p_target_type" "text", "p_target_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_job_dispute"("p_promoter_job_id" "uuid", "p_reason_code" "text" DEFAULT 'other'::"text", "p_description" "text" DEFAULT ''::"text", "p_evidence" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."submit_job_dispute"("p_promoter_job_id" "uuid", "p_reason_code" "text", "p_description" "text", "p_evidence" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_website_enquiry"("p_form_name" "text", "p_form_label" "text", "p_service" "text", "p_client_key" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_payload" "jsonb", "p_guests" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."submit_website_enquiry"("p_form_name" "text", "p_form_label" "text", "p_service" "text", "p_client_key" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_payload" "jsonb", "p_guests" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_crm_clients_from_guestlist_batch"("p_enquiry_id" "uuid", "p_club_slug" "text", "p_event_date" "date", "p_guests" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."sync_crm_clients_from_guestlist_batch"("p_enquiry_id" "uuid", "p_club_slug" "text", "p_event_date" "date", "p_guests" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_crm_clients_from_guestlist_batch"("p_enquiry_id" "uuid", "p_club_slug" "text", "p_event_date" "date", "p_guests" "jsonb") IS 'Links guestlist party guests to public.clients + client_guestlist_activity after submit_website_enquiry; call from site with fresh enquiry id.';



CREATE OR REPLACE FUNCTION "public"."upsert_guest_profile_from_identity"("p_full_name" "text", "p_phone" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_instagram" "text" DEFAULT NULL::"text", "p_age" smallint DEFAULT NULL::smallint, "p_gender" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."upsert_guest_profile_from_identity"("p_full_name" "text", "p_phone" "text", "p_email" "text", "p_instagram" "text", "p_age" smallint, "p_gender" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_promoter_night_adjustment"("p_night_date" "date", "p_available_override" boolean, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_notes" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."upsert_promoter_night_adjustment"("p_night_date" "date", "p_available_override" boolean, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_notes" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "changes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'app'::"text" NOT NULL,
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."audit_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tax_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "organisation_id" "uuid"
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_booking_nightlife" (
    "financial_booking_id" "uuid" NOT NULL,
    "male_guests" integer DEFAULT 0 NOT NULL,
    "female_guests" integer DEFAULT 0 NOT NULL,
    "other_costs" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_booking_nightlife_female_guests_check" CHECK (("female_guests" >= 0)),
    CONSTRAINT "financial_booking_nightlife_male_guests_check" CHECK (("male_guests" >= 0))
);

ALTER TABLE ONLY "public"."financial_booking_nightlife" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_booking_nightlife" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_booking_service" (
    "financial_booking_id" "uuid" NOT NULL,
    "total_spend" numeric(12,2) DEFAULT 0 NOT NULL,
    "commission_percentage_override" numeric(6,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_booking_service_commission_percentage_override_check" CHECK ((("commission_percentage_override" >= (0)::numeric) AND ("commission_percentage_override" <= (100)::numeric)))
);

ALTER TABLE ONLY "public"."financial_booking_service" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_booking_service" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_reference" "text" DEFAULT ''::"text" NOT NULL,
    "booking_date" "date" NOT NULL,
    "department" "text" NOT NULL,
    "promoter_id" "uuid",
    "client_id" "uuid",
    "rule_id" "uuid",
    "rule_snapshot_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "venue_or_service_name" "text" DEFAULT ''::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'expected'::"text" NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "club_slug" "text",
    "organisation_id" "uuid",
    "customer_reference" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "financial_bookings_department_check" CHECK (("department" = ANY (ARRAY['nightlife'::"text", 'transport'::"text", 'protection'::"text", 'other'::"text"]))),
    CONSTRAINT "financial_bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['expected'::"text", 'attended'::"text", 'paid_final'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."financial_bookings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_promoters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "commission_percentage" numeric(6,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "contact" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organisation_id" "uuid",
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "contact_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "financial_promoters_commission_percentage_check" CHECK ((("commission_percentage" >= (0)::numeric) AND ("commission_percentage" <= (100)::numeric)))
);

ALTER TABLE ONLY "public"."financial_promoters" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_promoters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department" "text" NOT NULL,
    "venue_or_service_name" "text" DEFAULT ''::"text" NOT NULL,
    "male_rate" numeric(12,2) DEFAULT 0 NOT NULL,
    "female_rate" numeric(12,2) DEFAULT 0 NOT NULL,
    "base_rate" numeric(12,2) DEFAULT 0 NOT NULL,
    "logic_type" "text" NOT NULL,
    "bonus_type" "text" DEFAULT 'none'::"text" NOT NULL,
    "bonus_goal" integer DEFAULT 0 NOT NULL,
    "bonus_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_to" "date",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "club_slug" "text",
    "organisation_id" "uuid",
    "commission_rate" numeric(10,6) DEFAULT 0 NOT NULL,
    CONSTRAINT "financial_rules_bonus_goal_check" CHECK (("bonus_goal" >= 0)),
    CONSTRAINT "financial_rules_bonus_type_check" CHECK (("bonus_type" = ANY (ARRAY['flat'::"text", 'stacking'::"text", 'none'::"text"]))),
    CONSTRAINT "financial_rules_department_check" CHECK (("department" = ANY (ARRAY['nightlife'::"text", 'transport'::"text", 'protection'::"text", 'other'::"text"]))),
    CONSTRAINT "financial_rules_logic_type_check" CHECK (("logic_type" = ANY (ARRAY['headcount_pay'::"text", 'commission_percent'::"text", 'flat_fee'::"text"])))
);

ALTER TABLE ONLY "public"."financial_rules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_rules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."booking_financials" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "fb"."id" AS "booking_id",
            "fb"."organisation_id",
            "fb"."booking_reference",
            "fb"."booking_date",
            "fb"."department",
            "fb"."payment_status",
            "fb"."customer_reference",
            "fb"."notes",
            "fb"."venue_or_service_name",
            "fb"."club_slug",
            "c"."name" AS "club_name",
            "fb"."promoter_id",
            "fp"."name" AS "promoter_name",
            "fp"."user_id" AS "promoter_user_id",
            COALESCE("fp"."commission_percentage", (0)::numeric) AS "promoter_commission_percentage",
            "fb"."rule_id",
            "fr"."venue_or_service_name" AS "rule_name",
            "fr"."logic_type",
            "fr"."bonus_type",
            COALESCE("fr"."male_rate", (0)::numeric) AS "male_rate",
            COALESCE("fr"."female_rate", (0)::numeric) AS "female_rate",
            COALESCE("fr"."base_rate", (0)::numeric) AS "base_rate",
            COALESCE("fr"."commission_rate", (0)::numeric) AS "commission_rate",
            COALESCE("fr"."bonus_goal", 0) AS "bonus_goal",
            COALESCE("fr"."bonus_amount", (0)::numeric) AS "bonus_amount",
            COALESCE("fbn"."male_guests", 0) AS "male_guests",
            COALESCE("fbn"."female_guests", 0) AS "female_guests",
            COALESCE("fbs"."total_spend", (0)::numeric) AS "total_spend",
            COALESCE("fbn"."other_costs", (0)::numeric) AS "nightlife_other_costs"
           FROM ((((("public"."financial_bookings" "fb"
             LEFT JOIN "public"."financial_rules" "fr" ON (("fr"."id" = "fb"."rule_id")))
             LEFT JOIN "public"."financial_promoters" "fp" ON (("fp"."id" = "fb"."promoter_id")))
             LEFT JOIN "public"."financial_booking_nightlife" "fbn" ON (("fbn"."financial_booking_id" = "fb"."id")))
             LEFT JOIN "public"."financial_booking_service" "fbs" ON (("fbs"."financial_booking_id" = "fb"."id")))
             LEFT JOIN "public"."clubs" "c" ON (("c"."slug" = "fb"."club_slug")))
        )
 SELECT "booking_id",
    "organisation_id",
    "booking_reference",
    "booking_date",
    "department",
    "payment_status",
    "customer_reference",
    "notes",
    "venue_or_service_name",
    "club_slug",
    "club_name",
    "promoter_id",
    "promoter_name",
    "promoter_user_id",
    "promoter_commission_percentage",
    "rule_id",
    "rule_name",
    "logic_type",
    "bonus_type",
    "male_guests",
    "female_guests",
    "total_spend",
        CASE
            WHEN ("department" = 'nightlife'::"text") THEN "nightlife_other_costs"
            ELSE (0)::numeric
        END AS "other_costs",
    ("male_guests" + "female_guests") AS "total_guests",
        CASE
            WHEN ("payment_status" = 'cancelled'::"text") THEN (0)::numeric
            WHEN ("department" = 'nightlife'::"text") THEN "round"(((("male_guests")::numeric * "male_rate") + (("female_guests")::numeric * "female_rate")), 2)
            WHEN ("department" = ANY (ARRAY['transport'::"text", 'protection'::"text"])) THEN "round"(("total_spend" * "commission_rate"), 2)
            WHEN ("logic_type" = 'commission_percent'::"text") THEN "round"(("total_spend" * "commission_rate"), 2)
            WHEN ("logic_type" = 'flat_fee'::"text") THEN "round"("base_rate", 2)
            ELSE (0)::numeric
        END AS "total_revenue",
        CASE
            WHEN ("payment_status" = 'cancelled'::"text") THEN (0)::numeric
            WHEN ("department" <> 'nightlife'::"text") THEN (0)::numeric
            WHEN (("bonus_type" = 'flat'::"text") AND ("bonus_goal" > 0) AND (("male_guests" + "female_guests") >= "bonus_goal")) THEN "round"("bonus_amount", 2)
            WHEN (("bonus_type" = 'stacking'::"text") AND ("bonus_goal" > 0)) THEN "round"(("bonus_amount" * "floor"((("female_guests")::numeric / ("bonus_goal")::numeric))), 2)
            ELSE (0)::numeric
        END AS "bonus_earned",
        CASE
            WHEN ("payment_status" = 'cancelled'::"text") THEN (0)::numeric
            WHEN ("department" = 'nightlife'::"text") THEN "round"(((((("male_guests")::numeric * "male_rate") + (("female_guests")::numeric * "female_rate")) +
            CASE
                WHEN (("bonus_type" = 'flat'::"text") AND ("bonus_goal" > 0) AND (("male_guests" + "female_guests") >= "bonus_goal")) THEN "bonus_amount"
                WHEN (("bonus_type" = 'stacking'::"text") AND ("bonus_goal" > 0)) THEN ("bonus_amount" * "floor"((("female_guests")::numeric / ("bonus_goal")::numeric)))
                ELSE (0)::numeric
            END) - "nightlife_other_costs"), 2)
            WHEN ("department" = ANY (ARRAY['transport'::"text", 'protection'::"text"])) THEN "round"(("total_spend" * "commission_rate"), 2)
            WHEN ("logic_type" = 'commission_percent'::"text") THEN "round"(("total_spend" * "commission_rate"), 2)
            WHEN ("logic_type" = 'flat_fee'::"text") THEN "round"("base_rate", 2)
            ELSE (0)::numeric
        END AS "projected_agency_profit",
        CASE
            WHEN ("payment_status" = 'paid_final'::"text") THEN
            CASE
                WHEN ("department" = 'nightlife'::"text") THEN "round"(((((("male_guests")::numeric * "male_rate") + (("female_guests")::numeric * "female_rate")) +
                CASE
                    WHEN (("bonus_type" = 'flat'::"text") AND ("bonus_goal" > 0) AND (("male_guests" + "female_guests") >= "bonus_goal")) THEN "bonus_amount"
                    WHEN (("bonus_type" = 'stacking'::"text") AND ("bonus_goal" > 0)) THEN ("bonus_amount" * "floor"((("female_guests")::numeric / ("bonus_goal")::numeric)))
                    ELSE (0)::numeric
                END) - "nightlife_other_costs"), 2)
                WHEN ("department" = ANY (ARRAY['transport'::"text", 'protection'::"text"])) THEN "round"(("total_spend" * "commission_rate"), 2)
                WHEN ("logic_type" = 'commission_percent'::"text") THEN "round"(("total_spend" * "commission_rate"), 2)
                WHEN ("logic_type" = 'flat_fee'::"text") THEN "round"("base_rate", 2)
                ELSE (0)::numeric
            END
            ELSE (0)::numeric
        END AS "realised_agency_profit",
        CASE
            WHEN (("department" = 'nightlife'::"text") AND ("payment_status" = 'paid_final'::"text")) THEN "round"((((((("male_guests")::numeric * "male_rate") + (("female_guests")::numeric * "female_rate")) +
            CASE
                WHEN (("bonus_type" = 'flat'::"text") AND ("bonus_goal" > 0) AND (("male_guests" + "female_guests") >= "bonus_goal")) THEN "bonus_amount"
                WHEN (("bonus_type" = 'stacking'::"text") AND ("bonus_goal" > 0)) THEN ("bonus_amount" * "floor"((("female_guests")::numeric / ("bonus_goal")::numeric)))
                ELSE (0)::numeric
            END) - "nightlife_other_costs") * ("promoter_commission_percentage" / 100.0)), 2)
            ELSE (0)::numeric
        END AS "promoter_commission_due",
        CASE
            WHEN ("payment_status" = 'paid_final'::"text") THEN
            CASE
                WHEN ("department" = 'nightlife'::"text") THEN "round"((((((("male_guests")::numeric * "male_rate") + (("female_guests")::numeric * "female_rate")) +
                CASE
                    WHEN (("bonus_type" = 'flat'::"text") AND ("bonus_goal" > 0) AND (("male_guests" + "female_guests") >= "bonus_goal")) THEN "bonus_amount"
                    WHEN (("bonus_type" = 'stacking'::"text") AND ("bonus_goal" > 0)) THEN ("bonus_amount" * "floor"((("female_guests")::numeric / ("bonus_goal")::numeric)))
                    ELSE (0)::numeric
                END) - "nightlife_other_costs") - (((((("male_guests")::numeric * "male_rate") + (("female_guests")::numeric * "female_rate")) +
                CASE
                    WHEN (("bonus_type" = 'flat'::"text") AND ("bonus_goal" > 0) AND (("male_guests" + "female_guests") >= "bonus_goal")) THEN "bonus_amount"
                    WHEN (("bonus_type" = 'stacking'::"text") AND ("bonus_goal" > 0)) THEN ("bonus_amount" * "floor"((("female_guests")::numeric / ("bonus_goal")::numeric)))
                    ELSE (0)::numeric
                END) - "nightlife_other_costs") * ("promoter_commission_percentage" / 100.0))), 2)
                WHEN ("department" = ANY (ARRAY['transport'::"text", 'protection'::"text"])) THEN "round"(("total_spend" * "commission_rate"), 2)
                WHEN ("logic_type" = 'commission_percent'::"text") THEN "round"(("total_spend" * "commission_rate"), 2)
                WHEN ("logic_type" = 'flat_fee'::"text") THEN "round"("base_rate", 2)
                ELSE (0)::numeric
            END
            ELSE (0)::numeric
        END AS "net_agency_profit_after_commission",
    (("department" = 'nightlife'::"text") AND ("bonus_goal" > 0) AND (("male_guests" + "female_guests") < "bonus_goal") AND ((("bonus_goal" - ("male_guests" + "female_guests")) >= 1) AND (("bonus_goal" - ("male_guests" + "female_guests")) <= 2))) AS "is_near_bonus",
        CASE
            WHEN (("department" = 'nightlife'::"text") AND ("bonus_goal" > 0)) THEN GREATEST(("bonus_goal" - ("male_guests" + "female_guests")), 0)
            ELSE 0
        END AS "guests_until_bonus"
   FROM "base";


ALTER VIEW "public"."booking_financials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "financial_booking_id" "uuid" NOT NULL,
    "previous_status" "text",
    "next_status" "text" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text" DEFAULT ''::"text" NOT NULL
);

ALTER TABLE ONLY "public"."booking_status_history" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_audience_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audience_id" "uuid" NOT NULL,
    "guest_profile_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_audience_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_audiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "filter_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_audiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_attendances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "club_slug" "text" NOT NULL,
    "promoter_id" "uuid",
    "spend_gbp" numeric(12,2) DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_attendances_spend_gbp_check" CHECK (("spend_gbp" >= (0)::numeric))
);


ALTER TABLE "public"."client_attendances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_guestlist_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "club_slug" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "promoter_id" "uuid",
    "enquiry_id" "uuid",
    "guest_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_guestlist_activity" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_guestlist_activity" IS 'One row per client × club × night; filled on guestlist signup sync and visible in admin CRM.';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "instagram" "text",
    "gender" "text",
    "referral_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "guest_profile_id" "uuid",
    "typical_spend_gbp" numeric(12,2),
    "preferred_nights" "text",
    "preferred_promoter_id" "uuid",
    "preferred_club_slug" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."notes" IS 'Internal CRM notes (admin).';



COMMENT ON COLUMN "public"."clients"."typical_spend_gbp" IS 'Typical spend per night out (GBP), admin-maintained.';



COMMENT ON COLUMN "public"."clients"."preferred_nights" IS 'e.g. Fri, Sat — free text.';



COMMENT ON COLUMN "public"."clients"."preferred_promoter_id" IS 'Promoter this client usually works with.';



CREATE TABLE IF NOT EXISTS "public"."club_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_slug" "text" NOT NULL,
    "user_id" "uuid",
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "status" "text" DEFAULT 'invited'::"text" NOT NULL,
    "invite_email" "text",
    "invite_code" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_accounts_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'editor'::"text"]))),
    CONSTRAINT "club_accounts_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'active'::"text", 'suspended'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."club_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_edit_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_slug" "text" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_notes" "text" DEFAULT ''::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_edit_revisions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "club_edit_revisions_target_type_check" CHECK (("target_type" = ANY (ARRAY['club_payload'::"text", 'flyer'::"text", 'media'::"text"])))
);


ALTER TABLE "public"."club_edit_revisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_weekly_flyers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_slug" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "image_path" "text" DEFAULT ''::"text" NOT NULL,
    "image_url" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."club_weekly_flyers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_layouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "layout_key" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_layouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."departments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "form_name" "text" NOT NULL,
    "form_label" "text" NOT NULL,
    "service" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "source" "text" DEFAULT 'website'::"text" NOT NULL,
    "client_id" "uuid",
    "client_key" "text",
    "name" "text",
    "email" "text",
    "phone" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."enquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enquiry_guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enquiry_id" "uuid" NOT NULL,
    "guest_name" "text" NOT NULL,
    "guest_contact" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enquiry_guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_config_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "review_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "organisation_id" "uuid",
    CONSTRAINT "financial_config_change_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "financial_config_change_requests_target_type_check" CHECK (("target_type" = ANY (ARRAY['financial_rule'::"text", 'financial_promoter'::"text"])))
);

ALTER TABLE ONLY "public"."financial_config_change_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_config_change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_payees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "default_payment_tag" "text" DEFAULT ''::"text" NOT NULL,
    "default_currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tax_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."financial_payees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_recurring_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT ''::"text" NOT NULL,
    "direction" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "interval_days" integer NOT NULL,
    "next_due_date" "date" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_generated_on" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_tag" "text" DEFAULT ''::"text" NOT NULL,
    "convert_foreign" boolean DEFAULT false NOT NULL,
    "payee_id" "uuid",
    "payee_label" "text" DEFAULT ''::"text" NOT NULL,
    "recurrence_unit" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "recurrence_every" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "financial_recurring_templates_default_status_check" CHECK (("default_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text", 'failed'::"text"]))),
    CONSTRAINT "financial_recurring_templates_direction_check" CHECK (("direction" = ANY (ARRAY['income'::"text", 'expense'::"text"]))),
    CONSTRAINT "financial_recurring_templates_interval_days_check" CHECK (("interval_days" >= 1)),
    CONSTRAINT "financial_recurring_templates_recurrence_every_check" CHECK ((("recurrence_every" >= 1) AND ("recurrence_every" <= 24))),
    CONSTRAINT "financial_recurring_templates_recurrence_unit_check" CHECK (("recurrence_unit" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annual'::"text", 'custom_days'::"text"])))
);


ALTER TABLE "public"."financial_recurring_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tx_date" "date" NOT NULL,
    "category" "text" DEFAULT ''::"text" NOT NULL,
    "direction" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_ref" "uuid",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_tag" "text" DEFAULT ''::"text" NOT NULL,
    "convert_foreign" boolean DEFAULT false NOT NULL,
    "payee_id" "uuid",
    "payee_label" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "financial_transactions_direction_check" CHECK (("direction" = ANY (ARRAY['income'::"text", 'expense'::"text"]))),
    CONSTRAINT "financial_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."financial_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_identity_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_profile_id" "uuid" NOT NULL,
    "identity_type" "text" NOT NULL,
    "identity_value" "text" NOT NULL,
    "normalized_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "guest_identity_links_identity_type_check" CHECK (("identity_type" = ANY (ARRAY['phone'::"text", 'email'::"text", 'instagram'::"text"])))
);


ALTER TABLE "public"."guest_identity_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "primary_phone" "text",
    "primary_email" "text",
    "primary_instagram" "text",
    "age" smallint,
    "gender" "text",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guest_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guestlist_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guestlist_signup_id" "uuid" NOT NULL,
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checkin_source" "text" NOT NULL,
    "checked_in_by" "uuid",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "guestlist_checkins_checkin_source_check" CHECK (("checkin_source" = ANY (ARRAY['self'::"text", 'promoter'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."guestlist_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guestlist_demographics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_profile_id" "uuid" NOT NULL,
    "guestlist_event_id" "uuid",
    "age" smallint,
    "gender" "text",
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "guestlist_demographics_source_check" CHECK (("source" = ANY (ARRAY['self'::"text", 'promoter'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."guestlist_demographics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guestlist_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_slug" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "promoter_id" "uuid",
    "capacity" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "guestlist_events_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."guestlist_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guestlist_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guestlist_event_id" "uuid" NOT NULL,
    "guest_profile_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'website'::"text" NOT NULL,
    "signup_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'signed_up'::"text" NOT NULL,
    "created_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "guestlist_signups_status_check" CHECK (("status" = ANY (ARRAY['signed_up'::"text", 'attended'::"text", 'no_show'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."guestlist_signups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_slug" "text" NOT NULL,
    "promoter_job_id" "uuid",
    "promoter_table_sale_id" "uuid",
    "promoter_guestlist_entry_id" "uuid",
    "raised_by_user_id" "uuid" NOT NULL,
    "raised_by_role" "text" DEFAULT 'club'::"text" NOT NULL,
    "reason_code" "text" DEFAULT 'other'::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolution_notes" "text" DEFAULT ''::"text" NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_disputes_raised_by_role_check" CHECK (("raised_by_role" = ANY (ARRAY['club'::"text", 'admin'::"text", 'promoter'::"text"]))),
    CONSTRAINT "job_disputes_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'under_review'::"text", 'resolved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."job_disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organisation_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" DEFAULT 'staff'::"public"."member_role" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organisation_memberships_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'active'::"text", 'disabled'::"text"])))
);

ALTER TABLE ONLY "public"."organisation_memberships" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organisation_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organisations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "billing_tier" "text" DEFAULT 'enterprise'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organisations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trial'::"text", 'inactive'::"text"])))
);

ALTER TABLE ONLY "public"."organisations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organisations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'host'::"text" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'host'::"text", 'promoter'::"text", 'club'::"text", 'owner'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "weekday" smallint NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promoter_availability_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."promoter_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_club_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "club_slug" "text" NOT NULL,
    "weekdays" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promoter_club_preferences_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."promoter_club_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "financial_booking_id" "uuid" NOT NULL,
    "promoter_id" "uuid",
    "commission_due" numeric(12,2) DEFAULT 0 NOT NULL,
    "commission_paid" numeric(12,2) DEFAULT 0 NOT NULL,
    "payout_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promoter_commissions_payout_status_check" CHECK (("payout_status" = ANY (ARRAY['unpaid'::"text", 'partial'::"text", 'paid'::"text"])))
);

ALTER TABLE ONLY "public"."promoter_commissions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."promoter_commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_earnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "promoter_job_id" "uuid",
    "earning_date" "date" NOT NULL,
    "source" "text" DEFAULT 'job'::"text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promoter_earnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_guestlist_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_job_id" "uuid" NOT NULL,
    "guest_name" "text" DEFAULT ''::"text" NOT NULL,
    "guest_contact" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "promoter_guestlist_entries_approval_status_chk" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."promoter_guestlist_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_invoice_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "promoter_job_id" "uuid",
    "line_type" "text" DEFAULT 'job'::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "quantity" numeric(12,2) DEFAULT 1 NOT NULL,
    "unit_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promoter_invoice_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "adjustments" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finalized_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "sent_to_email" "text" DEFAULT ''::"text" NOT NULL,
    "emailed_via" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "promoter_invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'finalized'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."promoter_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "club_slug" "text",
    "service" "text" DEFAULT 'guestlist'::"text" NOT NULL,
    "job_date" "date" NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "guests_count" integer DEFAULT 0 NOT NULL,
    "shift_fee" numeric(12,2) DEFAULT 0 NOT NULL,
    "guestlist_fee" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_name" "text" DEFAULT ''::"text" NOT NULL,
    "client_contact" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "promoter_jobs_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."promoter_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_night_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "night_date" "date" NOT NULL,
    "available_override" boolean NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promoter_night_adjustments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."promoter_night_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "promoter_id" "uuid",
    "period_from" "date" NOT NULL,
    "period_to" "date" NOT NULL,
    "total_due" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_paid" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_reference" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promoter_payouts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'paid'::"text"])))
);

ALTER TABLE ONLY "public"."promoter_payouts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."promoter_payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_profile_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "review_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "promoter_profile_revisions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."promoter_profile_revisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_signup_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "denial_reason" "text",
    "auth_user_id" "uuid",
    CONSTRAINT "promoter_signup_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."promoter_signup_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."promoter_signup_requests" IS 'Promoter access requests; notify + admin actions via Supabase Edge Functions (see edge/README.md).';



CREATE TABLE IF NOT EXISTS "public"."promoter_table_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid" NOT NULL,
    "club_slug" "text" NOT NULL,
    "sale_date" "date" NOT NULL,
    "promoter_job_id" "uuid",
    "entry_channel" "text" NOT NULL,
    "tier" "text" DEFAULT 'other'::"text" NOT NULL,
    "table_count" integer DEFAULT 1 NOT NULL,
    "total_min_spend" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promoter_table_sales_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "promoter_table_sales_entry_channel_check" CHECK (("entry_channel" = ANY (ARRAY['promoter'::"text", 'admin'::"text"]))),
    CONSTRAINT "promoter_table_sales_table_count_check" CHECK ((("table_count" >= 1) AND ("table_count" <= 99))),
    CONSTRAINT "promoter_table_sales_tier_check" CHECK (("tier" = ANY (ARRAY['standard'::"text", 'luxury'::"text", 'vip'::"text", 'other'::"text"]))),
    CONSTRAINT "promoter_table_sales_total_min_spend_check" CHECK (("total_min_spend" >= (0)::numeric))
);


ALTER TABLE "public"."promoter_table_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "display_name" "text" DEFAULT ''::"text" NOT NULL,
    "bio" "text" DEFAULT ''::"text" NOT NULL,
    "profile_image_url" "text" DEFAULT ''::"text" NOT NULL,
    "is_approved" boolean DEFAULT false NOT NULL,
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approval_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_image_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "portfolio_club_slugs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "payment_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tax_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "promoters_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."promoters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_run_id" "uuid" NOT NULL,
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "recipient" "text" NOT NULL,
    "delivery_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "report_deliveries_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'in_app'::"text"]))),
    CONSTRAINT "report_deliveries_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."report_deliveries" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "template_code" "text" NOT NULL,
    "format" "text" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "file_name" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "report_runs_format_check" CHECK (("format" = ANY (ARRAY['csv'::"text", 'xlsx'::"text", 'pdf'::"text"]))),
    CONSTRAINT "report_runs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."report_runs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "template_code" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "recipients" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "report_schedules_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"])))
);

ALTER TABLE ONLY "public"."report_schedules" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."report_templates" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "feature" "text" NOT NULL,
    "view_name" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "columns" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sorting" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."saved_views" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_views" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_finance_booking_fact" WITH ("security_invoker"='true') AS
 SELECT "booking_id",
    "organisation_id",
    "booking_reference",
    "booking_date",
    "department",
    "payment_status",
    "venue_or_service_name",
    "club_slug",
    "club_name",
    "promoter_id",
    "promoter_name",
    "rule_id",
    "rule_name",
    "male_guests",
    "female_guests",
    "total_guests",
    "other_costs",
    "total_spend",
    ("commission_rate" * (100)::numeric) AS "commission_percent",
    "total_revenue",
    "bonus_earned" AS "bonus_value",
    "projected_agency_profit",
    "realised_agency_profit" AS "realized_agency_profit",
        CASE
            WHEN ("payment_status" = 'attended'::"text") THEN "projected_agency_profit"
            ELSE (0)::numeric
        END AS "outstanding_profit",
    "promoter_commission_due",
    "is_near_bonus" AS "near_bonus_alert",
        CASE
            WHEN ("bonus_goal" > 0) THEN "bonus_goal"
            ELSE 0
        END AS "bonus_goal",
    "guests_until_bonus"
   FROM ( SELECT "b"."booking_id",
            "b"."organisation_id",
            "b"."booking_reference",
            "b"."booking_date",
            "b"."department",
            "b"."payment_status",
            "b"."customer_reference",
            "b"."notes",
            "b"."venue_or_service_name",
            "b"."club_slug",
            "b"."club_name",
            "b"."promoter_id",
            "b"."promoter_name",
            "b"."promoter_user_id",
            "b"."promoter_commission_percentage",
            "b"."rule_id",
            "b"."rule_name",
            "b"."logic_type",
            "b"."bonus_type",
            "b"."male_guests",
            "b"."female_guests",
            "b"."total_spend",
            "b"."other_costs",
            "b"."total_guests",
            "b"."total_revenue",
            "b"."bonus_earned",
            "b"."projected_agency_profit",
            "b"."realised_agency_profit",
            "b"."promoter_commission_due",
            "b"."net_agency_profit_after_commission",
            "b"."is_near_bonus",
            "b"."guests_until_bonus",
            COALESCE("fr"."commission_rate", (0)::numeric) AS "commission_rate",
            COALESCE("fr"."bonus_goal", 0) AS "bonus_goal"
           FROM ("public"."booking_financials" "b"
             LEFT JOIN "public"."financial_rules" "fr" ON (("fr"."id" = "b"."rule_id")))) "bf";


ALTER VIEW "public"."vw_finance_booking_fact" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_department_performance" WITH ("security_invoker"='true') AS
 SELECT "organisation_id",
    "department",
    "count"(*) AS "bookings_count",
    "sum"("total_revenue") AS "revenue",
    "sum"("projected_agency_profit") AS "projected_profit",
    "sum"("realized_agency_profit") AS "realized_profit"
   FROM "public"."vw_finance_booking_fact"
  GROUP BY "organisation_id", "department";


ALTER VIEW "public"."vw_department_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_finance_profit_fact" WITH ("security_invoker"='true') AS
 SELECT "organisation_id",
    "booking_date",
    "department",
    "payment_status",
    "sum"("total_revenue") AS "revenue",
    "sum"("projected_agency_profit") AS "projected_profit",
    "sum"("realized_agency_profit") AS "realized_profit",
    "sum"("outstanding_profit") AS "outstanding_profit",
    "count"(*) AS "bookings_count"
   FROM "public"."vw_finance_booking_fact"
  GROUP BY "organisation_id", "booking_date", "department", "payment_status";


ALTER VIEW "public"."vw_finance_profit_fact" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_near_bonus_alerts" WITH ("security_invoker"='true') AS
 SELECT "organisation_id",
    "booking_id",
    "booking_reference",
    "booking_date",
    "venue_or_service_name",
    "promoter_name",
    "total_guests" AS "current_guests",
    "bonus_goal",
    GREATEST(("bonus_goal" - "total_guests"), 0) AS "guests_needed"
   FROM "public"."vw_finance_booking_fact"
  WHERE ("near_bonus_alert" = true);


ALTER VIEW "public"."vw_near_bonus_alerts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_promoter_performance" WITH ("security_invoker"='true') AS
 SELECT "fact"."organisation_id",
    "fact"."promoter_id",
    COALESCE("fact"."promoter_name", 'Unassigned'::"text") AS "promoter_name",
    "count"(*) AS "bookings_count",
    "sum"("fact"."total_revenue") AS "total_revenue",
    "sum"("fact"."projected_agency_profit") AS "projected_profit",
    "sum"("fact"."realized_agency_profit") AS "realized_profit",
    "sum"("fact"."promoter_commission_due") AS "commission_due",
    "sum"(COALESCE("pc"."commission_paid", (0)::numeric)) AS "commission_paid"
   FROM ("public"."vw_finance_booking_fact" "fact"
     LEFT JOIN "public"."promoter_commissions" "pc" ON (("pc"."financial_booking_id" = "fact"."booking_id")))
  GROUP BY "fact"."organisation_id", "fact"."promoter_id", COALESCE("fact"."promoter_name", 'Unassigned'::"text");


ALTER VIEW "public"."vw_promoter_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_service_performance" WITH ("security_invoker"='true') AS
 SELECT "organisation_id",
    "department",
    "venue_or_service_name",
    "count"(*) AS "bookings_count",
    "sum"("total_revenue") AS "revenue",
    "sum"("projected_agency_profit") AS "projected_profit",
    "sum"("realized_agency_profit") AS "realized_profit"
   FROM "public"."vw_finance_booking_fact"
  GROUP BY "organisation_id", "department", "venue_or_service_name";


ALTER VIEW "public"."vw_service_performance" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_audience_members"
    ADD CONSTRAINT "campaign_audience_members_audience_id_guest_profile_id_key" UNIQUE ("audience_id", "guest_profile_id");



ALTER TABLE ONLY "public"."campaign_audience_members"
    ADD CONSTRAINT "campaign_audience_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_audiences"
    ADD CONSTRAINT "campaign_audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cars"
    ADD CONSTRAINT "cars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cars"
    ADD CONSTRAINT "cars_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."client_attendances"
    ADD CONSTRAINT "client_attendances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_guestlist_activity"
    ADD CONSTRAINT "client_guestlist_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_guestlist_activity"
    ADD CONSTRAINT "client_guestlist_activity_uniq" UNIQUE ("client_id", "club_slug", "event_date");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_accounts"
    ADD CONSTRAINT "club_accounts_club_slug_user_id_key" UNIQUE ("club_slug", "user_id");



ALTER TABLE ONLY "public"."club_accounts"
    ADD CONSTRAINT "club_accounts_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."club_accounts"
    ADD CONSTRAINT "club_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_edit_revisions"
    ADD CONSTRAINT "club_edit_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_weekly_flyers"
    ADD CONSTRAINT "club_weekly_flyers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."dashboard_layouts"
    ADD CONSTRAINT "dashboard_layouts_organisation_id_user_id_layout_key_key" UNIQUE ("organisation_id", "user_id", "layout_key");



ALTER TABLE ONLY "public"."dashboard_layouts"
    ADD CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organisation_id_code_key" UNIQUE ("organisation_id", "code");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enquiry_guests"
    ADD CONSTRAINT "enquiry_guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_booking_nightlife"
    ADD CONSTRAINT "financial_booking_nightlife_pkey" PRIMARY KEY ("financial_booking_id");



ALTER TABLE ONLY "public"."financial_booking_service"
    ADD CONSTRAINT "financial_booking_service_pkey" PRIMARY KEY ("financial_booking_id");



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_config_change_requests"
    ADD CONSTRAINT "financial_config_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_payees"
    ADD CONSTRAINT "financial_payees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_promoters"
    ADD CONSTRAINT "financial_promoters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_recurring_templates"
    ADD CONSTRAINT "financial_recurring_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_rules"
    ADD CONSTRAINT "financial_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_identity_links"
    ADD CONSTRAINT "guest_identity_links_identity_type_normalized_value_key" UNIQUE ("identity_type", "normalized_value");



ALTER TABLE ONLY "public"."guest_identity_links"
    ADD CONSTRAINT "guest_identity_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_profiles"
    ADD CONSTRAINT "guest_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guestlist_checkins"
    ADD CONSTRAINT "guestlist_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guestlist_demographics"
    ADD CONSTRAINT "guestlist_demographics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guestlist_events"
    ADD CONSTRAINT "guestlist_events_club_slug_event_date_promoter_id_key" UNIQUE ("club_slug", "event_date", "promoter_id");



ALTER TABLE ONLY "public"."guestlist_events"
    ADD CONSTRAINT "guestlist_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guestlist_signups"
    ADD CONSTRAINT "guestlist_signups_guestlist_event_id_guest_profile_id_key" UNIQUE ("guestlist_event_id", "guest_profile_id");



ALTER TABLE ONLY "public"."guestlist_signups"
    ADD CONSTRAINT "guestlist_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_disputes"
    ADD CONSTRAINT "job_disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organisation_memberships"
    ADD CONSTRAINT "organisation_memberships_organisation_id_user_id_key" UNIQUE ("organisation_id", "user_id");



ALTER TABLE ONLY "public"."organisation_memberships"
    ADD CONSTRAINT "organisation_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organisations"
    ADD CONSTRAINT "organisations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organisations"
    ADD CONSTRAINT "organisations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_availability"
    ADD CONSTRAINT "promoter_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_availability"
    ADD CONSTRAINT "promoter_availability_promoter_id_weekday_key" UNIQUE ("promoter_id", "weekday");



ALTER TABLE ONLY "public"."promoter_club_preferences"
    ADD CONSTRAINT "promoter_club_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_club_preferences"
    ADD CONSTRAINT "promoter_club_preferences_promoter_id_club_slug_key" UNIQUE ("promoter_id", "club_slug");



ALTER TABLE ONLY "public"."promoter_commissions"
    ADD CONSTRAINT "promoter_commissions_financial_booking_id_key" UNIQUE ("financial_booking_id");



ALTER TABLE ONLY "public"."promoter_commissions"
    ADD CONSTRAINT "promoter_commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_earnings"
    ADD CONSTRAINT "promoter_earnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_guestlist_entries"
    ADD CONSTRAINT "promoter_guestlist_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_invoice_lines"
    ADD CONSTRAINT "promoter_invoice_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_invoices"
    ADD CONSTRAINT "promoter_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_jobs"
    ADD CONSTRAINT "promoter_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_night_adjustments"
    ADD CONSTRAINT "promoter_night_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_night_adjustments"
    ADD CONSTRAINT "promoter_night_adjustments_promoter_id_night_date_key" UNIQUE ("promoter_id", "night_date");



ALTER TABLE ONLY "public"."promoter_payouts"
    ADD CONSTRAINT "promoter_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_profile_revisions"
    ADD CONSTRAINT "promoter_profile_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_signup_requests"
    ADD CONSTRAINT "promoter_signup_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_table_sales"
    ADD CONSTRAINT "promoter_table_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."report_deliveries"
    ADD CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_views"
    ADD CONSTRAINT "saved_views_organisation_id_user_id_feature_view_name_key" UNIQUE ("organisation_id", "user_id", "feature", "view_name");



ALTER TABLE ONLY "public"."saved_views"
    ADD CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id");



CREATE INDEX "booking_status_history_booking_idx" ON "public"."booking_status_history" USING "btree" ("financial_booking_id", "changed_at" DESC);



CREATE INDEX "cars_sort_idx" ON "public"."cars" USING "btree" ("sort_order", "name");



CREATE INDEX "client_attendances_client_date_idx" ON "public"."client_attendances" USING "btree" ("client_id", "event_date" DESC);



CREATE INDEX "client_attendances_club_date_idx" ON "public"."client_attendances" USING "btree" ("club_slug", "event_date" DESC);



CREATE INDEX "client_guestlist_activity_client_idx" ON "public"."client_guestlist_activity" USING "btree" ("client_id", "event_date" DESC);



CREATE INDEX "clients_email_idx" ON "public"."clients" USING "btree" ("lower"("email"));



CREATE INDEX "clients_guest_profile_id_idx" ON "public"."clients" USING "btree" ("guest_profile_id") WHERE ("guest_profile_id" IS NOT NULL);



CREATE INDEX "clients_guest_profile_idx" ON "public"."clients" USING "btree" ("guest_profile_id");



CREATE INDEX "clients_phone_idx" ON "public"."clients" USING "btree" ("phone");



CREATE INDEX "clients_preferred_club_idx" ON "public"."clients" USING "btree" ("preferred_club_slug");



CREATE INDEX "clients_preferred_promoter_idx" ON "public"."clients" USING "btree" ("preferred_promoter_id") WHERE ("preferred_promoter_id" IS NOT NULL);



CREATE INDEX "club_accounts_club_slug_idx" ON "public"."club_accounts" USING "btree" ("club_slug", "status");



CREATE INDEX "club_accounts_invite_code_idx" ON "public"."club_accounts" USING "btree" ("invite_code");



CREATE INDEX "club_accounts_user_idx" ON "public"."club_accounts" USING "btree" ("user_id", "status");



CREATE INDEX "club_edit_revisions_slug_idx" ON "public"."club_edit_revisions" USING "btree" ("club_slug", "status", "created_at" DESC);



CREATE INDEX "club_weekly_flyers_date_idx" ON "public"."club_weekly_flyers" USING "btree" ("event_date");



CREATE INDEX "club_weekly_flyers_slug_date_idx" ON "public"."club_weekly_flyers" USING "btree" ("club_slug", "event_date", "sort_order");



CREATE INDEX "clubs_sort_idx" ON "public"."clubs" USING "btree" ("sort_order", "name");



CREATE INDEX "enquiries_client_id_idx" ON "public"."enquiries" USING "btree" ("client_id");



CREATE INDEX "enquiries_client_key_idx" ON "public"."enquiries" USING "btree" ("client_key");



CREATE INDEX "enquiries_created_at_idx" ON "public"."enquiries" USING "btree" ("created_at" DESC);



CREATE INDEX "enquiries_service_status_idx" ON "public"."enquiries" USING "btree" ("service", "status");



CREATE INDEX "enquiry_guests_enquiry_id_idx" ON "public"."enquiry_guests" USING "btree" ("enquiry_id");



CREATE INDEX "financial_bookings_org_idx" ON "public"."financial_bookings" USING "btree" ("organisation_id", "booking_date" DESC);



CREATE UNIQUE INDEX "financial_bookings_reference_idx" ON "public"."financial_bookings" USING "btree" ("booking_reference");



CREATE INDEX "financial_payees_name_idx" ON "public"."financial_payees" USING "btree" ("name");



CREATE INDEX "financial_promoters_org_idx" ON "public"."financial_promoters" USING "btree" ("organisation_id", "name");



CREATE UNIQUE INDEX "financial_promoters_user_id_uidx" ON "public"."financial_promoters" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "financial_recurring_templates_due_idx" ON "public"."financial_recurring_templates" USING "btree" ("next_due_date") WHERE ("is_active" = true);



CREATE INDEX "financial_rules_org_idx" ON "public"."financial_rules" USING "btree" ("organisation_id", "department", "effective_from");



CREATE INDEX "financial_transactions_payee_idx" ON "public"."financial_transactions" USING "btree" ("payee_id", "tx_date" DESC);



CREATE INDEX "financial_transactions_period_idx" ON "public"."financial_transactions" USING "btree" ("tx_date" DESC, "direction");



CREATE INDEX "financial_transactions_status_idx" ON "public"."financial_transactions" USING "btree" ("status", "tx_date" DESC);



CREATE INDEX "financial_transactions_tag_idx" ON "public"."financial_transactions" USING "btree" ("payment_tag", "tx_date" DESC);



CREATE INDEX "guest_identity_lookup_idx" ON "public"."guest_identity_links" USING "btree" ("identity_type", "normalized_value");



CREATE INDEX "guest_profiles_seen_idx" ON "public"."guest_profiles" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "guestlist_checkins_signup_idx" ON "public"."guestlist_checkins" USING "btree" ("guestlist_signup_id", "checked_in_at" DESC);



CREATE INDEX "guestlist_demographics_guest_idx" ON "public"."guestlist_demographics" USING "btree" ("guest_profile_id", "created_at" DESC);



CREATE INDEX "guestlist_events_date_idx" ON "public"."guestlist_events" USING "btree" ("event_date" DESC, "club_slug");



CREATE INDEX "guestlist_signups_event_idx" ON "public"."guestlist_signups" USING "btree" ("guestlist_event_id", "status");



CREATE INDEX "guestlist_signups_guest_idx" ON "public"."guestlist_signups" USING "btree" ("guest_profile_id", "signup_at" DESC);



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("organisation_id", "entity_type", "entity_id");



CREATE INDEX "idx_audit_logs_org_created" ON "public"."audit_logs" USING "btree" ("organisation_id", "created_at" DESC);



CREATE INDEX "idx_report_runs_org_created" ON "public"."report_runs" USING "btree" ("organisation_id", "created_at" DESC);



CREATE INDEX "idx_report_schedules_org_active" ON "public"."report_schedules" USING "btree" ("organisation_id", "is_active");



CREATE INDEX "job_disputes_club_status_idx" ON "public"."job_disputes" USING "btree" ("club_slug", "status", "created_at" DESC);



CREATE INDEX "organisation_memberships_user_status_idx" ON "public"."organisation_memberships" USING "btree" ("user_id", "status");



CREATE INDEX "organisations_status_idx" ON "public"."organisations" USING "btree" ("status");



CREATE INDEX "promoter_commissions_org_idx" ON "public"."promoter_commissions" USING "btree" ("organisation_id", "payout_status");



CREATE INDEX "promoter_earnings_promoter_date_idx" ON "public"."promoter_earnings" USING "btree" ("promoter_id", "earning_date" DESC);



CREATE INDEX "promoter_guestlist_entries_pending_idx" ON "public"."promoter_guestlist_entries" USING "btree" ("created_at" DESC) WHERE ("approval_status" = 'pending'::"text");



CREATE INDEX "promoter_invoices_promoter_period_idx" ON "public"."promoter_invoices" USING "btree" ("promoter_id", "period_start", "period_end");



CREATE INDEX "promoter_jobs_promoter_date_idx" ON "public"."promoter_jobs" USING "btree" ("promoter_id", "job_date" DESC);



CREATE INDEX "promoter_night_adj_pending_idx" ON "public"."promoter_night_adjustments" USING "btree" ("created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "promoter_night_adj_promoter_date_idx" ON "public"."promoter_night_adjustments" USING "btree" ("promoter_id", "night_date" DESC);



CREATE INDEX "promoter_profile_revisions_promoter_idx" ON "public"."promoter_profile_revisions" USING "btree" ("promoter_id", "status");



CREATE INDEX "promoter_signup_requests_status_created_idx" ON "public"."promoter_signup_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "promoter_table_sales_date_idx" ON "public"."promoter_table_sales" USING "btree" ("sale_date" DESC);



CREATE INDEX "promoter_table_sales_pending_idx" ON "public"."promoter_table_sales" USING "btree" ("created_at" DESC) WHERE ("approval_status" = 'pending'::"text");



CREATE INDEX "promoter_table_sales_promoter_date_idx" ON "public"."promoter_table_sales" USING "btree" ("promoter_id", "sale_date" DESC);



CREATE INDEX "promoters_user_idx" ON "public"."promoters" USING "btree" ("user_id");



CREATE INDEX "saved_views_org_feature_idx" ON "public"."saved_views" USING "btree" ("organisation_id", "feature");



CREATE OR REPLACE TRIGGER "client_attendance_recalc_after_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."client_attendances" FOR EACH ROW EXECUTE FUNCTION "public"."client_attendance_recalc_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_financial_bookings" AFTER INSERT OR DELETE OR UPDATE ON "public"."financial_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "trg_audit_financial_promoters" AFTER INSERT OR DELETE OR UPDATE ON "public"."financial_promoters" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "trg_audit_financial_rules" AFTER INSERT OR DELETE OR UPDATE ON "public"."financial_rules" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "trg_financial_booking_status_history" AFTER INSERT OR UPDATE OF "payment_status" ON "public"."financial_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."log_booking_status_transition"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_financial_booking_id_fkey" FOREIGN KEY ("financial_booking_id") REFERENCES "public"."financial_bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_audience_members"
    ADD CONSTRAINT "campaign_audience_members_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "public"."campaign_audiences"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_audience_members"
    ADD CONSTRAINT "campaign_audience_members_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."guest_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_audiences"
    ADD CONSTRAINT "campaign_audiences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_attendances"
    ADD CONSTRAINT "client_attendances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_attendances"
    ADD CONSTRAINT "client_attendances_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."client_attendances"
    ADD CONSTRAINT "client_attendances_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_guestlist_activity"
    ADD CONSTRAINT "client_guestlist_activity_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_guestlist_activity"
    ADD CONSTRAINT "client_guestlist_activity_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_guestlist_activity"
    ADD CONSTRAINT "client_guestlist_activity_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."guest_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_guestlist_activity"
    ADD CONSTRAINT "client_guestlist_activity_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."guest_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_preferred_club_slug_fkey" FOREIGN KEY ("preferred_club_slug") REFERENCES "public"."clubs"("slug") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_preferred_promoter_id_fkey" FOREIGN KEY ("preferred_promoter_id") REFERENCES "public"."promoters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_accounts"
    ADD CONSTRAINT "club_accounts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_accounts"
    ADD CONSTRAINT "club_accounts_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_accounts"
    ADD CONSTRAINT "club_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_accounts"
    ADD CONSTRAINT "club_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_edit_revisions"
    ADD CONSTRAINT "club_edit_revisions_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_edit_revisions"
    ADD CONSTRAINT "club_edit_revisions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_edit_revisions"
    ADD CONSTRAINT "club_edit_revisions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_weekly_flyers"
    ADD CONSTRAINT "club_weekly_flyers_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dashboard_layouts"
    ADD CONSTRAINT "dashboard_layouts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_layouts"
    ADD CONSTRAINT "dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enquiry_guests"
    ADD CONSTRAINT "enquiry_guests_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_booking_nightlife"
    ADD CONSTRAINT "financial_booking_nightlife_financial_booking_id_fkey" FOREIGN KEY ("financial_booking_id") REFERENCES "public"."financial_bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_booking_service"
    ADD CONSTRAINT "financial_booking_service_financial_booking_id_fkey" FOREIGN KEY ("financial_booking_id") REFERENCES "public"."financial_bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."financial_promoters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."financial_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_bookings"
    ADD CONSTRAINT "financial_bookings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_config_change_requests"
    ADD CONSTRAINT "financial_config_change_requests_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_config_change_requests"
    ADD CONSTRAINT "financial_config_change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_config_change_requests"
    ADD CONSTRAINT "financial_config_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_promoters"
    ADD CONSTRAINT "financial_promoters_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_promoters"
    ADD CONSTRAINT "financial_promoters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_recurring_templates"
    ADD CONSTRAINT "financial_recurring_templates_payee_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."financial_payees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_rules"
    ADD CONSTRAINT "financial_rules_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_rules"
    ADD CONSTRAINT "financial_rules_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_payee_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."financial_payees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guest_identity_links"
    ADD CONSTRAINT "guest_identity_links_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."guest_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guestlist_checkins"
    ADD CONSTRAINT "guestlist_checkins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guestlist_checkins"
    ADD CONSTRAINT "guestlist_checkins_guestlist_signup_id_fkey" FOREIGN KEY ("guestlist_signup_id") REFERENCES "public"."guestlist_signups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guestlist_demographics"
    ADD CONSTRAINT "guestlist_demographics_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."guest_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guestlist_demographics"
    ADD CONSTRAINT "guestlist_demographics_guestlist_event_id_fkey" FOREIGN KEY ("guestlist_event_id") REFERENCES "public"."guestlist_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guestlist_events"
    ADD CONSTRAINT "guestlist_events_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guestlist_events"
    ADD CONSTRAINT "guestlist_events_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guestlist_signups"
    ADD CONSTRAINT "guestlist_signups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guestlist_signups"
    ADD CONSTRAINT "guestlist_signups_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."guest_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guestlist_signups"
    ADD CONSTRAINT "guestlist_signups_guestlist_event_id_fkey" FOREIGN KEY ("guestlist_event_id") REFERENCES "public"."guestlist_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_disputes"
    ADD CONSTRAINT "job_disputes_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_disputes"
    ADD CONSTRAINT "job_disputes_promoter_guestlist_entry_id_fkey" FOREIGN KEY ("promoter_guestlist_entry_id") REFERENCES "public"."promoter_guestlist_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_disputes"
    ADD CONSTRAINT "job_disputes_promoter_job_id_fkey" FOREIGN KEY ("promoter_job_id") REFERENCES "public"."promoter_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_disputes"
    ADD CONSTRAINT "job_disputes_promoter_table_sale_id_fkey" FOREIGN KEY ("promoter_table_sale_id") REFERENCES "public"."promoter_table_sales"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_disputes"
    ADD CONSTRAINT "job_disputes_raised_by_user_id_fkey" FOREIGN KEY ("raised_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_disputes"
    ADD CONSTRAINT "job_disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organisation_memberships"
    ADD CONSTRAINT "organisation_memberships_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organisation_memberships"
    ADD CONSTRAINT "organisation_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_availability"
    ADD CONSTRAINT "promoter_availability_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_club_preferences"
    ADD CONSTRAINT "promoter_club_preferences_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_club_preferences"
    ADD CONSTRAINT "promoter_club_preferences_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_commissions"
    ADD CONSTRAINT "promoter_commissions_financial_booking_id_fkey" FOREIGN KEY ("financial_booking_id") REFERENCES "public"."financial_bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_commissions"
    ADD CONSTRAINT "promoter_commissions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_commissions"
    ADD CONSTRAINT "promoter_commissions_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."financial_promoters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_earnings"
    ADD CONSTRAINT "promoter_earnings_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_earnings"
    ADD CONSTRAINT "promoter_earnings_promoter_job_id_fkey" FOREIGN KEY ("promoter_job_id") REFERENCES "public"."promoter_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_guestlist_entries"
    ADD CONSTRAINT "promoter_guestlist_entries_promoter_job_id_fkey" FOREIGN KEY ("promoter_job_id") REFERENCES "public"."promoter_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_guestlist_entries"
    ADD CONSTRAINT "promoter_guestlist_entries_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_invoice_lines"
    ADD CONSTRAINT "promoter_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."promoter_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_invoice_lines"
    ADD CONSTRAINT "promoter_invoice_lines_promoter_job_id_fkey" FOREIGN KEY ("promoter_job_id") REFERENCES "public"."promoter_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_invoices"
    ADD CONSTRAINT "promoter_invoices_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_jobs"
    ADD CONSTRAINT "promoter_jobs_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_jobs"
    ADD CONSTRAINT "promoter_jobs_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_night_adjustments"
    ADD CONSTRAINT "promoter_night_adjustments_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_night_adjustments"
    ADD CONSTRAINT "promoter_night_adjustments_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_payouts"
    ADD CONSTRAINT "promoter_payouts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_payouts"
    ADD CONSTRAINT "promoter_payouts_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."financial_promoters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_profile_revisions"
    ADD CONSTRAINT "promoter_profile_revisions_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_profile_revisions"
    ADD CONSTRAINT "promoter_profile_revisions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_signup_requests"
    ADD CONSTRAINT "promoter_signup_requests_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."promoter_signup_requests"
    ADD CONSTRAINT "promoter_signup_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."promoter_table_sales"
    ADD CONSTRAINT "promoter_table_sales_club_slug_fkey" FOREIGN KEY ("club_slug") REFERENCES "public"."clubs"("slug") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."promoter_table_sales"
    ADD CONSTRAINT "promoter_table_sales_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_table_sales"
    ADD CONSTRAINT "promoter_table_sales_promoter_job_id_fkey" FOREIGN KEY ("promoter_job_id") REFERENCES "public"."promoter_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoter_table_sales"
    ADD CONSTRAINT "promoter_table_sales_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_deliveries"
    ADD CONSTRAINT "report_deliveries_report_run_id_fkey" FOREIGN KEY ("report_run_id") REFERENCES "public"."report_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_views"
    ADD CONSTRAINT "saved_views_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_views"
    ADD CONSTRAINT "saved_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert" ON "public"."audit_logs" FOR INSERT WITH CHECK ("public"."has_organisation_access"("organisation_id"));



CREATE POLICY "audit_logs_select" ON "public"."audit_logs" FOR SELECT USING ("public"."has_organisation_access"("organisation_id"));



ALTER TABLE "public"."booking_status_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_status_history_read" ON "public"."booking_status_history" FOR SELECT TO "authenticated" USING ("public"."can_access_org_role"("organisation_id"));



CREATE POLICY "booking_status_history_write" ON "public"."booking_status_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'operations'::"text", 'finance'::"text"]));



ALTER TABLE "public"."campaign_audience_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_audience_members_admin" ON "public"."campaign_audience_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."campaign_audiences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_audiences_admin" ON "public"."campaign_audiences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."cars" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cars_admin_write" ON "public"."cars" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "cars_public_read" ON "public"."cars" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



ALTER TABLE "public"."client_attendances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_attendances_admin_all" ON "public"."client_attendances" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "client_attendances_promoter_delete" ON "public"."client_attendances" FOR DELETE TO "authenticated" USING (("promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "client_attendances_promoter_select" ON "public"."client_attendances" FOR SELECT TO "authenticated" USING ((("promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1)) OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_attendances"."client_id") AND ("c"."preferred_promoter_id" = ( SELECT "pr"."id"
           FROM "public"."promoters" "pr"
          WHERE ("pr"."user_id" = "auth"."uid"())
         LIMIT 1)))))));



CREATE POLICY "client_attendances_promoter_update" ON "public"."client_attendances" FOR UPDATE TO "authenticated" USING (("promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "client_attendances_promoter_write" ON "public"."client_attendances" FOR INSERT TO "authenticated" WITH CHECK (("promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1)));



ALTER TABLE "public"."client_guestlist_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_guestlist_activity_admin_all" ON "public"."client_guestlist_activity" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_admin_insert" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "clients_admin_select" ON "public"."clients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "clients_delete_admin" ON "public"."clients" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "clients_insert_admin" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "clients_promoter_insert" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK (("preferred_promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "clients_promoter_select" ON "public"."clients" FOR SELECT TO "authenticated" USING (("preferred_promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "clients_promoter_update" ON "public"."clients" FOR UPDATE TO "authenticated" USING (("preferred_promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("preferred_promoter_id" = ( SELECT "pr"."id"
   FROM "public"."promoters" "pr"
  WHERE ("pr"."user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "clients_select_admin" ON "public"."clients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "clients_update_admin" ON "public"."clients" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."club_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_accounts_admin_or_owner_read" ON "public"."club_accounts" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "club_accounts_admin_write" ON "public"."club_accounts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."club_edit_revisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_edit_revisions_admin_or_scoped" ON "public"."club_edit_revisions" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("submitted_by" = "auth"."uid"()) OR "public"."club_account_for_user"("auth"."uid"(), "club_slug"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("submitted_by" = "auth"."uid"()) OR "public"."club_account_for_user"("auth"."uid"(), "club_slug")));



ALTER TABLE "public"."club_weekly_flyers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clubs_admin_write" ON "public"."clubs" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."club_accounts" "ca"
  WHERE (("ca"."user_id" = "auth"."uid"()) AND ("ca"."status" = 'active'::"text") AND ("ca"."club_slug" = "clubs"."slug")))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."club_accounts" "ca"
  WHERE (("ca"."user_id" = "auth"."uid"()) AND ("ca"."status" = 'active'::"text") AND ("ca"."club_slug" = "clubs"."slug"))))));



CREATE POLICY "clubs_public_read" ON "public"."clubs" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



ALTER TABLE "public"."dashboard_layouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_layouts_read" ON "public"."dashboard_layouts" FOR SELECT TO "authenticated" USING ("public"."has_organisation_access"("organisation_id"));



CREATE POLICY "dashboard_layouts_write" ON "public"."dashboard_layouts" TO "authenticated" USING (("public"."has_organisation_access"("organisation_id") AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"())))) WITH CHECK (("public"."has_organisation_access"("organisation_id") AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()))));



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_read" ON "public"."departments" FOR SELECT TO "authenticated" USING ("public"."has_organisation_access"("organisation_id"));



CREATE POLICY "departments_write" ON "public"."departments" TO "authenticated" USING ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) WITH CHECK ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"]));



ALTER TABLE "public"."enquiries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enquiries_admin_update" ON "public"."enquiries" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "enquiries_no_public_read" ON "public"."enquiries" FOR SELECT TO "anon" USING (false);



CREATE POLICY "enquiries_public_insert" ON "public"."enquiries" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "enquiries_team_read" ON "public"."enquiries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'host'::"text"]))))));



ALTER TABLE "public"."enquiry_guests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enquiry_guests_public_insert" ON "public"."enquiry_guests" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "enquiry_guests_team_read" ON "public"."enquiry_guests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'host'::"text"]))))));



ALTER TABLE "public"."financial_booking_nightlife" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_booking_nightlife_read" ON "public"."financial_booking_nightlife" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."financial_bookings" "fb"
  WHERE (("fb"."id" = "financial_booking_nightlife"."financial_booking_id") AND ("fb"."organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("fb"."organisation_id")))));



CREATE POLICY "financial_booking_nightlife_write" ON "public"."financial_booking_nightlife" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."financial_bookings" "fb"
  WHERE (("fb"."id" = "financial_booking_nightlife"."financial_booking_id") AND ("fb"."organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("fb"."organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'analyst'::"public"."member_role"]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."financial_bookings" "fb"
  WHERE (("fb"."id" = "financial_booking_nightlife"."financial_booking_id") AND ("fb"."organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("fb"."organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'analyst'::"public"."member_role"])))));



ALTER TABLE "public"."financial_booking_service" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_booking_service_read" ON "public"."financial_booking_service" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."financial_bookings" "fb"
  WHERE (("fb"."id" = "financial_booking_service"."financial_booking_id") AND ("fb"."organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("fb"."organisation_id")))));



CREATE POLICY "financial_booking_service_write" ON "public"."financial_booking_service" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."financial_bookings" "fb"
  WHERE (("fb"."id" = "financial_booking_service"."financial_booking_id") AND ("fb"."organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("fb"."organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'analyst'::"public"."member_role"]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."financial_bookings" "fb"
  WHERE (("fb"."id" = "financial_booking_service"."financial_booking_id") AND ("fb"."organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("fb"."organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'analyst'::"public"."member_role"])))));



ALTER TABLE "public"."financial_bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_bookings_read" ON "public"."financial_bookings" FOR SELECT TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id")));



CREATE POLICY "financial_bookings_write" ON "public"."financial_bookings" TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text"]))) WITH CHECK ((("organisation_id" IS NOT NULL) AND "public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text"])));



CREATE POLICY "financial_cfg_requests_insert" ON "public"."financial_config_change_requests" FOR INSERT TO "authenticated" WITH CHECK ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'analyst'::"public"."member_role"])));



CREATE POLICY "financial_cfg_requests_read" ON "public"."financial_config_change_requests" FOR SELECT TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id")));



CREATE POLICY "financial_cfg_requests_update" ON "public"."financial_config_change_requests" FOR UPDATE TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"]))) WITH CHECK ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])));



ALTER TABLE "public"."financial_config_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_payees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_payees_admin" ON "public"."financial_payees" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."financial_promoters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_promoters_read" ON "public"."financial_promoters" FOR SELECT TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id")));



CREATE POLICY "financial_promoters_write" ON "public"."financial_promoters" TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"]))) WITH CHECK ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])));



ALTER TABLE "public"."financial_recurring_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_recurring_templates_admin" ON "public"."financial_recurring_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."financial_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_rules_read" ON "public"."financial_rules" FOR SELECT TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id")));



CREATE POLICY "financial_rules_write" ON "public"."financial_rules" TO "authenticated" USING ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"]))) WITH CHECK ((("organisation_id" IS NOT NULL) AND "public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])));



ALTER TABLE "public"."financial_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_transactions_admin" ON "public"."financial_transactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "flyers_admin_write" ON "public"."club_weekly_flyers" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."club_accounts" "ca"
  WHERE (("ca"."user_id" = "auth"."uid"()) AND ("ca"."status" = 'active'::"text") AND ("ca"."club_slug" = "club_weekly_flyers"."club_slug")))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."club_accounts" "ca"
  WHERE (("ca"."user_id" = "auth"."uid"()) AND ("ca"."status" = 'active'::"text") AND ("ca"."club_slug" = "club_weekly_flyers"."club_slug"))))));



CREATE POLICY "flyers_public_read" ON "public"."club_weekly_flyers" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



ALTER TABLE "public"."guest_identity_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guest_identity_links_admin" ON "public"."guest_identity_links" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."guest_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guest_profiles_admin" ON "public"."guest_profiles" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."guestlist_checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guestlist_checkins_admin" ON "public"."guestlist_checkins" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."guestlist_demographics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guestlist_demographics_admin" ON "public"."guestlist_demographics" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."guestlist_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guestlist_events_admin" ON "public"."guestlist_events" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."guestlist_signups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guestlist_signups_admin" ON "public"."guestlist_signups" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'promoter'::"text"]))))));



ALTER TABLE "public"."job_disputes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_disputes_admin_or_scoped" ON "public"."job_disputes" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("raised_by_user_id" = "auth"."uid"()) OR "public"."club_account_for_user"("auth"."uid"(), "club_slug"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))) OR ("raised_by_user_id" = "auth"."uid"()) OR "public"."club_account_for_user"("auth"."uid"(), "club_slug")));



ALTER TABLE "public"."organisation_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organisation_memberships_read" ON "public"."organisation_memberships" FOR SELECT TO "authenticated" USING ("public"."has_organisation_access"("organisation_id"));



CREATE POLICY "organisation_memberships_write" ON "public"."organisation_memberships" TO "authenticated" USING ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"])) WITH CHECK ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"]));



ALTER TABLE "public"."organisations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organisations_read" ON "public"."organisations" FOR SELECT TO "authenticated" USING ("public"."has_organisation_access"("id"));



CREATE POLICY "profile_revisions_admin" ON "public"."promoter_profile_revisions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "profile_revisions_promoter_insert" ON "public"."promoter_profile_revisions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_profile_revisions"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "profile_revisions_promoter_select" ON "public"."promoter_profile_revisions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_profile_revisions"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_self_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_self_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."promoter_availability" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_availability_admin" ON "public"."promoter_availability" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_availability_self" ON "public"."promoter_availability" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_availability"."promoter_id") AND ("pr"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_availability"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoter_club_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promoter_commissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_commissions_read" ON "public"."promoter_commissions" FOR SELECT TO "authenticated" USING (("public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text", 'viewer'::"text"]) OR (EXISTS ( SELECT 1
   FROM "public"."financial_promoters" "fp"
  WHERE (("fp"."id" = "promoter_commissions"."promoter_id") AND ("fp"."user_id" = "auth"."uid"()))))));



CREATE POLICY "promoter_commissions_write" ON "public"."promoter_commissions" TO "authenticated" USING ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'analyst'::"public"."member_role"])) WITH CHECK ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'analyst'::"public"."member_role"]));



ALTER TABLE "public"."promoter_earnings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_earnings_admin" ON "public"."promoter_earnings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_earnings_promoter_select" ON "public"."promoter_earnings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_earnings"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoter_guestlist_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_guestlist_entries_admin" ON "public"."promoter_guestlist_entries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."promoter_jobs" "j"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("j"."id" = "promoter_guestlist_entries"."promoter_job_id") AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."promoter_jobs" "j"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("j"."id" = "promoter_guestlist_entries"."promoter_job_id") AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_guestlist_entries_promoter_select" ON "public"."promoter_guestlist_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."promoter_jobs" "j"
     JOIN "public"."promoters" "pr" ON (("pr"."id" = "j"."promoter_id")))
  WHERE (("j"."id" = "promoter_guestlist_entries"."promoter_job_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoter_invoice_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_invoice_lines_admin" ON "public"."promoter_invoice_lines" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."promoter_invoices" "i"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("i"."id" = "promoter_invoice_lines"."invoice_id") AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."promoter_invoices" "i"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("i"."id" = "promoter_invoice_lines"."invoice_id") AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_invoice_lines_promoter_select" ON "public"."promoter_invoice_lines" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."promoter_invoices" "i"
     JOIN "public"."promoters" "pr" ON (("pr"."id" = "i"."promoter_id")))
  WHERE (("i"."id" = "promoter_invoice_lines"."invoice_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoter_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_invoices_admin" ON "public"."promoter_invoices" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_invoices_promoter_select" ON "public"."promoter_invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_invoices"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoter_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_jobs_admin" ON "public"."promoter_jobs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_jobs_promoter_select" ON "public"."promoter_jobs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_jobs"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "promoter_night_adj_admin" ON "public"."promoter_night_adjustments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_night_adj_promoter_select" ON "public"."promoter_night_adjustments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_night_adjustments"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoter_night_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promoter_payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_payouts_read" ON "public"."promoter_payouts" FOR SELECT TO "authenticated" USING ("public"."has_organisation_access"("organisation_id"));



CREATE POLICY "promoter_payouts_write" ON "public"."promoter_payouts" TO "authenticated" USING ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) WITH CHECK ("public"."has_organisation_access"("organisation_id", ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"]));



CREATE POLICY "promoter_preferences_admin" ON "public"."promoter_club_preferences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_preferences_self" ON "public"."promoter_club_preferences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_club_preferences"."promoter_id") AND ("pr"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_club_preferences"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoter_profile_revisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promoter_signup_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_signup_requests_insert_public" ON "public"."promoter_signup_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("status" = 'pending'::"text") AND ("length"(TRIM(BOTH FROM "full_name")) >= 1) AND ("length"(TRIM(BOTH FROM "email")) >= 3)));



CREATE POLICY "promoter_signup_requests_select_admin" ON "public"."promoter_signup_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."promoter_table_sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_table_sales_admin" ON "public"."promoter_table_sales" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoter_table_sales_promoter_select" ON "public"."promoter_table_sales" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."promoters" "pr"
  WHERE (("pr"."id" = "promoter_table_sales"."promoter_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."promoters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoters_admin_select" ON "public"."promoters" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoters_admin_write" ON "public"."promoters" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "promoters_self_insert" ON "public"."promoters" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "promoters_self_select" ON "public"."promoters" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "promoters_self_update" ON "public"."promoters" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."report_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_deliveries_select" ON "public"."report_deliveries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."report_runs" "rr"
  WHERE (("rr"."id" = "report_deliveries"."report_run_id") AND "public"."has_organisation_access"("rr"."organisation_id")))));



ALTER TABLE "public"."report_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_runs_manage" ON "public"."report_runs" USING ("public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'finance'::"text"])) WITH CHECK ("public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'finance'::"text"]));



CREATE POLICY "report_runs_select" ON "public"."report_runs" FOR SELECT USING ("public"."has_organisation_access"("organisation_id"));



ALTER TABLE "public"."report_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_schedules_manage" ON "public"."report_schedules" USING ("public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'finance'::"text"])) WITH CHECK ("public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'finance'::"text"]));



CREATE POLICY "report_schedules_select" ON "public"."report_schedules" FOR SELECT USING ("public"."has_organisation_access"("organisation_id"));



ALTER TABLE "public"."report_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_templates_manage" ON "public"."report_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organisation_memberships" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."status" = 'active'::"text") AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'finance'::"public"."member_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organisation_memberships" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."status" = 'active'::"text") AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'finance'::"public"."member_role"]))))));



CREATE POLICY "report_templates_select" ON "public"."report_templates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."saved_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_views_read" ON "public"."saved_views" FOR SELECT TO "authenticated" USING (("public"."can_access_org_role"("organisation_id") AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()))));



CREATE POLICY "saved_views_write" ON "public"."saved_views" TO "authenticated" USING (((("user_id" IS NULL) AND "public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text"])) OR (("user_id" = "auth"."uid"()) AND "public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text", 'promoter'::"text", 'viewer'::"text"])))) WITH CHECK (((("user_id" IS NULL) AND "public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text"])) OR (("user_id" = "auth"."uid"()) AND "public"."can_access_org_role"("organisation_id", ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'finance'::"text", 'operations'::"text", 'promoter'::"text", 'viewer'::"text"]))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_club_day_key"("raw" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_club_day_key"("raw" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_club_day_key"("raw" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_pref_weekdays_include_dow"("p_weekdays" "text"[], "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."_pref_weekdays_include_dow"("p_weekdays" "text"[], "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_pref_weekdays_include_dow"("p_weekdays" "text"[], "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_club_invite"("p_invite_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_club_invite"("p_invite_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_club_invite"("p_invite_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_insert_table_sale"("p_promoter_id" "uuid", "p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_insert_table_sale"("p_promoter_id" "uuid", "p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_insert_table_sale"("p_promoter_id" "uuid", "p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_issue_club_invite"("p_club_slug" "text", "p_invite_email" "text", "p_role" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_issue_club_invite"("p_club_slug" "text", "p_invite_email" "text", "p_role" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_issue_club_invite"("p_club_slug" "text", "p_invite_email" "text", "p_role" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_review_guestlist_entry"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_review_guestlist_entry"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_review_guestlist_entry"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_review_night_adjustment"("p_adjustment_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_review_night_adjustment"("p_adjustment_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_review_night_adjustment"("p_adjustment_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_review_table_sale"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_review_table_sale"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_review_table_sale"("p_entry_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_recurring_financial_transactions"("p_through" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_recurring_financial_transactions"("p_through" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_recurring_financial_transactions"("p_through" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_promoter_profile_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_promoter_profile_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_promoter_profile_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_promoter_earnings"("p_promoter_id" "uuid", "p_from" "date", "p_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_promoter_earnings"("p_promoter_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_promoter_earnings"("p_promoter_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_org_role"("p_organisation_id" "uuid", "p_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_org_role"("p_organisation_id" "uuid", "p_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_org_role"("p_organisation_id" "uuid", "p_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_request_financial_rule_change"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_request_financial_rule_change"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_request_financial_rule_change"("p_target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."client_attendance_recalc_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."client_attendance_recalc_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."client_attendance_recalc_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."club_account_for_user"("p_user_id" "uuid", "p_club_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."club_account_for_user"("p_user_id" "uuid", "p_club_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_account_for_user"("p_user_id" "uuid", "p_club_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."club_decide_promoter_job"("p_job_id" "uuid", "p_decision" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."club_decide_promoter_job"("p_job_id" "uuid", "p_decision" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_decide_promoter_job"("p_job_id" "uuid", "p_decision" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."club_set_promoter_preference_access"("p_preference_id" "uuid", "p_allow" boolean, "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."club_set_promoter_preference_access"("p_preference_id" "uuid", "p_allow" boolean, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_set_promoter_preference_access"("p_preference_id" "uuid", "p_allow" boolean, "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_clients_from_enquiry"("p_enquiry_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_clients_from_enquiry"("p_enquiry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_clients_from_enquiry"("p_enquiry_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_guestlist_signup_bundle"("p_club_slug" "text", "p_event_date" "date", "p_source" "text", "p_guests" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_guestlist_signup_bundle"("p_club_slug" "text", "p_event_date" "date", "p_source" "text", "p_guests" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_guestlist_signup_bundle"("p_club_slug" "text", "p_event_date" "date", "p_source" "text", "p_guests" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_report_run"("p_organisation_id" "uuid", "p_template_code" "text", "p_format" "text", "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_report_run"("p_organisation_id" "uuid", "p_template_code" "text", "p_format" "text", "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_report_run"("p_organisation_id" "uuid", "p_template_code" "text", "p_format" "text", "p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_report_schedule"("p_organisation_id" "uuid", "p_template_code" "text", "p_frequency" "text", "p_recipients" "text"[], "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_report_schedule"("p_organisation_id" "uuid", "p_template_code" "text", "p_frequency" "text", "p_recipients" "text"[], "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_report_schedule"("p_organisation_id" "uuid", "p_template_code" "text", "p_frequency" "text", "p_recipients" "text"[], "p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_organisation_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_organisation_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_organisation_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_promoter_job_safe"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_promoter_job_safe"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_promoter_job_safe"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_campaign_audience"("p_name" "text", "p_description" "text", "p_filter_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_campaign_audience"("p_name" "text", "p_description" "text", "p_filter_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_campaign_audience"("p_name" "text", "p_description" "text", "p_filter_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_promoter_invoice"("p_promoter_id" "uuid", "p_period_start" "date", "p_period_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_promoter_invoice"("p_promoter_id" "uuid", "p_period_start" "date", "p_period_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_promoter_invoice"("p_promoter_id" "uuid", "p_period_start" "date", "p_period_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_audit_logs"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_audit_logs"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_audit_logs"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_booking_detail_drawer"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_booking_detail_drawer"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booking_detail_drawer"("p_booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_dashboard_org_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_dashboard_org_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_org_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_department_breakdown"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_department_breakdown"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_department_breakdown"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_finance_bookings_table"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_finance_bookings_table"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_finance_bookings_table"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_finance_timeseries"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_finance_timeseries"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_finance_timeseries"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_financial_dashboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_financial_dashboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_dashboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_dashboard_snapshot"("p_from" "date", "p_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_dashboard_snapshot"("p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_dashboard_snapshot"("p_from" "date", "p_to" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_period_summary"("p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_period_summary"("p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_period_summary"("p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_report"("p_period_type" "text", "p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_report"("p_period_type" "text", "p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_report"("p_period_type" "text", "p_from" "date", "p_to" "date", "p_direction" "text", "p_status" "text", "p_payment_tag" "text", "p_payee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_guestlist_conversion_metrics"("p_club_slug" "text", "p_promoter_id" "uuid", "p_from" "date", "p_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_guestlist_conversion_metrics"("p_club_slug" "text", "p_promoter_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_guestlist_conversion_metrics"("p_club_slug" "text", "p_promoter_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_near_bonus_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_near_bonus_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_near_bonus_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_outstanding_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_outstanding_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_outstanding_bookings"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_promoter_leaderboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_promoter_leaderboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_promoter_leaderboard"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_promoter_payouts"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_promoter_payouts"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_promoter_payouts"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_report_templates"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_report_templates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_report_templates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_venue_performance"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_venue_performance"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_venue_performance"("p_organisation_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."guestlist_hosts_for_date"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."guestlist_hosts_for_date"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."guestlist_hosts_for_date"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_organisation_access"("p_organisation_id" "uuid", "p_roles" "public"."member_role"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_organisation_access"("p_organisation_id" "uuid", "p_roles" "public"."member_role"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_organisation_access"("p_organisation_id" "uuid", "p_roles" "public"."member_role"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_promoter_guestlist_entry"("p_job_id" "uuid", "p_guest_name" "text", "p_guest_contact" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_promoter_guestlist_entry"("p_job_id" "uuid", "p_guest_name" "text", "p_guest_contact" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_promoter_guestlist_entry"("p_job_id" "uuid", "p_guest_name" "text", "p_guest_contact" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_promoter_job_self"("p_club_slug" "text", "p_job_date" "date", "p_service" "text", "p_shift_fee" numeric, "p_guestlist_fee" numeric, "p_guests_count" integer, "p_notes" "text", "p_status" "text", "p_client_name" "text", "p_client_contact" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_promoter_job_self"("p_club_slug" "text", "p_job_date" "date", "p_service" "text", "p_shift_fee" numeric, "p_guestlist_fee" numeric, "p_guests_count" integer, "p_notes" "text", "p_status" "text", "p_client_name" "text", "p_client_contact" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_promoter_job_self"("p_club_slug" "text", "p_job_date" "date", "p_service" "text", "p_shift_fee" numeric, "p_guestlist_fee" numeric, "p_guests_count" integer, "p_notes" "text", "p_status" "text", "p_client_name" "text", "p_client_contact" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_promoter_table_sale"("p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_promoter_table_sale"("p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_promoter_table_sale"("p_sale_date" "date", "p_club_slug" "text", "p_promoter_job_id" "uuid", "p_tier" "text", "p_table_count" integer, "p_total_min_spend" numeric, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_financial_club_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_financial_club_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_financial_club_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_financial_editor"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_financial_editor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_financial_editor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_financial_reader"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_financial_reader"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_financial_reader"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_report_runs"("p_organisation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_report_runs"("p_organisation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_report_runs"("p_organisation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_booking_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_booking_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_booking_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_signup_to_attended"("p_signup_id" "uuid", "p_source" "text", "p_checked_in_by" "uuid", "p_age" smallint, "p_gender" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."promote_signup_to_attended"("p_signup_id" "uuid", "p_source" "text", "p_checked_in_by" "uuid", "p_age" smallint, "p_gender" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_signup_to_attended"("p_signup_id" "uuid", "p_source" "text", "p_checked_in_by" "uuid", "p_age" smallint, "p_gender" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_client_preferences"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_client_preferences"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_client_preferences"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_audit_log"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text", "p_action" "text", "p_summary" "text", "p_changes" "jsonb", "p_source" "text", "p_ip_address" "inet") TO "anon";
GRANT ALL ON FUNCTION "public"."record_audit_log"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text", "p_action" "text", "p_summary" "text", "p_changes" "jsonb", "p_source" "text", "p_ip_address" "inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_audit_log"("p_organisation_id" "uuid", "p_entity_type" "text", "p_entity_id" "text", "p_action" "text", "p_summary" "text", "p_changes" "jsonb", "p_source" "text", "p_ip_address" "inet") TO "service_role";



GRANT ALL ON FUNCTION "public"."review_club_edit_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."review_club_edit_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_club_edit_revision"("p_revision_id" "uuid", "p_approve" boolean, "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."review_job_dispute"("p_dispute_id" "uuid", "p_status" "text", "p_resolution_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."review_job_dispute"("p_dispute_id" "uuid", "p_status" "text", "p_resolution_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_job_dispute"("p_dispute_id" "uuid", "p_status" "text", "p_resolution_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_booking_detail_drawer"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_booking_detail_drawer"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_booking_detail_drawer"("p_booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_dashboard_org_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_dashboard_org_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_org_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_department_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_department_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_department_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_finance_bookings_table"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_finance_bookings_table"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_finance_bookings_table"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_finance_overview"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_finance_overview"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_finance_overview"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_finance_timeseries"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_finance_timeseries"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_finance_timeseries"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_near_bonus_alerts"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_near_bonus_alerts"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_near_bonus_alerts"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_promoter_commissions"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_promoter_commissions"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_promoter_commissions"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_service_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_service_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_service_performance"("p_org_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_department" "text", "p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_club_edit_revision"("p_club_slug" "text", "p_target_type" "text", "p_target_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_club_edit_revision"("p_club_slug" "text", "p_target_type" "text", "p_target_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_club_edit_revision"("p_club_slug" "text", "p_target_type" "text", "p_target_id" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_job_dispute"("p_promoter_job_id" "uuid", "p_reason_code" "text", "p_description" "text", "p_evidence" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_job_dispute"("p_promoter_job_id" "uuid", "p_reason_code" "text", "p_description" "text", "p_evidence" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_job_dispute"("p_promoter_job_id" "uuid", "p_reason_code" "text", "p_description" "text", "p_evidence" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_website_enquiry"("p_form_name" "text", "p_form_label" "text", "p_service" "text", "p_client_key" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_payload" "jsonb", "p_guests" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_website_enquiry"("p_form_name" "text", "p_form_label" "text", "p_service" "text", "p_client_key" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_payload" "jsonb", "p_guests" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_website_enquiry"("p_form_name" "text", "p_form_label" "text", "p_service" "text", "p_client_key" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_payload" "jsonb", "p_guests" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_crm_clients_from_guestlist_batch"("p_enquiry_id" "uuid", "p_club_slug" "text", "p_event_date" "date", "p_guests" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_crm_clients_from_guestlist_batch"("p_enquiry_id" "uuid", "p_club_slug" "text", "p_event_date" "date", "p_guests" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_crm_clients_from_guestlist_batch"("p_enquiry_id" "uuid", "p_club_slug" "text", "p_event_date" "date", "p_guests" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_crm_clients_from_guestlist_batch"("p_enquiry_id" "uuid", "p_club_slug" "text", "p_event_date" "date", "p_guests" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_guest_profile_from_identity"("p_full_name" "text", "p_phone" "text", "p_email" "text", "p_instagram" "text", "p_age" smallint, "p_gender" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_guest_profile_from_identity"("p_full_name" "text", "p_phone" "text", "p_email" "text", "p_instagram" "text", "p_age" smallint, "p_gender" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_guest_profile_from_identity"("p_full_name" "text", "p_phone" "text", "p_email" "text", "p_instagram" "text", "p_age" smallint, "p_gender" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_promoter_night_adjustment"("p_night_date" "date", "p_available_override" boolean, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_promoter_night_adjustment"("p_night_date" "date", "p_available_override" boolean, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_promoter_night_adjustment"("p_night_date" "date", "p_available_override" boolean, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_notes" "text") TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."financial_booking_nightlife" TO "anon";
GRANT ALL ON TABLE "public"."financial_booking_nightlife" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_booking_nightlife" TO "service_role";



GRANT ALL ON TABLE "public"."financial_booking_service" TO "anon";
GRANT ALL ON TABLE "public"."financial_booking_service" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_booking_service" TO "service_role";



GRANT ALL ON TABLE "public"."financial_bookings" TO "anon";
GRANT ALL ON TABLE "public"."financial_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."financial_promoters" TO "anon";
GRANT ALL ON TABLE "public"."financial_promoters" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_promoters" TO "service_role";



GRANT ALL ON TABLE "public"."financial_rules" TO "anon";
GRANT ALL ON TABLE "public"."financial_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_rules" TO "service_role";



GRANT ALL ON TABLE "public"."booking_financials" TO "anon";
GRANT ALL ON TABLE "public"."booking_financials" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_financials" TO "service_role";



GRANT ALL ON TABLE "public"."booking_status_history" TO "anon";
GRANT ALL ON TABLE "public"."booking_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_audience_members" TO "anon";
GRANT ALL ON TABLE "public"."campaign_audience_members" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_audience_members" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_audiences" TO "anon";
GRANT ALL ON TABLE "public"."campaign_audiences" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_audiences" TO "service_role";



GRANT ALL ON TABLE "public"."cars" TO "anon";
GRANT ALL ON TABLE "public"."cars" TO "authenticated";
GRANT ALL ON TABLE "public"."cars" TO "service_role";



GRANT ALL ON TABLE "public"."client_attendances" TO "anon";
GRANT ALL ON TABLE "public"."client_attendances" TO "authenticated";
GRANT ALL ON TABLE "public"."client_attendances" TO "service_role";



GRANT ALL ON TABLE "public"."client_guestlist_activity" TO "anon";
GRANT ALL ON TABLE "public"."client_guestlist_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."client_guestlist_activity" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."club_accounts" TO "anon";
GRANT ALL ON TABLE "public"."club_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."club_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."club_edit_revisions" TO "anon";
GRANT ALL ON TABLE "public"."club_edit_revisions" TO "authenticated";
GRANT ALL ON TABLE "public"."club_edit_revisions" TO "service_role";



GRANT ALL ON TABLE "public"."club_weekly_flyers" TO "anon";
GRANT ALL ON TABLE "public"."club_weekly_flyers" TO "authenticated";
GRANT ALL ON TABLE "public"."club_weekly_flyers" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_layouts" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_layouts" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_layouts" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."enquiries" TO "anon";
GRANT ALL ON TABLE "public"."enquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."enquiries" TO "service_role";



GRANT ALL ON TABLE "public"."enquiry_guests" TO "anon";
GRANT ALL ON TABLE "public"."enquiry_guests" TO "authenticated";
GRANT ALL ON TABLE "public"."enquiry_guests" TO "service_role";



GRANT ALL ON TABLE "public"."financial_config_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."financial_config_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_config_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."financial_payees" TO "anon";
GRANT ALL ON TABLE "public"."financial_payees" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_payees" TO "service_role";



GRANT ALL ON TABLE "public"."financial_recurring_templates" TO "anon";
GRANT ALL ON TABLE "public"."financial_recurring_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_recurring_templates" TO "service_role";



GRANT ALL ON TABLE "public"."financial_transactions" TO "anon";
GRANT ALL ON TABLE "public"."financial_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."guest_identity_links" TO "anon";
GRANT ALL ON TABLE "public"."guest_identity_links" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_identity_links" TO "service_role";



GRANT ALL ON TABLE "public"."guest_profiles" TO "anon";
GRANT ALL ON TABLE "public"."guest_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."guestlist_checkins" TO "anon";
GRANT ALL ON TABLE "public"."guestlist_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."guestlist_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."guestlist_demographics" TO "anon";
GRANT ALL ON TABLE "public"."guestlist_demographics" TO "authenticated";
GRANT ALL ON TABLE "public"."guestlist_demographics" TO "service_role";



GRANT ALL ON TABLE "public"."guestlist_events" TO "anon";
GRANT ALL ON TABLE "public"."guestlist_events" TO "authenticated";
GRANT ALL ON TABLE "public"."guestlist_events" TO "service_role";



GRANT ALL ON TABLE "public"."guestlist_signups" TO "anon";
GRANT ALL ON TABLE "public"."guestlist_signups" TO "authenticated";
GRANT ALL ON TABLE "public"."guestlist_signups" TO "service_role";



GRANT ALL ON TABLE "public"."job_disputes" TO "anon";
GRANT ALL ON TABLE "public"."job_disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."job_disputes" TO "service_role";



GRANT ALL ON TABLE "public"."organisation_memberships" TO "anon";
GRANT ALL ON TABLE "public"."organisation_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."organisation_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."organisations" TO "anon";
GRANT ALL ON TABLE "public"."organisations" TO "authenticated";
GRANT ALL ON TABLE "public"."organisations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_availability" TO "anon";
GRANT ALL ON TABLE "public"."promoter_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_availability" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_club_preferences" TO "anon";
GRANT ALL ON TABLE "public"."promoter_club_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_club_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_commissions" TO "anon";
GRANT ALL ON TABLE "public"."promoter_commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_commissions" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_earnings" TO "anon";
GRANT ALL ON TABLE "public"."promoter_earnings" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_earnings" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_guestlist_entries" TO "anon";
GRANT ALL ON TABLE "public"."promoter_guestlist_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_guestlist_entries" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_invoice_lines" TO "anon";
GRANT ALL ON TABLE "public"."promoter_invoice_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_invoice_lines" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_invoices" TO "anon";
GRANT ALL ON TABLE "public"."promoter_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_jobs" TO "anon";
GRANT ALL ON TABLE "public"."promoter_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_night_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."promoter_night_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_night_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_payouts" TO "anon";
GRANT ALL ON TABLE "public"."promoter_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_profile_revisions" TO "anon";
GRANT ALL ON TABLE "public"."promoter_profile_revisions" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_profile_revisions" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_signup_requests" TO "anon";
GRANT ALL ON TABLE "public"."promoter_signup_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_signup_requests" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_table_sales" TO "anon";
GRANT ALL ON TABLE "public"."promoter_table_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_table_sales" TO "service_role";



GRANT ALL ON TABLE "public"."promoters" TO "anon";
GRANT ALL ON TABLE "public"."promoters" TO "authenticated";
GRANT ALL ON TABLE "public"."promoters" TO "service_role";



GRANT ALL ON TABLE "public"."report_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."report_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."report_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."report_runs" TO "anon";
GRANT ALL ON TABLE "public"."report_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."report_runs" TO "service_role";



GRANT ALL ON TABLE "public"."report_schedules" TO "anon";
GRANT ALL ON TABLE "public"."report_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."report_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."report_templates" TO "anon";
GRANT ALL ON TABLE "public"."report_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."report_templates" TO "service_role";



GRANT ALL ON TABLE "public"."saved_views" TO "anon";
GRANT ALL ON TABLE "public"."saved_views" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_views" TO "service_role";



GRANT ALL ON TABLE "public"."vw_finance_booking_fact" TO "anon";
GRANT ALL ON TABLE "public"."vw_finance_booking_fact" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_finance_booking_fact" TO "service_role";



GRANT ALL ON TABLE "public"."vw_department_performance" TO "anon";
GRANT ALL ON TABLE "public"."vw_department_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_department_performance" TO "service_role";



GRANT ALL ON TABLE "public"."vw_finance_profit_fact" TO "anon";
GRANT ALL ON TABLE "public"."vw_finance_profit_fact" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_finance_profit_fact" TO "service_role";



GRANT ALL ON TABLE "public"."vw_near_bonus_alerts" TO "anon";
GRANT ALL ON TABLE "public"."vw_near_bonus_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_near_bonus_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."vw_promoter_performance" TO "anon";
GRANT ALL ON TABLE "public"."vw_promoter_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_promoter_performance" TO "service_role";



GRANT ALL ON TABLE "public"."vw_service_performance" TO "anon";
GRANT ALL ON TABLE "public"."vw_service_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_service_performance" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







