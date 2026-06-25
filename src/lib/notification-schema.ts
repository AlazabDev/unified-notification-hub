import { z } from "zod";
import type {
  JsonValue,
  NotificationSource,
  UnifiedNotification,
  NotificationCategory,
  NotificationSeverity,
} from "@/types/notification";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/**
 * Generic ingestion envelope. Any source can post this shape and we
 * normalize it. Source-specific adapters live below.
 */
export const ingestSchema = z.object({
  tenantId: z.string().trim().min(1).max(120).optional(),
  recipientUserId: z.string().trim().min(1).max(160).optional(),
  source: z.enum(["meta", "uberfix", "accounting", "system", "custom"]),
  /** Optional event type the source assigns (used by adapter to classify). */
  eventType: z.string().trim().min(1).max(120).optional(),
  /** Optional idempotency key supplied by webhook callers to prevent duplicates. */
  dedupeKey: z.string().trim().min(1).max(180).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(2000).optional(),
  severity: z.enum(["info", "success", "warning", "critical"]).optional(),
  category: z.enum(["all", "projects", "announcements", "alerts"]).optional(),
  subject: z.string().trim().max(200).optional(),
  avatarUrl: z.string().url().max(2048).optional(),
  actions: z
    .array(
      z.object({
        id: z.string().max(60),
        label: z.string().min(1).max(60),
        variant: z.enum(["primary", "secondary", "destructive"]).optional(),
        href: z.string().url().optional(),
        actionKey: z.string().max(120).optional(),
      }),
    )
    .max(4)
    .optional(),
  /** Free-form original payload from the source system */
  payload: z.record(z.string(), jsonValueSchema).optional(),
});

export type IngestPayload = z.infer<typeof ingestSchema>;

/* -------------------------------------------------------------------------- */
/*  Normalizer                                                                 */
/* -------------------------------------------------------------------------- */

const sourceDefaults: Record<
  NotificationSource,
  { category: NotificationCategory; severity: NotificationSeverity; label: string }
> = {
  meta: { category: "announcements", severity: "info", label: "Meta" },
  uberfix: { category: "projects", severity: "info", label: "UberFix" },
  accounting: { category: "alerts", severity: "warning", label: "Accounting" },
  system: { category: "announcements", severity: "info", label: "System" },
  custom: { category: "all", severity: "info", label: "Custom" },
};

/**
 * Convert an arbitrary source payload into the UnifiedNotification model.
 * This is the single source of truth — UI, queue, and channel gateways all
 * consume this shape.
 */
export function normalize(input: IngestPayload): UnifiedNotification {
  const d = sourceDefaults[input.source];
  const id =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const title =
    input.title ?? autoTitle(input) ?? `${d.label} notification`;
  const body = input.body ?? autoBody(input) ?? "";

  return {
    id,
    tenantId: input.tenantId,
    recipientUserId: input.recipientUserId,
    source: input.source,
    eventType: input.eventType,
    dedupeKey: input.dedupeKey,
    category: input.category ?? d.category,
    severity: input.severity ?? d.severity,
    title,
    body,
    subject: input.subject,
    avatarUrl: input.avatarUrl,
    actions: input.actions,
    createdAt: new Date().toISOString(),
    read: false,
    raw: input.payload,
    channels: ["inapp"],
  };
}

function autoTitle(input: IngestPayload): string | undefined {
  if (input.eventType) return prettyEvent(input.eventType);
  return undefined;
}

function autoBody(input: IngestPayload): string | undefined {
  if (!input.payload) return undefined;
  try {
    const json = JSON.stringify(input.payload);
    return json.length > 240 ? json.slice(0, 237) + "…" : json;
  } catch {
    return undefined;
  }
}

function prettyEvent(t: string) {
  return t
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
