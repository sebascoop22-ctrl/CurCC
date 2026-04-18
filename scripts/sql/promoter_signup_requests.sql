-- Promoter access requests (public form → admin review → auth user + emails via Edge Functions).
-- Safe to re-run: policies are dropped before recreate (Postgres has no CREATE POLICY IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.promoter_signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id),
  denial_reason text,
  auth_user_id uuid REFERENCES auth.users (id)
);

CREATE INDEX IF NOT EXISTS promoter_signup_requests_status_created_idx
  ON public.promoter_signup_requests (status, created_at DESC);

ALTER TABLE public.promoter_signup_requests ENABLE ROW LEVEL SECURITY;

-- Allow API roles to insert. (If these are missing, inserts fail with permission errors.)
GRANT INSERT ON TABLE public.promoter_signup_requests TO anon, authenticated;
GRANT SELECT ON TABLE public.promoter_signup_requests TO authenticated;

-- Public portal: insert pending requests only (Edge Function may also insert with service role).
-- Note: Do not rely on INSERT ... RETURNING for anon: there is no SELECT policy for anon
-- (only admins can read rows). The app supplies `id` client-side and omits `.select()`.
DROP POLICY IF EXISTS promoter_signup_requests_insert_public ON public.promoter_signup_requests;
CREATE POLICY promoter_signup_requests_insert_public
  ON public.promoter_signup_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND length(trim(full_name)) >= 1
    AND length(trim(email)) >= 3
  );

-- Admins: read all requests (Edge Functions use service role and bypass RLS).
DROP POLICY IF EXISTS promoter_signup_requests_select_admin ON public.promoter_signup_requests;
CREATE POLICY promoter_signup_requests_select_admin
  ON public.promoter_signup_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- No UPDATE/DELETE for authenticated users — approvals are handled by Edge Function (service role).

COMMENT ON TABLE public.promoter_signup_requests IS
  'Promoter access requests; notify + admin actions via Supabase Edge Functions (see edge/README.md).';
