import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportAllData } from "@/lib/export-data.functions";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({
    meta: [
      { title: "Export Data | Purworejo chatbot Apps" },
      {
        name: "description",
        content:
          "Unduh seluruh data percakapan, kontak, dan knowledge base Purworejo chatbot Apps dalam satu berkas ZIP berisi CSV.",
      },
      { property: "og:title", content: "Export Data | Purworejo chatbot Apps" },
      {
        property: "og:description",
        content: "Unduh seluruh data Purworejo chatbot Apps sebagai ZIP berisi CSV.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExportPage,
});

function ExportPage() {
  const runExport = useServerFn(exportAllData);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ table: string; rows: number }[] | null>(null);

  async function handleDownload() {
    setLoading(true);
    try {
      const result = await runExport({ data: undefined });
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      setSummary(result.summary);
      toast.success("Data berhasil diunduh");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunduh data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Export Data" subtitle="Unduh seluruh data aplikasi dalam satu berkas ZIP">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Unduh semua data</CardTitle>
          <CardDescription>
            Berisi kontak, percakapan, pesan, log webhook Chatera, knowledge base, dokumen, dan daftar
            akun dalam format CSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => void handleDownload()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Download />}
            {loading ? "Menyiapkan berkas…" : "Unduh Semua Data (ZIP)"}
          </Button>
          {summary ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {summary.map((item) => (
                <li key={item.table}>
                  {item.table}: {item.rows} baris
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
