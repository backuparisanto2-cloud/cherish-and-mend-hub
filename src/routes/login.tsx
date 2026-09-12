import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import assistantMark from "@/assets/purworejo-assistant-mark.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk | Purworejo chatbot Apps" },
      { name: "description", content: "Halaman masuk petugas layanan WhatsApp Kabupaten Purworejo." },
      { property: "og:title", content: "Masuk | Purworejo chatbot Apps" },
      { property: "og:description", content: "Masuk untuk mengelola inbox WhatsApp Kabupaten Purworejo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError("Email atau password salah.");
      return;
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-app-canvas px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src={assistantMark} alt="Logo Purworejo chatbot Apps" width={56} height={56} className="mx-auto size-14 object-contain" />
          <CardTitle className="mt-3 text-lg">Purworejo chatbot Apps</CardTitle>
          <CardDescription>Masuk dengan akun petugas yang terdaftar</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@purworejokab.go.id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Masuk
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Pendaftaran mandiri ditutup. Akun baru dibuat oleh Owner melalui halaman Pengaturan.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
