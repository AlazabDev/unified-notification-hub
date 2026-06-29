GRANT ALL ON public.notification_api_keys TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_jobs'
      AND policyname = 'authenticated can read tenant jobs'
  ) THEN
    CREATE POLICY "authenticated can read tenant jobs"
    ON public.notification_jobs
    FOR SELECT
    TO authenticated
    USING (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id'), 'default'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_delivery_attempts'
      AND policyname = 'authenticated can read tenant delivery attempts'
  ) THEN
    CREATE POLICY "authenticated can read tenant delivery attempts"
    ON public.notification_delivery_attempts
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.id = notification_delivery_attempts.notification_id
          AND n.tenant_id = COALESCE((auth.jwt() ->> 'tenant_id'), 'default')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_api_keys'
      AND policyname = 'api keys are server managed only'
  ) THEN
    CREATE POLICY "api keys are server managed only"
    ON public.notification_api_keys
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'users can read own roles'
  ) THEN
    CREATE POLICY "users can read own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;