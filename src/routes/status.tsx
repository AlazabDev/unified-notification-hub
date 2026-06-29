import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Wifi, WifiOff, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  listDeliveryAttemptsFn,
  listDeliveryJobsFn,
  listIngestionErrorEventsFn,
} from "@/lib/status.functions";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "حالة النظام — Az Notification Hub" },
      { name: "description", content: "حالة اتصال Realtime وآخر محاولات التسليم" },
    ],
  }),
  component: StatusPage,
});

type RealtimeState = "connecting" | "connected" | "disconnected" | "error";

function StatusPage() {
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("connecting");
  const [wsState, setWsState] = useState<RealtimeState>("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [reconnects, setReconnects] = useState(0);
  const listAttempts = useServerFn(listDeliveryAttemptsFn);
  const listJobs = useServerFn(listDeliveryJobsFn);
  const listErrors = useServerFn(listIngestionErrorEventsFn);

  useEffect(() => {
    const channel = supabase
      .channel("status-monitor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => setLastEventAt(new Date().toISOString()),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeState("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeState("error");
          setReconnects((r) => r + 1);
        } else if (status === "CLOSED") setRealtimeState("disconnected");
      });

    const socket = supabase.realtime;
    const checkWs = () => {
      const conn = (socket as unknown as { conn?: { readyState?: number } }).conn;
      if (!conn) return setWsState("connecting");
      switch (conn.readyState) {
        case 0: return setWsState("connecting");
        case 1: return setWsState("connected");
        case 2:
        case 3: return setWsState("disconnected");
        default: return setWsState("error");
      }
    };
    checkWs();
    const interval = setInterval(checkWs, 2000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const { data: attempts, refetch: refetchAttempts, isFetching: loadingAttempts } = useQuery({
    queryKey: ["delivery-attempts"],
    queryFn: () => listAttempts(),
    refetchInterval: 10000,
  });

  const { data: failedJobs, refetch: refetchJobs, isFetching: loadingJobs } = useQuery({
    queryKey: ["failed-jobs"],
    queryFn: () => listJobs(),
    refetchInterval: 10000,
  });

  const { data: errorEvents } = useQuery({
    queryKey: ["error-events"],
    queryFn: () => listErrors(),
    refetchInterval: 15000,
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" />
              حالة النظام
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              اتصال Realtime ومحاولات التسليم الأخيرة
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">الإشعارات</Link>
            </Button>
            <Button
              size="sm"
              onClick={() => { refetchAttempts(); refetchJobs(); }}
              disabled={loadingAttempts || loadingJobs}
            >
              <RefreshCw className={`h-4 w-4 ml-2 ${loadingAttempts || loadingJobs ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <ConnectionCard
            title="Supabase Realtime"
            state={realtimeState}
            detail={lastEventAt ? `آخر حدث: ${new Date(lastEventAt).toLocaleTimeString("ar")}` : "بانتظار أول حدث"}
          />
          <ConnectionCard
            title="WebSocket"
            state={wsState}
            detail={`عدد إعادات الاتصال: ${reconnects}`}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">نقطة الاستقبال</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <code className="text-xs break-all">/api/public/ingest</code>
              </div>
              <p className="text-xs text-muted-foreground mt-2">جاهزة لاستقبال الـ webhooks</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">آخر محاولات التسليم</CardTitle>
          </CardHeader>
          <CardContent>
            {!attempts || attempts.length === 0 ? (
              <EmptyState text="لا توجد محاولات تسليم بعد" />
            ) : (
              <div className="space-y-2">
                {attempts.map((a) => (
                  <AttemptRow key={a.id} a={a} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">المهام المعلقة / الفاشلة</CardTitle>
          </CardHeader>
          <CardContent>
            {!failedJobs || failedJobs.length === 0 ? (
              <EmptyState text="لا توجد مهام فاشلة" />
            ) : (
              <div className="space-y-2">
                {failedJobs.map((j) => (
                  <JobRow key={j.id} j={j} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">آخر أخطاء الاستقبال</CardTitle>
          </CardHeader>
          <CardContent>
            {!errorEvents || errorEvents.length === 0 ? (
              <EmptyState text="لا توجد أخطاء" />
            ) : (
              <div className="space-y-2">
                {errorEvents.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant={e.status === "failed" ? "destructive" : "secondary"}>
                          {e.status} · {e.status_code}
                        </Badge>
                        {e.error_code && <code className="text-muted-foreground">{e.error_code}</code>}
                        <span className="text-muted-foreground mr-auto">
                          {new Date(e.created_at).toLocaleString("ar")}
                        </span>
                      </div>
                      {e.error_message && (
                        <p className="text-sm mt-1 break-words">{e.error_message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectionCard({ title, state, detail }: { title: string; state: RealtimeState; detail: string }) {
  const meta = {
    connected: { label: "متصل", variant: "default" as const, Icon: Wifi, color: "text-emerald-500" },
    connecting: { label: "جارٍ الاتصال", variant: "secondary" as const, Icon: RefreshCw, color: "text-amber-500" },
    disconnected: { label: "غير متصل", variant: "secondary" as const, Icon: WifiOff, color: "text-muted-foreground" },
    error: { label: "خطأ", variant: "destructive" as const, Icon: AlertTriangle, color: "text-red-500" },
  }[state];
  const { Icon } = meta;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${meta.color} ${state === "connecting" ? "animate-spin" : ""}`} />
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{detail}</p>
      </CardContent>
    </Card>
  );
}

function AttemptRow({ a }: { a: {
  id: string; channel: string; status: string; provider: string | null;
  attempt_count: number; last_error: string | null; delivered_at: string | null;
  created_at: string; notification_id: string;
} }) {
  const failed = a.status === "failed" || a.last_error;
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
      {failed ? (
        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Badge variant="outline">{a.channel}</Badge>
          {a.provider && <span className="text-muted-foreground">{a.provider}</span>}
          <Badge variant={failed ? "destructive" : "default"}>{a.status}</Badge>
          <span className="text-muted-foreground">محاولة #{a.attempt_count}</span>
          <span className="text-muted-foreground mr-auto">
            {new Date(a.created_at).toLocaleString("ar")}
          </span>
        </div>
        {a.last_error && (
          <p className="text-sm mt-1 text-red-400 break-words">{a.last_error}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">{a.notification_id}</p>
      </div>
    </div>
  );
}

function JobRow({ j }: { j: {
  id: string; job_type: string; status: string; attempts: number; max_attempts: number;
  last_error: string | null; run_at: string; updated_at: string; notification_id: string | null;
} }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
      <RefreshCw className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Badge variant="outline">{j.job_type}</Badge>
          <Badge variant={j.status === "failed" ? "destructive" : "secondary"}>{j.status}</Badge>
          <span className="text-muted-foreground">
            محاولات {j.attempts}/{j.max_attempts}
          </span>
          <span className="text-muted-foreground mr-auto">
            موعد التشغيل: {new Date(j.run_at).toLocaleString("ar")}
          </span>
        </div>
        {j.last_error && (
          <p className="text-sm mt-1 text-red-400 break-words">{j.last_error}</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-sm text-muted-foreground py-8">{text}</div>
  );
}
