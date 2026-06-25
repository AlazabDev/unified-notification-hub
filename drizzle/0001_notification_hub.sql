-- Az Notification Hub — Supabase/Postgres schema
-- Apply in Supabase SQL editor or through your migration runner.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  recipient_user_id text,
  source text not null check (source in ('meta', 'uberfix', 'accounting', 'system', 'custom')),
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

create index if not exists notifications_tenant_created_idx
  on public.notifications (tenant_id, created_at desc);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

create index if not exists notifications_unread_idx
  on public.notifications (tenant_id, read, created_at desc);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_delivery_attempts enable row level security;
alter table public.notification_api_keys enable row level security;

-- Realtime publication. Supabase dashboard may already own this publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when duplicate_object then null;
end $$;

-- Service role bypasses RLS. Client-facing SELECT policies should be added when
-- the app auth model is finalized. Do not add broad anon SELECT policies here.
