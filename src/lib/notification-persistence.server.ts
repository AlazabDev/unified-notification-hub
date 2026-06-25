import type {
  NotificationPreferences,
  UnifiedNotification,
} from "@/types/notification";

const DEFAULT_TENANT_ID = "default";
const DEFAULT_RECIPIENT_ID = "dashboard";

export type PersistenceResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "failed"; error?: string };

type SupabaseConfig = {
  url: string;
  key: string;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function env(name: string): string | undefined {
  return (globalThis as unknown as { process?: ProcessLike }).process?.env?.[name];
}

function config(): SupabaseConfig | undefined {
  const url = env("SUPABASE_URL")?.replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return undefined;
  return { url, key };
}

function headers(key: string, prefer = "return=minimal") {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer,
  };
}

function toNotificationRow(notification: UnifiedNotification) {
  return {
    id: notification.id,
    tenant_id: notification.tenantId ?? DEFAULT_TENANT_ID,
    source_id: notification.sourceId ?? null,
    recipient_user_id: notification.recipientUserId ?? null,
    source: notification.source,
    event_type: notification.eventType ?? null,
    dedupe_key: notification.dedupeKey ?? null,
    category: notification.category,
    severity: notification.severity,
    title: notification.title,
    body: notification.body,
    subject: notification.subject ?? null,
    avatar_url: notification.avatarUrl ?? null,
    actions: notification.actions ?? null,
    channels: notification.channels ?? ["inapp"],
    raw: notification.raw ?? null,
    read: notification.read,
    created_at: notification.createdAt,
  };
}

type NotificationRow = {
  id: string;
  tenant_id?: string | null;
  source_id?: string | null;
  recipient_user_id?: string | null;
  source: UnifiedNotification["source"];
  event_type?: string | null;
  dedupe_key?: string | null;
  category: UnifiedNotification["category"];
  severity: UnifiedNotification["severity"];
  title: string;
  body: string;
  subject?: string | null;
  avatar_url?: string | null;
  actions?: UnifiedNotification["actions"] | null;
  channels?: UnifiedNotification["channels"] | null;
  raw?: UnifiedNotification["raw"] | null;
  read: boolean;
  created_at: string;
};

function fromNotificationRow(row: NotificationRow): UnifiedNotification {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? undefined,
    sourceId: row.source_id ?? undefined,
    recipientUserId: row.recipient_user_id ?? undefined,
    source: row.source,
    eventType: row.event_type ?? undefined,
    dedupeKey: row.dedupe_key ?? undefined,
    category: row.category,
    severity: row.severity,
    title: row.title,
    body: row.body,
    subject: row.subject ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    actions: row.actions ?? undefined,
    channels: row.channels ?? undefined,
    raw: row.raw ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  };
}

async function selectRows<T>(table: string, query: string): Promise<T[] | undefined> {
  const c = config();
  if (!c) return undefined;

  const response = await fetch(`${c.url}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: headers(c.key),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T[]>;
}

async function insertRow(table: string, row: unknown): Promise<PersistenceResult> {
  const c = config();
  if (!c) return { ok: false, reason: "not_configured" };

  const response = await fetch(`${c.url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(c.key),
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    return { ok: false, reason: "failed", error: await response.text() };
  }

  return { ok: true };
}

async function patchRows(
  table: string,
  query: string,
  row: unknown,
): Promise<PersistenceResult> {
  const c = config();
  if (!c) return { ok: false, reason: "not_configured" };

  const response = await fetch(`${c.url}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: headers(c.key),
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    return { ok: false, reason: "failed", error: await response.text() };
  }

  return { ok: true };
}

async function deleteRows(table: string, query: string): Promise<PersistenceResult> {
  const c = config();
  if (!c) return { ok: false, reason: "not_configured" };

  const response = await fetch(`${c.url}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: headers(c.key),
  });

  if (!response.ok) {
    return { ok: false, reason: "failed", error: await response.text() };
  }

  return { ok: true };
}

export async function listPersistedNotifications(): Promise<UnifiedNotification[]> {
  const rows = await selectRows<NotificationRow>(
    "notifications",
    "select=*&order=created_at.desc&limit=500",
  );
  return rows?.map(fromNotificationRow) ?? [];
}

export async function persistNotification(
  notification: UnifiedNotification,
): Promise<PersistenceResult> {
  return insertRow("notifications", toNotificationRow(notification));
}

export async function persistReadState(
  id: string,
  read: boolean,
): Promise<PersistenceResult> {
  return patchRows(
    "notifications",
    `id=eq.${encodeURIComponent(id)}`,
    { read, read_at: read ? new Date().toISOString() : null },
  );
}

export async function persistAllRead(): Promise<PersistenceResult> {
  return patchRows(
    "notifications",
    "read=eq.false",
    { read: true, read_at: new Date().toISOString() },
  );
}

export async function deleteNotification(id: string): Promise<PersistenceResult> {
  return deleteRows("notifications", `id=eq.${encodeURIComponent(id)}`);
}

export async function getPersistedPreferences(): Promise<NotificationPreferences> {
  const rows = await selectRows<{
    global: NotificationPreferences["global"];
    workflows: NotificationPreferences["workflows"];
  }>(
    "notification_preferences",
    `select=global,workflows&tenant_id=eq.${DEFAULT_TENANT_ID}&recipient_user_id=eq.${DEFAULT_RECIPIENT_ID}&limit=1`,
  );

  return rows?.[0] ?? defaultPreferences();
}

export async function persistPreferences(
  preferences: NotificationPreferences,
): Promise<PersistenceResult> {
  return insertRow("notification_preferences", {
    tenant_id: DEFAULT_TENANT_ID,
    recipient_user_id: DEFAULT_RECIPIENT_ID,
    global: preferences.global,
    workflows: preferences.workflows,
  });
}

export function defaultPreferences(): NotificationPreferences {
  return {
    global: { inapp: true, email: true, push: true, chat: false, sms: false },
    workflows: [
      {
        workflowId: "onboarding",
        name: "Onboarding workflow",
        channels: { inapp: true, email: true, push: true, chat: true, sms: true },
      },
      {
        workflowId: "comment-mentions",
        name: "Comment Mentions",
        channels: { inapp: true, email: false, push: false, chat: false, sms: true },
      },
      {
        workflowId: "invite-friend",
        name: "Invite friend",
        channels: { inapp: true, email: true, push: false, chat: true, sms: false },
      },
    ],
  };
}
