import type { JsonValue, UnifiedNotification } from "@/types/notification";
import { getServerEnv, isEnabledEnv } from "./env.server";

export type PersistenceResult =
  | { persisted: true }
  | { persisted: false; reason: "not_configured" | "failed"; error?: string };

export type EventLogInput = {
  tenantId?: string;
  sourceId?: string;
  requestId?: string;
  dedupeKey?: string;
  eventType?: string;
  status: "accepted" | "rejected" | "duplicate" | "failed";
  statusCode: number;
  errorCode?: string;
  errorMessage?: string;
  ipHash?: string;
  userAgent?: string;
  rawPayload?: JsonValue;
  notificationId?: string;
};

function getSupabaseConfig() {
  const supabaseUrl = getServerEnv("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = getServerEnv("AZ_SUPABASE_SERVICE_ROLE_KEY") ?? getServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    if (isEnabledEnv("REQUIRE_SUPABASE")) {
      throw new Error(
        "Supabase persistence is required but SUPABASE_URL or AZ_SUPABASE_SERVICE_ROLE_KEY is missing.",
      );
    }
    return undefined;
  }

  return { supabaseUrl, serviceKey };
}

function headers(serviceKey: string, prefer = "return=minimal") {
  const result: Record<string, string> = {
    apikey: serviceKey,
    "content-type": "application/json",
    prefer,
  };
  if (!serviceKey.startsWith("sb_secret_") && !serviceKey.startsWith("sb_publishable_")) {
    result.authorization = `Bearer ${serviceKey}`;
  }
  return result;
}

function toSupabaseRow(notification: UnifiedNotification) {
  const withSource = notification as UnifiedNotification & { sourceId?: string };
  return {
    id: notification.id,
    tenant_id: notification.tenantId ?? "default",
    source_id: withSource.sourceId ?? null,
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

async function insertRow(table: string, row: unknown): Promise<PersistenceResult> {
  const config = getSupabaseConfig();
  if (!config) return { persisted: false, reason: "not_configured" };

  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: headers(config.serviceKey),
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        persisted: false,
        reason: "failed",
        error: text || `Supabase returned ${response.status}`,
      };
    }

    return { persisted: true };
  } catch (error) {
    return {
      persisted: false,
      reason: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Edge-safe persistence using Supabase PostgREST directly.
 * It works in Cloudflare Workers because it only depends on standard fetch.
 */
export async function persistNotification(
  notification: UnifiedNotification,
): Promise<PersistenceResult> {
  return insertRow("notifications", toSupabaseRow(notification));
}

export async function logNotificationEvent(input: EventLogInput): Promise<PersistenceResult> {
  return insertRow("notification_events_log", {
    tenant_id: input.tenantId ?? "default",
    source_id: input.sourceId ?? null,
    request_id: input.requestId ?? null,
    dedupe_key: input.dedupeKey ?? null,
    event_type: input.eventType ?? null,
    status: input.status,
    status_code: input.statusCode,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    ip_hash: input.ipHash ?? null,
    user_agent: input.userAgent ?? null,
    raw_payload: input.rawPayload ?? null,
    normalized_notification_id: input.notificationId ?? null,
  });
}

export async function createDeliveryJob(
  notification: UnifiedNotification,
): Promise<PersistenceResult> {
  return insertRow("notification_jobs", {
    notification_id: notification.id,
    tenant_id: notification.tenantId ?? "default",
    job_type: "deliver",
    status: "pending",
    run_at: new Date().toISOString(),
    attempts: 0,
    max_attempts: 5,
    payload: {
      notificationId: notification.id,
      channels: notification.channels ?? ["inapp"],
      source: notification.source,
      eventType: notification.eventType ?? null,
    },
  });
}
