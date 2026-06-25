import type { UnifiedNotification } from "@/types/notification";
import { getServerEnv, isEnabledEnv } from "./env.server";

export type PersistenceResult =
  | { persisted: true }
  | { persisted: false; reason: "not_configured" | "failed"; error?: string };

function toSupabaseRow(notification: UnifiedNotification) {
  return {
    id: notification.id,
    source: notification.source,
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

/**
 * Edge-safe persistence using Supabase PostgREST directly.
 *
 * This intentionally avoids adding @supabase/supabase-js until the lockfile is
 * regenerated in the actual project environment. It works in Cloudflare Workers
 * because it only depends on the standard fetch API.
 */
export async function persistNotification(
  notification: UnifiedNotification,
): Promise<PersistenceResult> {
  const supabaseUrl = getServerEnv("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    if (isEnabledEnv("REQUIRE_SUPABASE")) {
      throw new Error(
        "Supabase persistence is required but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
      );
    }
    return { persisted: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(toSupabaseRow(notification)),
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
