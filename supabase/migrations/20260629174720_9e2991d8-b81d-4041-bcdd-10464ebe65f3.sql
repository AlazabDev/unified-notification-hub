GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.notification_sources TO authenticated;
GRANT SELECT ON public.notification_events_log TO authenticated;
GRANT SELECT ON public.notification_jobs TO authenticated;
GRANT SELECT ON public.notification_delivery_attempts TO authenticated;

GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT ALL ON public.notification_sources TO service_role;
GRANT ALL ON public.notification_events_log TO service_role;
GRANT ALL ON public.notification_jobs TO service_role;
GRANT ALL ON public.notification_delivery_attempts TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;