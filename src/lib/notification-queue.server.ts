import type { UnifiedNotification } from "@/types/notification";
import { getServerEnv } from "./env.server";

export type QueueResult =
  | { queued: true }
  | { queued: false; reason: "not_configured" | "failed"; error?: string };

/**
 * Edge-safe Inngest bridge.
 *
 * The project can later switch to the official `inngest` package once the
 * lockfile is regenerated. For Cloudflare Workers, this HTTP event bridge is
 * enough to hand off retries/delays to Inngest without Redis.
 */
export async function enqueueNotificationReceived(
  notification: UnifiedNotification,
): Promise<QueueResult> {
  const eventKey = getServerEnv("INNGEST_EVENT_KEY");
  const eventUrl = getServerEnv("INNGEST_EVENT_URL") ?? "https://inn.gs/e/";

  if (!eventKey) {
    return { queued: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(eventUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${eventKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "notification/received",
        data: notification,
        user: notification.subject ? { id: notification.subject } : undefined,
        ts: Date.parse(notification.createdAt),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        queued: false,
        reason: "failed",
        error: text || `Inngest returned ${response.status}`,
      };
    }

    return { queued: true };
  } catch (error) {
    return {
      queued: false,
      reason: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
