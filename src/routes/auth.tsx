import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Az Notification Hub" },
      { name: "description", content: "تسجيل الدخول إلى مركز الإشعارات الموحّد." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب. تحقّق من بريدك لتفعيله، ثم اطلب من الأدمن منحك صلاحية admin.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-6">
      <Toaster position="top-center" richColors />
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-8 shadow-lg"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Az Notification Hub</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "تسجيل الدخول للوحة الإشعارات" : "إنشاء حساب جديد"}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "..." : mode === "signin" ? "دخول" : "إنشاء حساب"}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "ليس لديك حساب؟ إنشاء حساب" : "لدي حساب — دخول"}
        </button>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          الوصول للوحة مقصور على المستخدمين الذين لديهم دور <code>admin</code> في جدول
          <code> user_roles</code>.
        </p>
      </form>
    </div>
  );
}
