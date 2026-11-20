-- Run manually in Supabase SQL Editor. Review before applying.
-- This does not create an admin password or expose service_role credentials.
CREATE OR REPLACE FUNCTION public.reag_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'reag_role') = 'admin', false);
$$;

REVOKE ALL ON FUNCTION public.reag_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reag_is_admin() TO authenticated;

DROP POLICY IF EXISTS "reag_admin_read_reports" ON public.reports;
CREATE POLICY "reag_admin_read_reports"
ON public.reports FOR SELECT TO authenticated
USING (public.reag_is_admin());

DROP POLICY IF EXISTS "reag_admin_delete_reports" ON public.reports;
CREATE POLICY "reag_admin_delete_reports"
ON public.reports FOR DELETE TO authenticated
USING (public.reag_is_admin());

DROP POLICY IF EXISTS "reag_admin_delete_posts" ON public.posts;
CREATE POLICY "reag_admin_delete_posts"
ON public.posts FOR DELETE TO authenticated
USING (public.reag_is_admin());

-- Assign the role only to the intended Auth UUID, never by trusting a browser-supplied email.
-- Replace the placeholder and run this separately as the project owner:
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"reag_role":"admin"}'::jsonb
-- WHERE id = 'YOUR_SUPABASE_AUTH_UUID'::uuid;
