import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ingestSchema, normalize } from "./notification-schema";
import { requireAdmin } from "./require-admin.server";
import type {
  NotificationPreferences,
  UnifiedNotification,
} from "@/types/notification";

export type NotificationSourceRow = {
  id: string;
  name: string;
  domain: string;
  source_key: string;
  source_type: string;
  active: boolean;
  rate_limit_per_minute: number;
  last_seen_at: string | null;
  updated_at: string;
};

const channelSchema = z.object({
  inapp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
  chat: z.boolean(),
  sms: z.boolean(),
});

const preferencesSchema = z.object({
  global: channelSchema,
  workflows: z.array(
    z.object({
      workflowId: z.string(),
      name: z.string(),
      channels: channelSchema,
    }),
  ),
});

const sourceTypeSchema = z.enum(["meta", "uberfix", "accounting", "system", "custom"]);

const createSourceTokenSchema = z.object({
  name: z.string().min(2).default("Internal Company Systems"),
  domain: z.string().min(2).default("notify.alazab.com"),
  sourceKey: z
    .string()
    .min(2)
    .regex(/^[a-z0-9_-]+$/i)
    .default("company_internal"),
  sourceType: sourceTypeSchema.default("custom"),
  rateLimitPerMinute: z.number().int().min(1).max(5000).default(120),
});

// All dashboard server functions require a signed-in Supabase user who has
// the `admin` role in `public.user_roles`. RLS on the underlying tables is
// admin-gated as well, so cross-user access is blocked at two layers.

export const listNotificationsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<UnifiedNotification[]> => {
    const { listNotifications } = await import("./notification-store.server");
    return listNotifications();
  });

export const ingestNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => ingestSchema.parse(d))
  .handler(async ({ data }): Promise<UnifiedNotification> => {
    const { addNotification } = await import("./notification-store.server");
    const n = normalize(data);
    await addNotification(n);
    return n;
  });

export const markReadFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), read: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { markRead } = await import("./notification-store.server");
    await markRead(data.id, data.read);
    return { ok: true };
  });

export const markAllReadFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { markAllRead } = await import("./notification-store.server");
    await markAllRead();
    return { ok: true };
  });

export const removeNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { removeNotification } = await import("./notification-store.server");
    await removeNotification(data.id);
    return { ok: true };
  });

export const getPreferencesFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<NotificationPreferences> => {
    const { getPreferences } = await import("./notification-store.server");
    return getPreferences();
  });

export const savePreferencesFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => preferencesSchema.parse(d))
  .handler(async ({ data }) => {
    const { savePreferences } = await import("./notification-store.server");
    await savePreferences(data);
    return { ok: true };
  });

export const listNotificationSourcesFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<NotificationSourceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notification_sources")
      .select("id, name, domain, source_key, source_type, active, rate_limit_per_minute, last_seen_at, updated_at")
      .eq("tenant_id", "default")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("list_notification_sources_failed", error);
      throw new Error("Failed to load notification sources");
    }
    return (data ?? []) as NotificationSourceRow[];
  });

export const createSourceTokenFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => createSourceTokenSchema.parse(d))
  .handler(async ({ data }) => {
    const [{ supabaseAdmin }, { sha256Hex }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("./edge-crypto.server"),
    ]);

    const token = `az_${data.sourceKey}_${crypto.randomUUID().replaceAll("-", "")}_${crypto.randomUUID().replaceAll("-", "")}`;
    const bearerTokenHash = await sha256Hex(token);

    const payload = {
      tenant_id: "default",
      name: data.name,
      domain: data.domain,
      source_key: data.sourceKey,
      source_type: data.sourceType,
      bearer_token_hash: bearerTokenHash,
      active: true,
      hmac_enabled: false,
      rate_limit_per_minute: data.rateLimitPerMinute,
      updated_at: new Date().toISOString(),
    };

    const { data: source, error } = await supabaseAdmin
      .from("notification_sources")
      .upsert(payload, { onConflict: "tenant_id,source_key" })
      .select("id, name, domain, source_key, source_type, active, rate_limit_per_minute, last_seen_at, updated_at")
      .single();

    if (error) {
      console.error("create_source_token_failed", error);
      throw new Error("Failed to create notification source token");
    }

    return {
      ok: true,
      token,
      source: source as NotificationSourceRow,
    };
  });
