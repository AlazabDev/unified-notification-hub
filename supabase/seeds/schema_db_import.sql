-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'info'::text,
  title text NOT NULL,
  body text NOT NULL,
  subject text,
  avatar_url text,
  actions jsonb,
  channels ARRAY NOT NULL DEFAULT ARRAY['inapp'::text],
  raw jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notification_preferences (
  id text NOT NULL DEFAULT 'global'::text,
  global jsonb NOT NULL,
  workflows jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id)
);
CREATE TABLE public.supcloud_keepalive (
  id smallint NOT NULL CHECK (id = 1),
  marker text NOT NULL DEFAULT 'supcloud'::text,
  CONSTRAINT supcloud_keepalive_pkey PRIMARY KEY (id)
);
