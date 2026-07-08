/**
 * Notification Channels (Android-style) for Azab_Payments.
 *
 * Each channel controls sound + importance for a class of events.
 * Channel is identified by `channelId` — resolved from the notification's
 * `eventType`, or from `raw.channelId` when provided.
 *
 * Settings are stored per channel in `localStorage` (client-side only) so
 * the receiving device controls its own alerts, matching Android's model.
 */

import type { SoundKey } from "@/hooks/useNotificationSound";
import type { UnifiedNotification } from "@/types/notification";

export type ChannelImportance = "high" | "default" | "low" | "min";

export interface NotificationChannelDef {
  id: string;
  name: string;
  description: string;
  importance: ChannelImportance;
  defaultSound: SoundKey;
  /** If true, no sound is played by default (silent channel). */
  defaultMuted?: boolean;
}

export const AZAB_PAYMENT_CHANNELS: NotificationChannelDef[] = [
  {
    id: "payment_confirmed",
    name: "تأكيدات الدفع",
    description: "عند تأكيد دفع matched/paid",
    importance: "high",
    defaultSound: "stylish",
  },
  {
    id: "payment_review",
    name: "مراجعة المدفوعات",
    description: "عند review_required",
    importance: "default",
    defaultSound: "message",
  },
  {
    id: "payment_errors",
    name: "أخطاء الإرسال",
    description: "فشل إرسال hook أو رفض السيرفر",
    importance: "default",
    defaultSound: "notification",
  },
  {
    id: "listener_status",
    name: "حالة المراقبة",
    description: "التطبيق يراقب الإشعارات/SMS",
    importance: "low",
    defaultSound: "preview",
    defaultMuted: true,
  },
];

export const CHANNELS_BY_ID: Record<string, NotificationChannelDef> =
  Object.fromEntries(AZAB_PAYMENT_CHANNELS.map((c) => [c.id, c]));

/* -------------------------------------------------------------------------- */
/*  Per-channel settings (localStorage)                                       */
/* -------------------------------------------------------------------------- */

export interface ChannelSettings {
  muted: boolean;
  sound: SoundKey;
  importance: ChannelImportance;
}

const LS_PREFIX = "az_channel_settings_";

export function loadChannelSettings(id: string): ChannelSettings {
  const def = CHANNELS_BY_ID[id];
  const fallback: ChannelSettings = {
    muted: def?.defaultMuted ?? false,
    sound: def?.defaultSound ?? "stylish",
    importance: def?.importance ?? "default",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + id);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ChannelSettings>;
    return {
      muted: parsed.muted ?? fallback.muted,
      sound: (parsed.sound as SoundKey) ?? fallback.sound,
      importance: (parsed.importance as ChannelImportance) ?? fallback.importance,
    };
  } catch {
    return fallback;
  }
}

export function saveChannelSettings(id: string, s: ChannelSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_PREFIX + id, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/*  Channel resolution                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the channel id for a notification.
 * Priority: raw.channelId → eventType → null (unmanaged).
 */
export function resolveChannelId(
  n: Pick<UnifiedNotification, "eventType" | "raw"> & {
    // Realtime row shape uses snake_case
    event_type?: string | null;
  },
): string | null {
  const raw = n.raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const c = (raw as Record<string, unknown>).channelId;
    if (typeof c === "string" && CHANNELS_BY_ID[c]) return c;
  }
  const evt = n.eventType ?? n.event_type ?? null;
  if (evt && CHANNELS_BY_ID[evt]) return evt;
  return null;
}

export const IMPORTANCE_LABEL: Record<ChannelImportance, string> = {
  high: "IMPORTANCE_HIGH",
  default: "IMPORTANCE_DEFAULT",
  low: "IMPORTANCE_LOW",
  min: "IMPORTANCE_MIN",
};
