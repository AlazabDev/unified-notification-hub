-- Az Notification Hub — Supabase/Postgres schema
-- Apply in Supabase SQL editor or through your migration runner.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles / tenancy
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.app_role as enum ('admin', 'operator', 'viewer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  user_id uuid not null,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, role)
);

-- ---------------------------------------------------------------------------
-- Connected systems / source registry
-- ---------------------------------------------------------------------------

create table if not exists public.notification_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  name text not null,
  domain text not null,
  source_key text not null,
  source_type text not null default 'custom' check (source_type in ('meta', 'uberfix', 'accounting', 'system', 'custom')),
  bearer_token_hash text,
  hmac_enabled boolean not null default false,
  hmac_secret_env_name text,
  rate_limit_per_minute integer not null default 120 check (rate_limit_per_minute > 0),
  active boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_key),
  unique (tenant_id, domain)
);

create index if not exists notification_sources_token_hash_idx
  on public.notification_sources (bearer_token_hash)
  where bearer_token_hash is not null and active = true;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  recipient_user_id text,
  source text not null check (source in ('meta', 'uberfix', 'accounting', 'system', 'custom')),
  source_id uuid references public.notification_sources(id) on delete set null,
  event_type text,
  dedupe_key text,
  category text not null check (category in ('all', 'projects', 'announcements', 'alerts')),
  severity text not null check (severity in ('info', 'success', 'warning', 'critical')),
  title text not null,
  body text not null,
  subject text,
  avatar_url text,
  actions jsonb,
  channels text[] not null default array['inapp']::text[],
  raw jsonb,
  read boolean not null default false,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_unique_dedupe unique (tenant_id, source, dedupe_key)
);

alter table public.notifications replica identity full;

create index if not exists notifications_tenant_created_idx
  on public.notifications (tenant_id, created_at desc);

create index if not exists notifications_source_created_idx
  on public.notifications (source_id, created_at desc)
  where source_id is not null;

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

create index if not exists notifications_unread_idx
  on public.notifications (tenant_id, read, created_at desc);

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  recipient_user_id text not null,
  global jsonb not null default '{"inapp":true,"email":true,"push":true,"chat":false,"sms":false}'::jsonb,
  workflows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, recipient_user_id)
);

-- ---------------------------------------------------------------------------
-- Audit log: every incoming event should leave a trace, even on failure.
-- ---------------------------------------------------------------------------

create table if not exists public.notification_events_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  source_id uuid references public.notification_sources(id) on delete set null,
  request_id text,
  dedupe_key text,
  event_type text,
  status text not null check (status in ('accepted', 'rejected', 'duplicate', 'failed')),
  status_code integer not null,
  error_code text,
  error_message text,
  ip_hash text,
  user_agent text,
  raw_payload jsonb,
  normalized_notification_id uuid references public.notifications(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notification_events_log_source_created_idx
  on public.notification_events_log (source_id, created_at desc)
  where source_id is not null;

create index if not exists notification_events_log_status_created_idx
  on public.notification_events_log (tenant_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Delivery / retry tracking
-- ---------------------------------------------------------------------------

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('inapp', 'email', 'push', 'chat', 'sms')),
  provider text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  last_error text,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_delivery_attempts_notification_idx
  on public.notification_delivery_attempts (notification_id, created_at desc);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  tenant_id text not null default 'default',
  job_type text not null check (job_type in ('deliver', 'retry', 'digest', 'cleanup')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  payload jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (status, run_at asc);

-- Legacy generic keys table kept for UI/API-key management compatibility.
create table if not exists public.notification_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  name text not null,
  key_hash text not null unique,
  scopes text[] not null default array['notifications:ingest']::text[],
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Utility triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_sources_set_updated_at on public.notification_sources;
create trigger notification_sources_set_updated_at
before update on public.notification_sources
for each row execute function public.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists notification_jobs_set_updated_at on public.notification_jobs;
create trigger notification_jobs_set_updated_at
before update on public.notification_jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table public.user_roles enable row level security;
alter table public.notification_sources enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_events_log enable row level security;
alter table public.notification_delivery_attempts enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_api_keys enable row level security;

grant usage on schema public to authenticated, service_role;

grant select on public.notifications to authenticated;
grant update (read, status, read_at, updated_at) on public.notifications to authenticated;
grant select on public.notification_preferences to authenticated;
grant insert, update on public.notification_preferences to authenticated;
grant select on public.notification_sources to authenticated;
grant select on public.notification_events_log to authenticated;
grant select on public.notification_delivery_attempts to authenticated;
grant select on public.notification_jobs to authenticated;
grant select on public.user_roles to authenticated;

grant all on public.user_roles to service_role;
grant all on public.notification_sources to service_role;
grant all on public.notifications to service_role;
grant all on public.notification_preferences to service_role;
grant all on public.notification_events_log to service_role;
grant all on public.notification_delivery_attempts to service_role;
grant all on public.notification_jobs to service_role;
grant all on public.notification_api_keys to service_role;

-- Dashboard policies are intentionally tenant/user scoped and conservative.
-- They assume JWT contains tenant_id. Admin/operator expansion comes in auth phase.

drop policy if exists "authenticated can read tenant notifications" on public.notifications;
create policy "authenticated can read tenant notifications"
  on public.notifications for select
  to authenticated
  using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'));

drop policy if exists "authenticated can update readable notifications" on public.notifications;
create policy "authenticated can update readable notifications"
  on public.notifications for update
  to authenticated
  using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'))
  with check (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'));

drop policy if exists "authenticated can read tenant preferences" on public.notification_preferences;
create policy "authenticated can read tenant preferences"
  on public.notification_preferences for select
  to authenticated
  using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'));

drop policy if exists "authenticated can write own preferences" on public.notification_preferences;
create policy "authenticated can write own preferences"
  on public.notification_preferences for all
  to authenticated
  using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'))
  with check (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'));

drop policy if exists "authenticated can read tenant sources" on public.notification_sources;
create policy "authenticated can read tenant sources"
  on public.notification_sources for select
  to authenticated
  using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'));

drop policy if exists "authenticated can read tenant logs" on public.notification_events_log;
create policy "authenticated can read tenant logs"
  on public.notification_events_log for select
  to authenticated
  using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', 'default'));

-- Realtime publication. Supabase dashboard may already own this publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Initial connected systems. Tokens are intentionally empty/inactive until the
-- administrator generates hashes and activates each source.
-- ---------------------------------------------------------------------------

insert into public.notification_sources (tenant_id, name, domain, source_key, source_type, active, rate_limit_per_minute)
values
  ('default', 'Alazab Main Website', 'alazab.com', 'alazab_main', 'system', false, 120),
  ('default', 'UberFix', 'uberfix.alazab.com', 'uberfix', 'uberfix', false, 240),
  ('default', 'ERPNext', 'erp.alazab.com', 'erp', 'accounting', false, 180),
  ('default', 'AI Gateway', 'ai.alazab.com', 'ai', 'custom', false, 120),
  ('default', 'Photos Gallery', 'photos.alazab.com', 'photos', 'custom', false, 60),
  ('default', 'Agent Gateway', 'agent.alazab.com', 'agent', 'custom', false, 180),
  ('default', 'Proud CTE', 'proudcte.alazab.com', 'proudcte', 'custom', false, 120)
on conflict (tenant_id, source_key) do update set
  name = excluded.name,
  domain = excluded.domain,
  source_type = excluded.source_type,
  rate_limit_per_minute = excluded.rate_limit_per_minute,
  updated_at = now();
