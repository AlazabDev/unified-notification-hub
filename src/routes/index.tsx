import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronDown,
  Code2,
  Copy,
  ExternalLink,
  Globe2,
  Inbox as InboxIcon,
  KeyRound,
  Mail,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Settings as SettingsIcon,
  Smartphone,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Toaster, toast } from "sonner";
import { useNotificationSound, SOUND_OPTIONS, type SoundKey } from "@/hooks/useNotificationSound";
import {
  AZAB_PAYMENT_CHANNELS,
  IMPORTANCE_LABEL,
  loadChannelSettings,
  saveChannelSettings,
  type ChannelImportance,
  type ChannelSettings,
} from "@/lib/notification-channels";


import {
  createSourceTokenFn,
  getPreferencesFn,
  ingestNotificationFn,
  listNotificationSourcesFn,
  listNotificationsFn,
  markAllReadFn,
  markReadFn,
  removeNotificationFn,
  savePreferencesFn,
  type NotificationSourceRow,
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

type DashboardView = "inbox" | "preferences" | "integrations";

function Dashboard() {
  const [tab, setTab] = useState<NotificationCategory>("all");
  const [view, setView] = useState<DashboardView>("inbox");

  const qc = useQueryClient();
  const listFn = useServerFn(listNotificationsFn);
  const { data: items = [], error: notificationsError, isLoading: loadingNotifications } = useQuery({
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
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      toast.error("فشل إرسال الإشعار التجريبي", {
        description: error instanceof Error ? error.message : "راجع إعدادات Supabase",
      });
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
            active={view === "integrations"}
            onClick={() => setView("integrations")}
            icon={<KeyRound className="h-4 w-4" />}
            label="الربط والـ Webhook"
          />
          <SideItem
            active={view === "integrations"}
            onClick={() => setView("integrations")}
            icon={<MessageSquare className="h-4 w-4" />}
            label="قنوات التسليم"
          />
          <Link
            to="/status"
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Activity className="h-4 w-4" />
            <span className="flex-1 text-right">حالة النظام</span>
            <ExternalLink className="h-3.5 w-3.5 text-sidebar-foreground/50" />
          </Link>

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

          <DashboardMobileNav view={view} setView={setView} unread={unread} />

          {notificationsError && (
            <ErrorBanner
              title="تعذر تحميل الإشعارات من Supabase"
              error={notificationsError}
              hint="تأكد من وجود AZ_SUPABASE_SERVICE_ROLE_KEY في Secrets ومن تفعيل جداول Supabase."
            />
          )}

          {view === "inbox" ? (
            <InboxPanel
              items={filtered}
              tab={tab}
              setTab={setTab}
              unread={unread}
              loading={loadingNotifications}
              onOpenPreferences={() => setView("preferences")}
              onChange={() => {
                void qc.invalidateQueries({ queryKey: ["notifications"] });
              }}
            />
          ) : view === "preferences" ? (
            <PreferencesPanel />
          ) : (
            <IntegrationsPanel />
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DashboardMobileNav({
  view,
  setView,
  unread,
}: {
  view: DashboardView;
  setView: (view: DashboardView) => void;
  unread: number;
}) {
  const items: Array<{ view: DashboardView; label: string; icon: ReactNode; badge?: number }> = [
    { view: "inbox", label: "الوارد", icon: <InboxIcon className="h-4 w-4" />, badge: unread || undefined },
    { view: "preferences", label: "الإعدادات", icon: <SettingsIcon className="h-4 w-4" /> },
    { view: "integrations", label: "الربط", icon: <KeyRound className="h-4 w-4" /> },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 lg:hidden">
      {items.map((item) => (
        <button
          key={item.view}
          onClick={() => setView(item.view)}
          className={cn(
            "relative flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
            view === item.view
              ? "border-primary/40 bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge !== undefined && (
            <span className="absolute -top-1 -right-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
              {item.badge}
            </span>
          )}
        </button>
      ))}
      <Button asChild variant="outline" className="rounded-xl">
        <Link to="/status" className="gap-2">
          <Activity className="h-4 w-4" />
          الحالة
        </Link>
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ErrorBanner({ title, error, hint }: { title: string; error: unknown; hint?: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <div className="font-semibold text-destructive">{title}</div>
      <p dir="ltr" className="mt-1 break-words text-left font-mono text-xs text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
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
  icon: ReactNode;
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
  loading,
  onOpenPreferences,
  onChange,
}: {
  items: UnifiedNotification[];
  tab: NotificationCategory;
  setTab: (v: NotificationCategory) => void;
  unread: number;
  loading?: boolean;
  onOpenPreferences: () => void;
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
          <Button variant="ghost" size="icon" onClick={onOpenPreferences} title="فتح الإعدادات">
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
            {loading && items.length === 0 && (
              <li className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin opacity-50" />
                <p className="text-sm">جاري تحميل الإشعارات...</p>
              </li>
            )}
            {!loading && items.length === 0 && (
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

function IntegrationsPanel() {
  const endpoint = "https://notify.alazab.com/api/public/ingest";
  const listSourcesFn = useServerFn(listNotificationSourcesFn);
  const createTokenFn = useServerFn(createSourceTokenFn);
  const qc = useQueryClient();
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState<{
    name: string;
    domain: string;
    sourceKey: string;
    sourceType: "meta" | "uberfix" | "accounting" | "system" | "custom";
    rateLimitPerMinute: number;
  }>({
    name: "Internal Company Systems",
    domain: "notify.alazab.com",
    sourceKey: "company_internal",
    sourceType: "custom" as const,
    rateLimitPerMinute: 120,
  });

  const { data: sources = [], error: sourcesError, isLoading: loadingSources } = useQuery({
    queryKey: ["notification-sources"],
    queryFn: () => listSourcesFn(),
  });

  const createTokenMut = useMutation({
    mutationFn: () => createTokenFn({ data: sourceForm }),
    onSuccess: (result) => {
      setGeneratedToken(result.token);
      toast.success("تم إنشاء مفتاح الربط وتفعيل المصدر");
      void qc.invalidateQueries({ queryKey: ["notification-sources"] });
    },
    onError: (error) => {
      toast.error("فشل إنشاء مفتاح الربط", {
        description: error instanceof Error ? error.message : "راجع جداول Supabase والصلاحيات",
      });
    },
  });

  const curlExample = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${generatedToken ?? "YOUR_SOURCE_TOKEN"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "custom",
    "eventType": "order.created",
    "title": "طلب جديد #1001",
    "body": "تم إنشاء طلب جديد ويحتاج متابعة.",
    "severity": "info",
    "category": "projects",
    "payload": { "orderId": "1001" }
  }'`;

  const tsExample = `await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${generatedToken ?? "YOUR_SOURCE_TOKEN"}",
    "Content-Type": "application/json",
    "X-Request-Id": crypto.randomUUID()
  },
  body: JSON.stringify({
    source: "custom",
    eventType: "ticket.assigned",
    title: "تذكرة جديدة",
    body: "تم تعيين تذكرة لفريق الدعم",
    severity: "warning",
    category: "alerts",
    payload: { ticketId: "T-4821" }
  })
});`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${label}`);
    } catch {
      toast.error("تعذر النسخ من المتصفح");
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Globe2 className="h-3.5 w-3.5" />
              الدومين المعتمد
            </div>
            <h2 className="text-xl font-bold">الربط الموحد بالـ Webhook</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              أي نظام في الشركة يضيف هذا الرابط كـ Notify URL ويرسل بيانات بسيطة؛ النظام يحولها إلى Unified Notification ويحفظها في Supabase وتظهر فوراً في اللوحة.
            </p>
          </div>
          <Button variant="outline" onClick={() => void copy(endpoint, "رابط الاستقبال")} className="gap-2">
            <Copy className="h-4 w-4" />
            نسخ الرابط
          </Button>
        </div>

        <div className="mt-5 rounded-xl border bg-background p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            رابط الاستقبال النشط
          </div>
          <code dir="ltr" className="block break-all rounded-lg bg-black/80 p-3 text-left font-mono text-xs text-emerald-300">
            POST {endpoint}
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            المصادقة المطلوبة: <span dir="ltr" className="font-mono">Authorization: Bearer YOUR_SOURCE_TOKEN</span>. يمكن تسجيل كل نظام في جدول <span className="font-mono">notification_sources</span> أو استخدام <span className="font-mono">INGEST_TOKEN</span> كحل داخلي مؤقت.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">إعداد مصدر ربط جديد</h3>
            <p className="text-xs text-muted-foreground">
              أنشئ Token، انسخه مرة واحدة، ثم ضعه في أي نظام كـ Webhook/Notify URL.
            </p>
          </div>

          <div className="space-y-3">
            <FieldLabel label="اسم النظام">
              <input
                value={sourceForm.name}
                onChange={(e) => setSourceForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </FieldLabel>
            <FieldLabel label="Domain / وصف المصدر">
              <input
                dir="ltr"
                value={sourceForm.domain}
                onChange={(e) => setSourceForm((s) => ({ ...s, domain: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </FieldLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Source Key">
                <input
                  dir="ltr"
                  value={sourceForm.sourceKey}
                  onChange={(e) => setSourceForm((s) => ({ ...s, sourceKey: e.target.value.replace(/\s+/g, "_").toLowerCase() }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </FieldLabel>
              <FieldLabel label="نوع المصدر">
                <select
                  value={sourceForm.sourceType}
                  onChange={(e) => setSourceForm((s) => ({ ...s, sourceType: e.target.value as typeof sourceForm.sourceType }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="custom">Custom</option>
                  <option value="system">System</option>
                  <option value="meta">Meta</option>
                  <option value="uberfix">UberFix</option>
                  <option value="accounting">Accounting</option>
                </select>
              </FieldLabel>
            </div>
            <Button onClick={() => createTokenMut.mutate()} disabled={createTokenMut.isPending} className="w-full gap-2">
              <KeyRound className="h-4 w-4" />
              {createTokenMut.isPending ? "جاري الإنشاء..." : "إنشاء / تجديد Token وتفعيل المصدر"}
            </Button>
          </div>

          {generatedToken && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="mb-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                انسخ هذا المفتاح الآن — لن يظهر من قاعدة البيانات مرة أخرى
              </div>
              <code dir="ltr" className="block break-all rounded bg-black/80 p-3 text-left font-mono text-[11px] text-emerald-300">
                {generatedToken}
              </code>
              <Button variant="outline" size="sm" onClick={() => void copy(generatedToken, "Token")} className="mt-3 gap-2">
                <Copy className="h-4 w-4" /> نسخ Token
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">الأنظمة المتصلة</h3>
              <p className="text-xs text-muted-foreground">المصادر المسجلة في Supabase والتي يمكنها إرسال إشعارات.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void qc.invalidateQueries({ queryKey: ["notification-sources"] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {sourcesError && (
            <ErrorBanner
              title="تعذر تحميل مصادر الربط"
              error={sourcesError}
              hint="تأكد من وجود جدول notification_sources ومن مفتاح AZ_SUPABASE_SERVICE_ROLE_KEY."
            />
          )}
          {loadingSources && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin opacity-50" /> جاري التحميل...
            </div>
          )}
          {!loadingSources && !sourcesError && sources.length === 0 && (
            <div className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
              لا توجد مصادر بعد. أنشئ أول Token من النموذج المجاور.
            </div>
          )}
          <div className="space-y-3">
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IntegrationCodeCard title="مثال cURL" code={curlExample} onCopy={() => void copy(curlExample, "مثال cURL")} />
        <IntegrationCodeCard title="مثال TypeScript / React / Vite" code={tsExample} onCopy={() => void copy(tsExample, "مثال TypeScript")} />
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="mb-4 text-lg font-semibold">قنوات التسليم</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <GatewayCard channel="Email" status="جاهز للتفعيل" detail="SMTP/Provider عبر Delivery Jobs" icon={<Mail className="h-5 w-5" />} />
          <GatewayCard channel="WhatsApp / Chat" status="مخطط" detail="Meta WhatsApp API أو مزود خارجي" icon={<MessageSquare className="h-5 w-5" />} />
          <GatewayCard channel="SMS" status="مخطط" detail="Twilio/Unifonic أو مزود محلي" icon={<Smartphone className="h-5 w-5" />} />
        </div>
      </div>
    </section>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SourceCard({ source }: { source: NotificationSourceRow }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{source.name}</h4>
            <Badge variant={source.active ? "default" : "secondary"}>
              {source.active ? "مفعل" : "غير مفعل"}
            </Badge>
            <Badge variant="outline">{source.source_type}</Badge>
          </div>
          <div dir="ltr" className="mt-1 text-left font-mono text-xs text-muted-foreground">
            {source.source_key} · {source.domain}
          </div>
        </div>
        <div className="text-xs text-muted-foreground sm:text-left">
          <div>Limit: {source.rate_limit_per_minute}/min</div>
          <div>
            آخر ظهور: {source.last_seen_at ? new Date(source.last_seen_at).toLocaleString("ar") : "لم يستخدم بعد"}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationCodeCard({ title, code, onCopy }: { title: string; code: string; onCopy: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="h-4 w-4 text-primary" />
          {title}
        </div>
        <Button variant="ghost" size="sm" onClick={onCopy} className="gap-2">
          <Copy className="h-4 w-4" />
          نسخ
        </Button>
      </header>
      <pre dir="ltr" className="max-h-[360px] overflow-auto bg-black/90 p-4 text-left text-xs text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function GatewayCard({
  channel,
  status,
  detail,
  icon,
}: {
  channel: string;
  status: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-primary">{icon}</span>
          {channel}
        </div>
        <Badge variant="secondary">{status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PreferencesPanel() {
  const getFn = useServerFn(getPreferencesFn);
  const saveFn = useServerFn(savePreferencesFn);
  const { data, refetch, error, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: () => getFn(),
  });

  const saveMut = useMutation({
    mutationFn: (p: NotificationPreferences) => saveFn({ data: p }),
    onSuccess: () => {
      toast.success("تم حفظ التفضيلات");
      refetch();
    },
    onError: (saveError) => {
      toast.error("فشل حفظ التفضيلات", {
        description: saveError instanceof Error ? saveError.message : "راجع إعدادات Supabase",
      });
    },
  });

  if (error) {
    return (
      <ErrorBanner
        title="تعذر تحميل التفضيلات"
        error={error}
        hint="راجع اتصال Supabase ومفتاح AZ_SUPABASE_SERVICE_ROLE_KEY."
      />
    );
  }

  if (isLoading || !data) {
    return (
      <section className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
        <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin opacity-50" />
        جاري تحميل الإعدادات...
      </section>
    );
  }

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
        <AzabPaymentsChannelsPanel />

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
  const rows: { key: keyof typeof channels; label: string; icon: ReactNode }[] = [
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
