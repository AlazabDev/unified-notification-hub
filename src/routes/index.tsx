import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  Inbox as InboxIcon,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Settings as SettingsIcon,
  Smartphone,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Toaster, toast } from "sonner";
import { useNotificationSound, SOUND_OPTIONS, type SoundKey } from "@/hooks/useNotificationSound";

import {
  getPreferencesFn,
  ingestNotificationFn,
  listNotificationsFn,
  markAllReadFn,
  markReadFn,
  removeNotificationFn,
  savePreferencesFn,
} from "@/lib/notifications.functions";
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
  NotificationSource,
  UnifiedNotification,
} from "@/types/notification";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Az Notification Hub — مركز الإشعارات الموحد" },
      {
        name: "description",
        content:
          "نظام إشعارات مركزي بواجهة رسومية يربط جميع أنظمة الشركة (Meta, UberFix, Accounting) عبر طبقة ingestion موحدة وقنوات تسليم متعددة.",
      },
    ],
  }),
  component: Dashboard,
});

const sourceMeta: Record<
  NotificationSource,
  { label: string; color: string }
> = {
  meta: { label: "Meta", color: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
  uberfix: { label: "UberFix", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  accounting: { label: "Accounting", color: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  system: { label: "System", color: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  custom: { label: "Custom", color: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
};

function Dashboard() {
  const [tab, setTab] = useState<NotificationCategory>("all");
  const [view, setView] = useState<"inbox" | "preferences">("inbox");

  const qc = useQueryClient();
  const listFn = useServerFn(listNotificationsFn);
  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 15000,
  });

  const onIncoming = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [qc]);
  const sound = useNotificationSound(onIncoming);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((n) => n.category === tab);
  }, [items, tab]);

  const unread = items.filter((n) => !n.read).length;

  const ingestMut = useMutation({
    mutationFn: useServerFn(ingestNotificationFn),
    onSuccess: () => {
      toast.success("تم إرسال إشعار تجريبي");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const sendDemo = () => {
    const samples = [
      {
        source: "meta" as const,
        eventType: "lead.new",
        title: "عميل جديد من حملة Instagram",
        body: "وصلك Lead جديد من حملة 'عروض الربيع' — اسم: محمد، رقم: 05XXXXXX.",
        severity: "info" as const,
        category: "projects" as const,
        actions: [
          { id: "open", label: "فتح Lead", variant: "primary" as const, actionKey: "open_lead" },
        ],
      },
      {
        source: "uberfix" as const,
        eventType: "ticket.assigned",
        title: "تذكرة صيانة جديدة #4821",
        body: "تم تعيين تذكرة صيانة جديدة لفريق التكييف — الأولوية عالية.",
        severity: "warning" as const,
        category: "projects" as const,
      },
      {
        source: "accounting" as const,
        eventType: "invoice.overdue",
        title: "فاتورة متأخرة #INV-2031",
        body: "فاتورة بمبلغ 12,400 ر.س متأخرة عن السداد منذ 4 أيام.",
        severity: "critical" as const,
        category: "alerts" as const,
        actions: [
          { id: "open", label: "عرض الفاتورة", variant: "primary" as const },
          { id: "snooze", label: "تأجيل", variant: "secondary" as const },
        ],
      },
    ];
    const pick = samples[Math.floor(Math.random() * samples.length)];
    ingestMut.mutate({ data: pick });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <Toaster position="top-left" richColors closeButton />

      <div className="mx-auto flex max-w-[1400px] gap-6 p-4 md:p-8">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col gap-2 rounded-2xl bg-sidebar p-4 text-sidebar-foreground lg:flex">
          <div className="mb-4 flex items-center gap-2 px-2 pt-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Az Notification Hub</div>
              <div className="text-[11px] text-sidebar-foreground/60">
                مركز الإشعارات الموحد
              </div>
            </div>
          </div>

          <SideItem
            active={view === "inbox"}
            onClick={() => setView("inbox")}
            icon={<InboxIcon className="h-4 w-4" />}
            label="صندوق الوارد"
            badge={unread || undefined}
          />
          <SideItem
            active={view === "preferences"}
            onClick={() => setView("preferences")}
            icon={<SettingsIcon className="h-4 w-4" />}
            label="التفضيلات"
          />
          <SideItem
            icon={<Zap className="h-4 w-4" />}
            label="مفاتيح الـ API"
            hint="قريباً"
            disabled
          />
          <SideItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="قنوات التسليم"
            hint="قريباً"
            disabled
          />

          <div className="mt-auto rounded-xl bg-sidebar-accent p-3 text-xs text-sidebar-accent-foreground">
            <div className="mb-1 flex items-center gap-1 font-semibold">
              <Zap className="h-3.5 w-3.5" /> Ingestion API
            </div>
            <code className="block break-all rounded bg-black/30 p-2 font-mono text-[10px] text-emerald-300">
              POST /api/public/ingest
            </code>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 space-y-6">
          <Hero
            unread={unread}
            total={items.length}
            onSendDemo={sendDemo}
            sending={ingestMut.isPending}
            soundEnabled={sound.enabled}
            onToggleSound={() => sound.setEnabled(!sound.enabled)}
            soundKey={sound.soundKey}
            onChangeSound={(k) => {
              sound.setSoundKey(k);
              setTimeout(() => sound.play(), 50);
            }}
            onTestSound={() => sound.play()}
          />

          {view === "inbox" ? (
            <InboxPanel
              items={filtered}
              tab={tab}
              setTab={setTab}
              unread={unread}
              onChange={() =>
                qc.invalidateQueries({ queryKey: ["notifications"] })
              }
            />
          ) : (
            <PreferencesPanel />
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SideItem({
  active,
  onClick,
  icon,
  label,
  badge,
  hint,
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-right">{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
          {badge}
        </span>
      )}
      {hint && (
        <span className="text-[10px] text-sidebar-foreground/50">{hint}</span>
      )}
    </button>
  );
}

function Hero({
  unread,
  total,
  onSendDemo,
  sending,
  soundEnabled,
  onToggleSound,
  soundKey,
  onChangeSound,
  onTestSound,
}: {
  unread: number;
  total: number;
  onSendDemo: () => void;
  sending: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  soundKey: SoundKey;
  onChangeSound: (k: SoundKey) => void;
  onTestSound: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card p-6 md:p-8">
      <div className="absolute inset-0 hero-grid opacity-40" />
      <div className="relative flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Event-Driven · Unified Model · Realtime
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            مرحباً بك في <span className="text-primary">Az Notification Hub</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            مركز الإشعارات الموحد لجميع أنظمتك. كل حدث يمر عبر Zod validation ثم Normalizer
            ثم Channel gateways. الواجهة تحدّث نفسها لحظياً.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Stat label="غير مقروء" value={unread} highlight />
          <Stat label="الإجمالي" value={total} />
          <div className="flex items-center gap-1 rounded-xl border bg-background px-2 py-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSound}
              title={soundEnabled ? "كتم الصوت" : "تفعيل الصوت"}
              className="h-8 w-8"
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <select
              value={soundKey}
              onChange={(e) => onChangeSound(e.target.value as SoundKey)}
              className="bg-transparent text-xs outline-none"
              title="اختر نغمة الإشعار"
            >
              {SOUND_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={onTestSound}
              className="h-8 px-2 text-xs"
            >
              تجربة
            </Button>
          </div>
          <Button onClick={onSendDemo} disabled={sending} className="gap-2">
            <BellRing className="h-4 w-4" />
            {sending ? "..." : "إشعار تجريبي"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-2 text-center",
        highlight && "border-primary/30 bg-primary/5",
      )}
    >
      <div className={cn("text-xl font-bold", highlight && "text-primary")}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function InboxPanel({
  items,
  tab,
  setTab,
  unread,
  onChange,
}: {
  items: UnifiedNotification[];
  tab: NotificationCategory;
  setTab: (v: NotificationCategory) => void;
  unread: number;
  onChange: () => void;
}) {
  const markAllFn = useServerFn(markAllReadFn);
  const markAllMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      toast.success("تم تعليم الكل كمقروء");
      onChange();
    },
  });

  return (
    <section className="rounded-2xl border bg-card">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread}
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold">Inbox</h2>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllMut.mutate()}
            disabled={!unread || markAllMut.isPending}
            className="gap-1"
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">تعليم الكل كمقروء</span>
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as NotificationCategory)}
        className="w-full"
      >
        <TabsList className="mx-5 mt-3 grid w-fit grid-cols-4 bg-transparent p-0">
          <TabTrigger value="all" label="الكل" count={unread} />
          <TabTrigger value="projects" label="المشاريع" />
          <TabTrigger value="announcements" label="إعلانات" />
          <TabTrigger value="alerts" label="تنبيهات" />
        </TabsList>

        <TabsContent value={tab} className="m-0">
          <ul className="inbox-scroll max-h-[600px] divide-y overflow-y-auto">
            {items.length === 0 && (
              <li className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <InboxIcon className="h-10 w-10 opacity-40" />
                <p className="text-sm">لا توجد إشعارات في هذه الفئة</p>
              </li>
            )}
            {items.map((n) => (
              <NotificationRow key={n.id} item={n} onChange={onChange} />
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function TabTrigger({
  value,
  label,
  count,
}: {
  value: string;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-primary"
    >
      <span className="flex items-center gap-1.5">
        {label}
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-destructive px-1.5 py-0 text-[10px] font-bold text-destructive-foreground">
            {count}
          </span>
        )}
      </span>
    </TabsTrigger>
  );
}

function NotificationRow({
  item,
  onChange,
}: {
  item: UnifiedNotification;
  onChange: () => void;
}) {
  const markReadMutFn = useServerFn(markReadFn);
  const removeMutFn = useServerFn(removeNotificationFn);

  const markMut = useMutation({
    mutationFn: (read: boolean) => markReadMutFn({ data: { id: item.id, read } }),
    onSuccess: onChange,
  });
  const removeMut = useMutation({
    mutationFn: () => removeMutFn({ data: { id: item.id } }),
    onSuccess: () => {
      toast.success("تم حذف الإشعار");
      onChange();
    },
  });

  const meta = sourceMeta[item.source];
  const time = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: true,
    locale: ar,
  });

  return (
    <li
      className={cn(
        "group flex gap-3 px-5 py-4 transition-colors hover:bg-muted/50",
        !item.read && "bg-primary/[0.02]",
      )}
      onClick={() => !item.read && markMut.mutate(true)}
    >
      <div className="relative shrink-0">
        {item.avatarUrl ? (
          <img
            src={item.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full bg-muted object-cover"
          />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Bell className="h-5 w-5" />
          </div>
        )}
        {!item.read && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  "truncate text-sm",
                  item.read ? "font-medium" : "font-semibold",
                )}
              >
                {item.title}
              </h3>
              <Badge
                variant="outline"
                className={cn("shrink-0 border-0 text-[10px]", meta.color)}
              >
                {meta.label}
              </Badge>
              {item.severity === "critical" && (
                <Badge variant="destructive" className="shrink-0 text-[10px]">
                  حرج
                </Badge>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.body}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeMut.mutate();
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="حذف"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </button>
        </div>

        {item.actions && item.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.actions.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant={a.variant === "primary" ? "default" : "secondary"}
                onClick={(e) => {
                  e.stopPropagation();
                  toast(`${a.label}`, {
                    description: `Action: ${a.actionKey ?? a.id}`,
                  });
                  markMut.mutate(true);
                }}
                className="h-7 text-xs"
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{time}</span>
          {item.subject && (
            <>
              <span>·</span>
              <span className="truncate">{item.subject}</span>
            </>
          )}
          {item.channels && item.channels.length > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                {item.channels.map((c) => (
                  <ChannelIcon key={c} channel={c} className="h-3 w-3" />
                ))}
              </span>
            </>
          )}
          {item.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markMut.mutate(false);
              }}
              className="mr-auto text-primary hover:underline"
            >
              تعليم كغير مقروء
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function ChannelIcon({
  channel,
  className,
}: {
  channel: NotificationChannel;
  className?: string;
}) {
  switch (channel) {
    case "inapp":
      return <Bell className={className} />;
    case "email":
      return <Mail className={className} />;
    case "push":
      return <Smartphone className={className} />;
    case "chat":
      return <MessageSquare className={className} />;
    case "sms":
      return <MessageSquare className={className} />;
  }
}

/* -------------------------------------------------------------------------- */

function PreferencesPanel() {
  const getFn = useServerFn(getPreferencesFn);
  const saveFn = useServerFn(savePreferencesFn);
  const { data, refetch } = useQuery({
    queryKey: ["preferences"],
    queryFn: () => getFn(),
  });

  const saveMut = useMutation({
    mutationFn: (p: NotificationPreferences) => saveFn({ data: p }),
    onSuccess: () => {
      toast.success("تم حفظ التفضيلات");
      refetch();
    },
  });

  if (!data) return null;

  const update = (next: NotificationPreferences) => saveMut.mutate(next);

  return (
    <section className="rounded-2xl border bg-card">
      <header className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold">التفضيلات</h2>
        <p className="text-xs text-muted-foreground">
          تحكّم في القنوات التي تستقبل عليها كل نوع من الإشعارات.
        </p>
      </header>

      <div className="space-y-6 p-5">
        <PrefGroup
          title="التفضيلات العامة"
          channels={data.global}
          onChange={(channels) => update({ ...data, global: channels })}
        />

        <div>
          <h3 className="mb-3 text-sm font-semibold">حسب نوع الـ Workflow</h3>
          <div className="space-y-3">
            {data.workflows.map((wf, i) => (
              <PrefGroup
                key={wf.workflowId}
                title={wf.name}
                subtitle={describeChannels(wf.channels)}
                channels={wf.channels}
                onChange={(channels) => {
                  const next = [...data.workflows];
                  next[i] = { ...wf, channels };
                  update({ ...data, workflows: next });
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PrefGroup({
  title,
  subtitle,
  channels,
  onChange,
}: {
  title: string;
  subtitle?: string;
  channels: NotificationPreferences["global"];
  onChange: (c: NotificationPreferences["global"]) => void;
}) {
  const rows: { key: keyof typeof channels; label: string; icon: React.ReactNode }[] = [
    { key: "inapp", label: "In-App", icon: <Bell className="h-4 w-4" /> },
    { key: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
    { key: "push", label: "Push", icon: <Smartphone className="h-4 w-4" /> },
    { key: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
    { key: "sms", label: "SMS", icon: <MessageSquare className="h-4 w-4" /> },
  ];
  return (
    <div className="rounded-xl border bg-background">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        )}
      </div>
      <div className="divide-y">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between px-4 py-2.5"
          >
            <div className="flex items-center gap-2.5 text-sm">
              <span className="text-muted-foreground">{r.icon}</span>
              {r.label}
            </div>
            <Switch
              checked={channels[r.key]}
              onCheckedChange={(v) => onChange({ ...channels, [r.key]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function describeChannels(c: NotificationPreferences["global"]) {
  const list: string[] = [];
  if (c.inapp) list.push("Inbox");
  if (c.email) list.push("Email");
  if (c.push) list.push("Push");
  if (c.chat) list.push("Chat");
  if (c.sms) list.push("SMS");
  return list.join("، ") || "معطّل";
}
