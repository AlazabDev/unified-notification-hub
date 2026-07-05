import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listNotificationSourcesFn,
  createSourceTokenFn,
  updateNotificationSourceFn,
  deleteNotificationSourceFn,
  rotateSourceTokenFn,
  type NotificationSourceRow,
} from "@/lib/notifications.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Pencil,
  KeyRound,
  Power,
  Radio,
} from "lucide-react";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "مصادر الإشعارات — Az Notification Hub" },
      { name: "description", content: "إدارة قنوات ومفاتيح مصادر الإشعارات" },
    ],
  }),
  component: SourcesPage,
});

const SOURCE_TYPES = [
  { value: "meta", label: "Meta" },
  { value: "uberfix", label: "UberFix" },
  { value: "accounting", label: "المحاسبة" },
  { value: "system", label: "النظام" },
  { value: "custom", label: "مخصص" },
] as const;

type SourceType = (typeof SOURCE_TYPES)[number]["value"];

function SourcesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotificationSourcesFn);
  const createFn = useServerFn(createSourceTokenFn);
  const updateFn = useServerFn(updateNotificationSourceFn);
  const deleteFn = useServerFn(deleteNotificationSourceFn);
  const rotateFn = useServerFn(rotateSourceTokenFn);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationSourceRow | null>(null);
  const [deleting, setDeleting] = useState<NotificationSourceRow | null>(null);
  const [newToken, setNewToken] = useState<{ token: string; name: string } | null>(null);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["notification-sources"],
    queryFn: () => listFn(),
    refetchInterval: 15000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notification-sources"] });

  const createMut = useMutation({
    mutationFn: (input: {
      name: string;
      domain: string;
      sourceKey: string;
      sourceType: SourceType;
      rateLimitPerMinute: number;
    }) => createFn({ data: input }),
    onSuccess: (res) => {
      invalidate();
      setCreateOpen(false);
      setNewToken({ token: res.token, name: res.source.name });
      toast.success("تم إنشاء المصدر وإصدار المفتاح");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الإنشاء"),
  });

  const updateMut = useMutation({
    mutationFn: (input: Parameters<typeof updateFn>[0]["data"]) => updateFn({ data: input }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("تم الحفظ");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحفظ"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast.success("تم الحذف");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحذف"),
  });

  const rotateMut = useMutation({
    mutationFn: (id: string) => rotateFn({ data: { id } }),
    onSuccess: (res) => {
      invalidate();
      setNewToken({ token: res.token, name: res.source.name });
      toast.success("تم توليد مفتاح جديد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل التوليد"),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Radio className="h-7 w-7 text-primary" />
              مصادر الإشعارات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              أضف قنوات (Meta / UberFix / المحاسبة …) واحصل على مفتاح API جاهز للربط
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">الإشعارات</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/status">الحالة</Link>
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              مصدر جديد
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">القنوات الحالية</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-sm text-muted-foreground py-8">جارٍ التحميل…</div>
            ) : !sources || sources.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                لا توجد مصادر بعد — أنشئ أول قناة الآن
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map((s) => (
                  <SourceRow
                    key={s.id}
                    s={s}
                    onEdit={() => setEditing(s)}
                    onDelete={() => setDeleting(s)}
                    onRotate={() => rotateMut.mutate(s.id)}
                    onToggle={() =>
                      updateMut.mutate({ id: s.id, active: !s.active })
                    }
                    rotating={rotateMut.isPending && rotateMut.variables === s.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <IngestHint />
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(v) => createMut.mutate(v)}
        submitting={createMut.isPending}
      />

      <EditDialog
        source={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={(v) => updateMut.mutate(v)}
        submitting={updateMut.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المصدر؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إبطال المفتاح الحالي ولن يستطيع «{deleting?.name}» إرسال إشعارات بعد الآن.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TokenDialog
        token={newToken}
        onOpenChange={(o) => !o && setNewToken(null)}
      />
    </div>
  );
}

function SourceRow({
  s,
  onEdit,
  onDelete,
  onRotate,
  onToggle,
  rotating,
}: {
  s: NotificationSourceRow;
  onEdit: () => void;
  onDelete: () => void;
  onRotate: () => void;
  onToggle: () => void;
  rotating: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{s.name}</span>
          <Badge variant="outline">{s.source_type}</Badge>
          <Badge variant={s.active ? "default" : "secondary"}>
            {s.active ? "مفعل" : "متوقف"}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
          <span>
            المفتاح: <code className="font-mono">{s.source_key}</code>
          </span>
          <span>النطاق: {s.domain}</span>
          <span>الحد: {s.rate_limit_per_minute}/د</span>
          {s.last_seen_at && (
            <span>آخر ظهور: {new Date(s.last_seen_at).toLocaleString("ar")}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="icon" variant="ghost" onClick={onToggle} title={s.active ? "إيقاف" : "تفعيل"}>
          <Power className={`h-4 w-4 ${s.active ? "text-emerald-500" : "text-muted-foreground"}`} />
        </Button>
        <Button size="icon" variant="ghost" onClick={onRotate} disabled={rotating} title="مفتاح جديد">
          <KeyRound className={`h-4 w-4 ${rotating ? "animate-spin" : ""}`} />
        </Button>
        <Button size="icon" variant="ghost" onClick={onEdit} title="تعديل">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} title="حذف">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: {
    name: string;
    domain: string;
    sourceKey: string;
    sourceType: SourceType;
    rateLimitPerMinute: number;
  }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("notify.alazab.com");
  const [sourceKey, setSourceKey] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("custom");
  const [rate, setRate] = useState(120);

  const reset = () => {
    setName("");
    setDomain("notify.alazab.com");
    setSourceKey("");
    setSourceType("custom");
    setRate(120);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة مصدر جديد</DialogTitle>
          <DialogDescription>
            سيتم توليد مفتاح API مرة واحدة — انسخه فوراً، لن يظهر مجدداً.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meta Ads Webhook" />
          </div>
          <div>
            <Label>معرّف القناة</Label>
            <Input
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase())}
              placeholder="meta_ads"
            />
            <p className="text-xs text-muted-foreground mt-1">حروف/أرقام/شرطات فقط — يستخدم لتمييز القناة</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>النوع</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>حد المعدل / دقيقة</Label>
              <Input
                type="number"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value) || 1)}
                min={1}
                max={5000}
              />
            </div>
          </div>
          <div>
            <Label>النطاق</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={() =>
              onSubmit({
                name: name.trim(),
                domain: domain.trim(),
                sourceKey: sourceKey.trim(),
                sourceType,
                rateLimitPerMinute: rate,
              })
            }
            disabled={submitting || name.length < 2 || sourceKey.length < 2}
          >
            {submitting ? "جارٍ الإنشاء…" : "إنشاء وإصدار مفتاح"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  source,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  source: NotificationSourceRow | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: {
    id: string;
    name?: string;
    domain?: string;
    sourceType?: SourceType;
    rateLimitPerMinute?: number;
    active?: boolean;
  }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("custom");
  const [rate, setRate] = useState(120);

  const isOpen = !!source;

  // sync when opened
  if (source && name === "" && domain === "") {
    setName(source.name);
    setDomain(source.domain);
    setSourceType(source.source_type as SourceType);
    setRate(source.rate_limit_per_minute);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) {
          setName("");
          setDomain("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل المصدر</DialogTitle>
        </DialogHeader>
        {source && (
          <div className="space-y-3">
            <div>
              <Label>الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>حد المعدل / دقيقة</Label>
                <Input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <div>
              <Label>النطاق</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={() =>
              source &&
              onSubmit({
                id: source.id,
                name,
                domain,
                sourceType,
                rateLimitPerMinute: rate,
              })
            }
            disabled={submitting}
          >
            {submitting ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TokenDialog({
  token,
  onOpenChange,
}: {
  token: { token: string; name: string } | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={!!token} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>مفتاح API لـ «{token?.name}»</DialogTitle>
          <DialogDescription>
            انسخ المفتاح الآن — للأمان لن يظهر مرة أخرى. عند فقدانه، ولّد مفتاحاً جديداً.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted p-3 font-mono text-xs break-all">
          {token?.token}
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (token) {
                navigator.clipboard.writeText(token.token);
                toast.success("تم النسخ");
              }
            }}
          >
            <Copy className="h-4 w-4 ml-2" />
            نسخ المفتاح
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>تم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IngestHint() {
  const example = `curl -X POST https://az-notification.lovable.app/api/public/ingest \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"طلب جديد","body":"وصف الإشعار","severity":"info"}'`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          كيفية الربط
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          استخدم المفتاح في ترويسة <code>Authorization: Bearer …</code> عند إرسال طلبات إلى نقطة الاستقبال:
        </p>
        <pre className="rounded-md border border-border bg-muted p-3 text-xs overflow-x-auto font-mono" dir="ltr">
{example}
        </pre>
      </CardContent>
    </Card>
  );
}
