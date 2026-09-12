import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getChateraCredentialStatus } from "@/lib/chatera-credentials.functions";
import { CHATERA_WEBHOOK_URL } from "@/lib/chatera-webhook-url";

export const Route = createFileRoute("/_authenticated/setup-chatera")({
  head: () => ({
    meta: [
      { title: "Setup Kredensial Chatera | Purworejo chatbot Apps" },
      {
        name: "description",
        content:
          "Panduan dan status penyimpanan kunci API serta secret webhook Chatera untuk Purworejo chatbot Apps.",
      },
      { property: "og:title", content: "Setup Kredensial Chatera | Purworejo chatbot Apps" },
      {
        property: "og:description",
        content: "Simpan kunci API dan secret webhook Chatera secara aman di sisi server.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupChateraPage,
});

function StatusBadge({ ok, loading }: { ok: boolean | undefined; loading: boolean }) {
  if (loading) return <Badge variant="secondary">Memeriksa…</Badge>;
  return ok ? (
    <Badge className="bg-green-600 text-white hover:bg-green-600">Tersimpan di server</Badge>
  ) : (
    <Badge variant="destructive">Belum diatur</Badge>
  );
}

function SetupChateraPage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["chatera-credential-status"],
    queryFn: () => getChateraCredentialStatus(),
  });
  const [copied, setCopied] = useState(false);

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(CHATERA_WEBHOOK_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard tidak tersedia
    }
  }

  const ready = Boolean(data?.apiKeyConfigured && data?.webhookSecretConfigured);

  return (
    <AppShell title="Setup Kredensial Chatera">
      <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              Status kredensial
            </CardTitle>
            <CardDescription>
              Kunci API dan secret webhook disimpan sebagai secret di server. Nilainya tidak pernah
              disimpan di database maupun dikirim ke browser — halaman ini hanya menampilkan status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">CHATERA_API_KEY</p>
                <p className="text-xs text-muted-foreground">
                  Dipakai server untuk mengirim balasan WhatsApp lewat Chatera.
                </p>
              </div>
              <StatusBadge ok={data?.apiKeyConfigured} loading={isLoading} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">CHATERA_WEBHOOK_SECRET</p>
                <p className="text-xs text-muted-foreground">
                  Dipakai server untuk memverifikasi keaslian pesan masuk.
                </p>
              </div>
              <StatusBadge ok={data?.webhookSecretConfigured} loading={isLoading} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                Periksa ulang status
              </Button>
              {ready ? (
                <p className="text-xs text-green-700">Integrasi siap dipakai.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Isi kedua nilai lewat formulir aman di chat Lovable, lalu periksa ulang.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">URL Webhook</CardTitle>
            <CardDescription>
              Pasang URL ini di pengaturan webhook Chatera dengan event message.inbound.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="setup-webhook-url">Endpoint webhook</Label>
            <div className="flex gap-2">
              <Input
                id="setup-webhook-url"
                value={CHATERA_WEBHOOK_URL}
                readOnly
                className="font-mono text-xs sm:text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Salin URL webhook"
                onClick={() => void copyWebhook()}
              >
                {copied ? <Check className="text-green-600" /> : <Copy />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cara mengisi kredensial</CardTitle>
            <CardDescription>Tiga langkah singkat, tanpa menempel nilai di halaman ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Ambil kunci API dari dasbor Chatera (menu Pengembang / API Keys) dan siapkan satu teks
                acak panjang sebagai secret webhook.
              </li>
              <li>
                Minta penyimpanan kredensial lewat chat Lovable. Formulir aman akan terbuka dan nilai
                langsung tersimpan sebagai secret server — tidak melewati halaman, chat, atau database.
              </li>
              <li>
                Tempel URL webhook di atas beserta secret webhook yang sama ke pengaturan webhook
                Chatera, lalu tekan "Periksa ulang status".
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
