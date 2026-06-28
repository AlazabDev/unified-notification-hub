-- Az Notification Hub — production security hotfix
-- Mirrors the emergency Supabase production migration applied on AzNotification.

begin;

-- Remove public read policies that expose notification data and preferences.
drop policy if exists "Internal read" on public.notifications;
drop policy if exists "Internal prefs read" on public.notification_preferences;

-- Keep API access closed for anonymous users on sensitive notification tables.
revoke all privileges on table
  public.notifications,
  public.notification_preferences,
  public.notification_sources,
  public.notification_api_keys,
  public.notification_events_log,
  public.notification_delivery_attempts,
  public.notification_jobs,
  public.user_roles
from anon;

-- Administrative/internal tables are service-role only until explicit admin UI policies exist.
revoke all privileges on table
  public.notification_sources,
  public.notification_api_keys,
  public.notification_events_log,
  public.notification_delivery_attempts,
  public.notification_jobs,
  public.user_roles
from authenticated;

-- Temporarily remove notifications from realtime publication until auth-scoped subscriptions are implemented.
do $$
begin
  if exists (
    select 1
    from pg_publication p
    join pg_publication_rel pr on pr.prpubid = p.oid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'notifications'
  ) then
    alter publication supabase_realtime drop table public.notifications;
  end if;
exception
  when undefined_object then null;
end $$;

-- Fix mutable search_path advisory for trigger helper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

commit;
