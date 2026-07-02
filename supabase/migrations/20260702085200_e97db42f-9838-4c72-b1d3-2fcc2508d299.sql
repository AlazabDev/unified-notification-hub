
-- Simplify: internal notification hub, open read access for dashboard realtime.
-- Writes still go through server functions using service role.

DROP POLICY IF EXISTS "Admins can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can modify notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can read events log" ON public.notification_events_log;
DROP POLICY IF EXISTS "Admins can read delivery attempts" ON public.notification_delivery_attempts;
DROP POLICY IF EXISTS "Admins can read jobs" ON public.notification_jobs;
DROP POLICY IF EXISTS "Admins can read sources" ON public.notification_sources;
DROP POLICY IF EXISTS "Admins can read preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Admins can modify preferences" ON public.notification_preferences;

CREATE POLICY "public_read_notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "public_read_delivery_attempts" ON public.notification_delivery_attempts FOR SELECT USING (true);
CREATE POLICY "public_read_jobs" ON public.notification_jobs FOR SELECT USING (true);

GRANT SELECT ON public.notifications TO anon, authenticated;
GRANT SELECT ON public.notification_delivery_attempts TO anon, authenticated;
GRANT SELECT ON public.notification_jobs TO anon, authenticated;
