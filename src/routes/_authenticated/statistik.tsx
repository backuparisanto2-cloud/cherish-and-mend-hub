import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, MessagesSquare, TrendingUp, UserRound } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getAdminOverview, getRecentMessages, getStatistics } from "@/lib/statistics.functions";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik Layanan | Purworejo chatbot Apps" },
      { name: "description", content: "Ringkasan percakapan, tren pesan masuk, distribusi kategori pertanyaan, dan kinerja agent layanan Kabupaten Purworejo." },
      { property: "og:title", content: "Statistik Layanan | Purworejo chatbot Apps" },
      { property: "og:description", content: "Dashboard statistik percakapan dan kinerja agent Purworejo chatbot Apps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatistikPage,
});

const PIE_COLORS = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#65a30d", "#64748b"];

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} dtk`;
  return `${m} mnt ${String(s).padStart(2, "0")} dtk`;
}

const STATUS_LABEL: Record<string, string> = {
  bot_active: "Bot Aktif",
  waiting_agent: "Menunggu Agent",
  agent_active: "Ditangani Agent",
  closed: "Selesai",
};

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function StatistikPage() {
  const { isOwner, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <AppShell title="Statistik" subtitle="Memeriksa hak akses">
        <p className="text-sm text-muted-foreground">Memuat…</p>
      </AppShell>
    );
  }

  if (!isOwner) {
    return (
      <AppShell title="Statistik" subtitle="Halaman khusus Owner">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Halaman khusus Owner</CardTitle>
            <CardDescription>
              Data percakapan dan statistik pengguna hanya dapat dibuka oleh akun Owner.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  return <StatistikOwnerView />;
}

function StatistikOwnerView() {
  const fetchStats = useServerFn(getStatistics);
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["statistik"],
    queryFn: () => fetchStats(),
  });
  const overviewQuery = useQuery({
    queryKey: ["statistik-admin-overview"],
    queryFn: () => fetchOverview(),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const conversations = useMemo(() => {
    const rows = overviewQuery.data?.conversations ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.contactName.toLowerCase().includes(q) ||
        (row.waNumber ?? "").toLowerCase().includes(q) ||
        (row.agentName ?? "").toLowerCase().includes(q)
      );
    });
  }, [overviewQuery.data, search, statusFilter]);


  const waiting = data?.waitingAgent ?? 0;
  const summary = [
    {
      label: "Total Percakapan Hari Ini",
      value: String(data?.todayConversations ?? 0),
      icon: MessagesSquare,
      hint: "Dihitung sejak awal hari ini",
    },
    {
      label: "Percakapan Minggu Ini",
      value: String(data?.weekConversations ?? 0),
      icon: TrendingUp,
      hint: "7 hari terakhir",
    },
    {
      label: "Menunggu Agent",
      value: String(waiting),
      icon: UserRound,
      hint: waiting > 0 ? "Perlu tindak lanjut" : "Semua tertangani",
      alert: waiting > 0,
    },
    {
      label: "Rata-rata Waktu Respon Agent",
      value: formatDuration(data?.avgResponseSeconds ?? null),
      icon: Clock,
      hint: data?.avgResponseSeconds == null ? "Belum ada balasan agent" : "Target di bawah 5 menit",
    },
  ];

  const daily = data?.daily ?? [];
  const categories = (data?.categories ?? []).map((c, i) => ({
    ...c,
    color: PIE_COLORS[i % PIE_COLORS.length] as string,
  }));
  const agents = data?.agents ?? [];

  return (
    <AppShell title="Statistik" subtitle="Ringkasan aktivitas layanan 7 hari terakhir">
      <div className="space-y-6">
        {isError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Data statistik gagal dimuat. Coba muat ulang halaman.
          </p>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map(({ label, value, icon: Icon, hint, alert }) => (
            <Card key={label} className={cn(alert && "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20")}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardDescription className="text-xs font-medium uppercase">{label}</CardDescription>
                <Icon className={cn("size-4 shrink-0", alert ? "text-amber-600" : "text-muted-foreground")} />
              </CardHeader>
              <CardContent>
                <p className={cn("text-2xl font-bold", alert && "text-amber-700 dark:text-amber-400")}>
                  {isLoading ? "…" : value}
                </p>
                <p className={cn("mt-1 text-xs", alert ? "text-amber-600" : "text-muted-foreground")}>{hint}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Pesan Masuk per Hari</CardTitle>
              <CardDescription>7 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} pesan`, "Pesan masuk"]} />
                  <Line type="monotone" dataKey="pesan" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Kategori Pertanyaan Terbanyak</CardTitle>
              <CardDescription>Berdasarkan jawaban Knowledge Base</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {categories.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  {isLoading ? "Memuat data…" : "Belum ada pertanyaan yang dijawab dari Knowledge Base."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="70%" paddingAngle={2}>
                      {categories.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} pertanyaan`, name]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Daftar Percakapan</CardTitle>
              <CardDescription>200 percakapan terbaru beserta status chatnya</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, nomor, atau agent"
                className="sm:w-56"
                aria-label="Cari percakapan"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-48" aria-label="Filter status">
                  <SelectValue placeholder="Semua status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  <SelectItem value="bot_active">Bot Aktif</SelectItem>
                  <SelectItem value="waiting_agent">Menunggu Agent</SelectItem>
                  <SelectItem value="agent_active">Ditangani Agent</SelectItem>
                  <SelectItem value="closed">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {conversations.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {overviewQuery.isLoading ? "Memuat data…" : "Tidak ada percakapan yang cocok."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warga</TableHead>
                      <TableHead className="w-44">Status</TableHead>
                      <TableHead className="w-40">Agent</TableHead>
                      <TableHead className="w-28">Pesan</TableHead>
                      <TableHead className="w-44">Pesan Terakhir</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">{row.contactName}</p>
                          <p className="text-xs text-muted-foreground">{row.waNumber ?? "-"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.status === "waiting_agent" ? "destructive" : "secondary"}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.agentName ?? "-"}</TableCell>
                        <TableCell className="font-semibold">{row.messageCount}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(row.lastMessageAt)}</TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/">Buka</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Statistik Pengguna</CardTitle>
              <CardDescription>Warga yang pernah menghubungi layanan</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Warga unik</p>
                <p className="text-2xl font-bold">{overviewQuery.data?.totalUsers ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Baru minggu ini</p>
                <p className="text-2xl font-bold">{overviewQuery.data?.newUsersThisWeek ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Rata-rata pesan</p>
                <p className="text-2xl font-bold">{overviewQuery.data?.avgMessagesPerUser ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Warga Paling Aktif</CardTitle>
              <CardDescription>Berdasarkan jumlah pesan pada percakapan terbaru</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {(overviewQuery.data?.topUsers ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {overviewQuery.isLoading ? "Memuat data…" : "Belum ada data warga."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warga</TableHead>
                      <TableHead className="w-28">Pesan</TableHead>
                      <TableHead className="w-44">Terakhir Aktif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overviewQuery.data?.topUsers ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.waNumber ?? "-"}</p>
                        </TableCell>
                        <TableCell className="font-semibold">{u.messages}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(u.lastSeenAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Teraktif</CardTitle>
            <CardDescription>Berdasarkan jumlah balasan yang dikirim agent</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {agents.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {isLoading ? "Memuat data…" : "Belum ada agent yang membalas percakapan."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="w-40">Chat Ditangani</TableHead>
                    <TableHead className="w-48">Rata-rata Respon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent, index) => (
                    <TableRow key={agent.name}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 border border-border">
                            <AvatarFallback className="bg-accent text-[11px] font-bold text-accent-foreground">{agent.initials}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{agent.name}</span>
                          {index === 0 ? <Badge className="ml-1">Paling aktif</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{agent.chats}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDuration(agent.avgResponseSeconds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <RecentMessagesCard />
      </div>
    </AppShell>
  );
}

function RecentMessagesCard() {
  const fetchMessages = useServerFn(getRecentMessages);
  const { data, isLoading } = useQuery({
    queryKey: ["statistik-recent-messages"],
    queryFn: () => fetchMessages(),
    refetchInterval: 15000,
  });
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pesan Masuk Terbaru</CardTitle>
        <CardDescription>Setiap pesan WhatsApp warga yang diterima, lengkap dengan waktu dan statusnya</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {isLoading ? "Memuat data…" : "Belum ada pesan masuk."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Warga</TableHead>
                <TableHead>Pesan</TableHead>
                <TableHead className="w-28">Arah</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-44">Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.contactName}</p>
                    <p className="text-xs text-muted-foreground">{m.waNumber ?? "-"}</p>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">{m.text}</TableCell>
                  <TableCell>
                    <Badge variant={m.direction === "inbound" ? "default" : "secondary"}>
                      {m.direction === "inbound" ? "Masuk" : "Keluar"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.status ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
