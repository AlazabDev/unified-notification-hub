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
  tenant_id?: string;
  recipient_user_id?: string | null;
  source: string;
  event_type?: string | null;
  dedupe_key?: string | null;
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
    tenantId: r.tenant_id,
    recipientUserId: r.recipient_user_id ?? undefined,
    source: r.source as UnifiedNotification["source"],
    eventType: r.event_type ?? undefined,
    dedupeKey: r.dedupe_key ?? undefined,
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
      "id, tenant_id, recipient_user_id, source, event_type, dedupe_key, category, severity, title, body, subject, avatar_url, actions, channels, raw, read, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as Row[]).map(rowToNotification);
}

export async function addNotification(n: UnifiedNotification): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({
    id: n.id,
    tenant_id: n.tenantId ?? "default",
    recipient_user_id: n.recipientUserId ?? null,
    source: n.source,
    event_type: n.eventType ?? null,
    dedupe_key: n.dedupeKey ?? null,
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

const DEFAULT_TENANT_ID = "default";
const DEFAULT_PREFERENCES_RECIPIENT_ID = "internal-dashboard";

export async function getPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("id, recipient_user_id, global, workflows, updated_at")
    .eq("tenant_id", DEFAULT_TENANT_ID)
    .or(`recipient_user_id.eq.${DEFAULT_PREFERENCES_RECIPIENT_ID},recipient_user_id.is.null`)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return DEFAULT_PREFS;
  return {
    global: row.global as unknown as NotificationPreferences["global"],
    workflows: (row.workflows as unknown as NotificationPreferences["workflows"]) ?? [],
  };
}

export async function savePreferences(
  p: NotificationPreferences,
): Promise<void> {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("notification_preferences")
    .select("id")
    .eq("tenant_id", DEFAULT_TENANT_ID)
    .or(`recipient_user_id.eq.${DEFAULT_PREFERENCES_RECIPIENT_ID},recipient_user_id.is.null`)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (findError) throw new Error(findError.message);

  const existingId = existing?.[0]?.id;
  const payload = {
    tenant_id: DEFAULT_TENANT_ID,
    recipient_user_id: DEFAULT_PREFERENCES_RECIPIENT_ID,
    global: p.global as never,
    workflows: p.workflows as never,
    updated_at: new Date().toISOString(),
  };

  const { error } = existingId
    ? await supabaseAdmin
        .from("notification_preferences")
        .update(payload)
        .eq("id", existingId)
    : await supabaseAdmin.from("notification_preferences").insert(payload);
  if (error) throw new Error(error.message);
}
