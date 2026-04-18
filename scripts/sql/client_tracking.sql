-- Client CRM extensions + guestlist activity + signup sync.
-- If `public.clients` already has RLS policies, review and merge instead of
-- duplicating conflicting rules before running the clients_* policy section.
-- Prerequisites: public.clients, public.enquiries, public.guest_profiles,
--   public.guestlist_events, public.promoters, RPC public.upsert_guest_profile_from_identity,
--   RPC public.create_guestlist_signup_bundle (website flow).
-- Run in Supabase SQL editor or via migration tooling.

-- —— 1) Extend clients ——
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS guest_profile_id uuid REFERENCES public.guest_profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS typical_spend_gbp numeric(12, 2),
  ADD COLUMN IF NOT EXISTS preferred_nights text,
  ADD COLUMN IF NOT EXISTS preferred_promoter_id uuid REFERENCES public.promoters (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_guest_profile_id_idx
  ON public.clients (guest_profile_id)
  WHERE guest_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_preferred_promoter_idx
  ON public.clients (preferred_promoter_id)
  WHERE preferred_promoter_id IS NOT NULL;

COMMENT ON COLUMN public.clients.notes IS 'Internal CRM notes (admin).';
COMMENT ON COLUMN public.clients.typical_spend_gbp IS 'Typical spend per night out (GBP), admin-maintained.';
COMMENT ON COLUMN public.clients.preferred_nights IS 'e.g. Fri, Sat — free text.';
COMMENT ON COLUMN public.clients.preferred_promoter_id IS 'Promoter this client usually works with.';

-- —— 2) Guestlist visits per client (clubs / nights / promoter from event) ——
CREATE TABLE IF NOT EXISTS public.client_guestlist_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  club_slug text NOT NULL,
  event_date date NOT NULL,
  promoter_id uuid REFERENCES public.promoters (id) ON DELETE SET NULL,
  enquiry_id uuid REFERENCES public.enquiries (id) ON DELETE SET NULL,
  guest_profile_id uuid REFERENCES public.guest_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_guestlist_activity_uniq UNIQUE (client_id, club_slug, event_date)
);

CREATE INDEX IF NOT EXISTS client_guestlist_activity_client_idx
  ON public.client_guestlist_activity (client_id, event_date DESC);

ALTER TABLE public.client_guestlist_activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_guestlist_activity TO authenticated;

DROP POLICY IF EXISTS client_guestlist_activity_admin_all ON public.client_guestlist_activity;
CREATE POLICY client_guestlist_activity_admin_all
  ON public.client_guestlist_activity
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.client_guestlist_activity IS
  'One row per client × club × night; filled on guestlist signup sync and visible in admin CRM.';

-- —— 3) Admins: manage clients directly ——
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;

DROP POLICY IF EXISTS clients_select_admin ON public.clients;
CREATE POLICY clients_select_admin
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS clients_insert_admin ON public.clients;
CREATE POLICY clients_insert_admin
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS clients_update_admin ON public.clients;
CREATE POLICY clients_update_admin
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS clients_delete_admin ON public.clients;
CREATE POLICY clients_delete_admin
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid ()
        AND p.role = 'admin'
    )
  );

-- If clients already had conflicting policies, adjust in your project before applying.

-- —— 4) After website guestlist: upsert CRM clients + activity (anon-safe, enquiry-scoped) ——
CREATE OR REPLACE FUNCTION public.sync_crm_clients_from_guestlist_batch (
  p_enquiry_id uuid,
  p_club_slug text,
  p_event_date date,
  p_guests jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.sync_crm_clients_from_guestlist_batch (uuid, text, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_crm_clients_from_guestlist_batch (uuid, text, date, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.sync_crm_clients_from_guestlist_batch IS
  'Links guestlist party guests to public.clients + client_guestlist_activity after submit_website_enquiry; call from site with fresh enquiry id.';
