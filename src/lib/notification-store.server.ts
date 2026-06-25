/**
 * SERVER-ONLY in-memory notification store.
 *
 * ⚠️  This is a development stub. It loses data on server restart and does
 *     not work across multiple worker instances. When you connect your
 *     Supabase project, replace these functions with calls to your
 *     `notifications` / `notification_preferences` tables (see TODOs).
 *
 * Suggested Supabase schema:
 *   create table public.notifications (
 *     id uuid primary key default gen_random_uuid(),
 *     source text not null,
 *     category text not null,
 *     severity text not null,
 *     title text not null,
 *     body text not null,
 *     subject text,
 *     avatar_url text,
 *     actions jsonb,
 *     channels text[] default '{inapp}',
 *     raw jsonb,
 *     read boolean default false,
 *     created_at timestamptz default now()
 *   );
 *   -- + RLS + GRANTs + Realtime publication for live UI updates.
 */

import type {
  NotificationPreferences,
  UnifiedNotification,
} from "@/types/notification";

const store: UnifiedNotification[] = seed();

let preferences: NotificationPreferences = {
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

export function listNotifications(): UnifiedNotification[] {
  // TODO(supabase): replace with
  //   supabase.from('notifications').select('*').order('created_at', { ascending: false })
  return [...store].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addNotification(n: UnifiedNotification) {
  // TODO(supabase): supabase.from('notifications').insert(n)
  store.unshift(n);
  if (store.length > 500) store.length = 500;
}

export function markRead(id: string, read: boolean) {
  // TODO(supabase): supabase.from('notifications').update({ read }).eq('id', id)
  const n = store.find((x) => x.id === id);
  if (n) n.read = read;
}

export function markAllRead() {
  // TODO(supabase): supabase.from('notifications').update({ read: true }).eq('read', false)
  store.forEach((n) => (n.read = true));
}

export function removeNotification(id: string) {
  // TODO(supabase): supabase.from('notifications').delete().eq('id', id)
  const i = store.findIndex((x) => x.id === id);
  if (i >= 0) store.splice(i, 1);
}

export function getPreferences(): NotificationPreferences {
  // TODO(supabase): SELECT from notification_preferences for current user
  return preferences;
}

export function savePreferences(p: NotificationPreferences) {
  // TODO(supabase): UPSERT notification_preferences row
  preferences = p;
}

/* -------------------------------------------------------------------------- */
function seed(): UnifiedNotification[] {
  const now = Date.now();
  const at = (mins: number) => new Date(now - mins * 60_000).toISOString();
  return [
    {
      id: "seed-1",
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
