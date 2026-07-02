
-- has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Drop old tenant-JWT policies
DROP POLICY IF EXISTS "authenticated can read tenant notifications" ON public.notifications;
DROP POLICY IF EXISTS "authenticated can update readable notifications" ON public.notifications;
DROP POLICY IF EXISTS "authenticated can read tenant preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "authenticated can write own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "authenticated can read tenant sources" ON public.notification_sources;
DROP POLICY IF EXISTS "authenticated can read tenant logs" ON public.notification_events_log;
DROP POLICY IF EXISTS "authenticated can read tenant jobs" ON public.notification_jobs;
DROP POLICY IF EXISTS "authenticated can read tenant delivery attempts" ON public.notification_delivery_attempts;

-- Admin-only read/update via role check (no reliance on client JWT claims)
CREATE POLICY "admins read notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read preferences" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write preferences" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notification_sources: admin-only read (bearer_token_hash / hmac_secret_env_name are sensitive)
CREATE POLICY "admins read sources" ON public.notification_sources
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- notification_events_log: admin-only read (raw_payload, ip_hash sensitive)
CREATE POLICY "admins read events log" ON public.notification_events_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read jobs" ON public.notification_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read delivery attempts" ON public.notification_delivery_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
