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

export const listNotificationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<UnifiedNotification[]> => {
    const { listNotifications } = await import("./notification-store.server");
    return listNotifications();
  },
);

export const ingestNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ingestSchema.parse(d))
  .handler(async ({ data }): Promise<UnifiedNotification> => {
    const { addNotification } = await import("./notification-store.server");
    const n = normalize(data);
    addNotification(n);
    // TODO(queue): enqueue channel delivery here (email/sms/push) via your
    // worker of choice once Supabase is connected.
    return n;
  });

export const markReadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), read: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { markRead } = await import("./notification-store.server");
    markRead(data.id, data.read);
    return { ok: true };
  });

export const markAllReadFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { markAllRead } = await import("./notification-store.server");
    markAllRead();
    return { ok: true };
  },
);

export const removeNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { removeNotification } = await import("./notification-store.server");
    removeNotification(data.id);
    return { ok: true };
  });

export const getPreferencesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificationPreferences> => {
    const { getPreferences } = await import("./notification-store.server");
    return getPreferences();
  },
);

export const savePreferencesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => preferencesSchema.parse(d))
  .handler(async ({ data }) => {
    const { savePreferences } = await import("./notification-store.server");
    savePreferences(data);
    return { ok: true };
  });
