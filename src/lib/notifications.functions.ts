import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ingestSchema, normalize } from "./notification-schema";
import type {
  NotificationPreferences,
  UnifiedNotification,
} from "@/types/notification";

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

const SAFE_DEFAULT_PREFS: NotificationPreferences = {
  global: { inapp: true, email: true, push: false, chat: false, sms: false },
  workflows: [],
};

/**
 * Emergency production guard.
 *
 * TanStack Server Functions are callable RPC endpoints. Until dashboard auth is
 * wired to Supabase sessions, these functions must not broker service-role
 * access for anonymous users. Keep them locked by default and only unlock in a
 * trusted local/staging environment with ALLOW_UNAUTHENTICATED_DASHBOARD=true.
 */
function allowUnauthenticatedDashboard(): boolean {
  return process.env.ALLOW_UNAUTHENTICATED_DASHBOARD === "true";
}

function requireDashboardAccess(): void {
  if (!allowUnauthenticatedDashboard()) {
    throw new Error(
      "Notification dashboard server functions are locked until Supabase auth is configured.",
    );
  }
}

export const listNotificationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<UnifiedNotification[]> => {
    if (!allowUnauthenticatedDashboard()) return [];

    const { listNotifications } = await import("./notification-store.server");
    return listNotifications();
  },
);

export const ingestNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ingestSchema.parse(d))
  .handler(async ({ data }): Promise<UnifiedNotification> => {
    requireDashboardAccess();

    const { addNotification } = await import("./notification-store.server");
    const n = normalize(data);
    await addNotification(n);
    return n;
  });

export const markReadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), read: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data }) => {
    requireDashboardAccess();

    const { markRead } = await import("./notification-store.server");
    await markRead(data.id, data.read);
    return { ok: true };
  });

export const markAllReadFn = createServerFn({ method: "POST" }).handler(
  async () => {
    requireDashboardAccess();

    const { markAllRead } = await import("./notification-store.server");
    await markAllRead();
    return { ok: true };
  },
);

export const removeNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    requireDashboardAccess();

    const { removeNotification } = await import("./notification-store.server");
    await removeNotification(data.id);
    return { ok: true };
  });

export const getPreferencesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificationPreferences> => {
    if (!allowUnauthenticatedDashboard()) return SAFE_DEFAULT_PREFS;

    const { getPreferences } = await import("./notification-store.server");
    return getPreferences();
  },
);

export const savePreferencesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => preferencesSchema.parse(d))
  .handler(async ({ data }) => {
    requireDashboardAccess();

    const { savePreferences } = await import("./notification-store.server");
    await savePreferences(data);
    return { ok: true };
  });
