import type {
  NotificationPreferences,
  UnifiedNotification,
} from "@/types/notification";
import {
  defaultPreferences,
  deleteNotification,
  getPersistedPreferences,
  listPersistedNotifications,
  persistAllRead,
  persistNotification,
  persistPreferences,
  persistReadState,
} from "./notification-persistence.server";

const fallbackStore: UnifiedNotification[] = seed();
let fallbackPreferences: NotificationPreferences = defaultPreferences();

export async function listNotifications(): Promise<UnifiedNotification[]> {
  const rows = await listPersistedNotifications();
  return rows.length ? rows : [...fallbackStore].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addNotification(n: UnifiedNotification) {
  const result = await persistNotification(n);
  if (!result.ok && result.reason === "not_configured") {
    fallbackStore.unshift(n);
    if (fallbackStore.length > 500) fallbackStore.length = 500;
  }
}

export async function markRead(id: string, read: boolean) {
  const result = await persistReadState(id, read);
  if (!result.ok && result.reason === "not_configured") {
    const n = fallbackStore.find((x) => x.id === id);
    if (n) n.read = read;
  }
}

export async function markAllRead() {
  const result = await persistAllRead();
  if (!result.ok && result.reason === "not_configured") {
    fallbackStore.forEach((n) => (n.read = true));
  }
}

export async function removeNotification(id: string) {
  const result = await deleteNotification(id);
  if (!result.ok && result.reason === "not_configured") {
    const i = fallbackStore.findIndex((x) => x.id === id);
    if (i >= 0) fallbackStore.splice(i, 1);
  }
}

export async function getPreferences(): Promise<NotificationPreferences> {
  return getPersistedPreferences().catch(() => fallbackPreferences);
}

export async function savePreferences(p: NotificationPreferences) {
  const result = await persistPreferences(p);
  if (!result.ok && result.reason === "not_configured") {
    fallbackPreferences = p;
  }
}

/* -------------------------------------------------------------------------- */
function seed(): UnifiedNotification[] {
  const now = Date.now();
  const at = (mins: number) => new Date(now - mins * 60_000).toISOString();
  return [
    {
      id: "seed-1",
      tenantId: "default",
      source: "meta",
      category: "projects",
      severity: "info",
      title: "Joe requested to view Q4 2024 report.",
      body: "joe@acme.co requested view access to Q4 2024 report.",
      subject: "joe@acme.co",
      createdAt: at(3),
      read: false,
      avatarUrl:
        "https://api.dicebear.com/9.x/notionists/svg?seed=joe&backgroundColor=c0aede",
      actions: [
        { id: "approve", label: "Approve", variant: "primary", actionKey: "approve" },
        { id: "deny", label: "Deny", variant: "secondary", actionKey: "deny" },
      ],
      channels: ["inapp", "email"],
    },
    {
      id: "seed-2",
      tenantId: "default",
      source: "uberfix",
      category: "projects",
      severity: "info",
      title: "2 new comments from Radek and Dima",
      body: "You have 2 new comments from Radek and Dima on the Untitled figma file in Digest Project.",
      subject: "Digest Project",
      createdAt: at(60 * 24),
      read: false,
      avatarUrl:
        "https://api.dicebear.com/9.x/notionists/svg?seed=radek&backgroundColor=b6e3f4",
      actions: [
        { id: "open", label: "Take me there", variant: "primary", actionKey: "open" },
      ],
      channels: ["inapp", "push"],
    },
    {
      id: "seed-3",
      tenantId: "default",
      source: "accounting",
      category: "alerts",
      severity: "warning",
      title: "Your account is pending verification.",
      body: "steve@acme.co is pending verification, please verify your account to protect against fraud and abuse.",
      subject: "steve@acme.co",
      createdAt: at(60 * 24 * 5),
      read: true,
      actions: [
        { id: "verify", label: "Verify now", variant: "primary", actionKey: "verify" },
        { id: "later", label: "Remind me later", variant: "secondary", actionKey: "later" },
      ],
      channels: ["inapp", "email", "sms"],
    },
    {
      id: "seed-4",
      tenantId: "default",
      source: "system",
      category: "announcements",
      severity: "success",
      title: "Az Notification Hub جاهز",
      body: "تم تركيب طبقة الاستقبال (Ingestion API). جرّب POST /api/ingest لإرسال إشعار جديد.",
      createdAt: at(60 * 24 * 7),
      read: true,
      channels: ["inapp"],
    },
  ];
}
