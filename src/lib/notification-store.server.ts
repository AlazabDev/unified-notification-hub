/**
 * SERVER-ONLY notification store backed by Supabase.
 * Uses the service-role admin client (RLS bypassed) because all access is
 * brokered through TanStack server functions.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  NotificationAction,
  NotificationPreferences,
  UnifiedNotification,
} from "@/types/notification";

type Row = {
  id: string;
  source: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  subject: string | null;
  avatar_url: string | null;
  actions: unknown;
  channels: string[];
  raw: unknown;
  read: boolean;
  created_at: string;
};

function rowToNotification(r: Row): UnifiedNotification {
  return {
    id: r.id,
    source: r.source as UnifiedNotification["source"],
    category: r.category as UnifiedNotification["category"],
    severity: r.severity as UnifiedNotification["severity"],
    title: r.title,
    body: r.body,
    subject: r.subject ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    actions: (r.actions as NotificationAction[] | null) ?? undefined,
    channels: (r.channels as UnifiedNotification["channels"]) ?? ["inapp"],
    raw: (r.raw as UnifiedNotification["raw"]) ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  };
}

export async function listNotifications(): Promise<UnifiedNotification[]> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select(
      "id, source, category, severity, title, body, subject, avatar_url, actions, channels, raw, read, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as Row[]).map(rowToNotification);
}

export async function addNotification(n: UnifiedNotification): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({
    id: n.id,
    source: n.source,
    category: n.category,
    severity: n.severity,
    title: n.title,
    body: n.body,
    subject: n.subject ?? null,
    avatar_url: n.avatarUrl ?? null,
    actions: (n.actions ?? null) as never,
    channels: n.channels ?? ["inapp"],
    raw: (n.raw ?? null) as never,
    read: n.read ?? false,
    created_at: n.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function markRead(id: string, read: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read, read_at: read ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("read", false);
  if (error) throw new Error(error.message);
}

export async function removeNotification(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

const DEFAULT_PREFS: NotificationPreferences = {
  global: { inapp: true, email: true, push: true, chat: false, sms: false },
  workflows: [],
};

export async function getPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("global, workflows")
    .eq("id", "global")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PREFS;
  return {
    global: data.global as NotificationPreferences["global"],
    workflows: (data.workflows as NotificationPreferences["workflows"]) ?? [],
  };
}

export async function savePreferences(
  p: NotificationPreferences,
): Promise<void> {
  const { error } = await supabaseAdmin.from("notification_preferences").upsert(
    {
      id: "global",
      global: p.global as never,
      workflows: p.workflows as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}
