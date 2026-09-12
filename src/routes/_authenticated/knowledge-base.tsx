import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileUp, Link as LinkIcon, Loader2, MessageCircleQuestion, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AddUrlDialog, KnowledgeDocumentsTable, UploadDocumentDialog } from "@/components/knowledge-documents";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  KB_CATEGORIES,
  createKnowledge,
  deleteKnowledge,
  fetchKnowledge,
  updateKnowledge,
  type KbCategory,
  type KnowledgeRow,
} from "@/lib/knowledge-base";

export const Route = createFileRoute("/_authenticated/knowledge-base")({
  head: () => ({
    meta: [
      { title: "Knowledge Base Chatbot | Purworejo chatbot Apps" },
      { name: "description", content: "Kelola daftar pengetahuan jawaban chatbot layanan publik Kabupaten Purworejo per kategori dinas." },
      { property: "og:title", content: "Knowledge Base Chatbot | Purworejo chatbot Apps" },
      { property: "og:description", content: "Daftar pengetahuan, keywords, dan status aktif jawaban chatbot Kabupaten Purworejo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgeBasePage,
});

type FormState = { category: KbCategory; title: string; answer: string; keywords: string[] };

const EMPTY_FORM: FormState = { category: "Umum", title: "", answer: "", keywords: [] };

function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useQuery({ queryKey: ["knowledge_base"], queryFn: fetchKnowledge });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"semua" | KbCategory>("semua");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
  const onError = (error: unknown) => toast.error(error instanceof Error ? error.message : "Gagal menyimpan data");

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState & { id: string | null }) => {
      const { id, ...values } = payload;
      if (id) await updateKnowledge(id, values);
      else await createKnowledge(values);
    },
    onSuccess: () => {
      setFormOpen(false);
      toast.success("Pengetahuan tersimpan");
      void refresh();
    },
    onError,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateKnowledge(id, { is_active }),
    onSuccess: () => void refresh(),
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKnowledge(id),
    onSuccess: () => {
      setDeleteId(null);
      toast.success("Pengetahuan dihapus");
      void refresh();
    },
    onError,
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id-ID");
    return entries.filter((entry) => {
      const matchCategory = category === "semua" || entry.category === category;
      const haystack = `${entry.title} ${entry.answer} ${(entry.keywords ?? []).join(" ")}`.toLocaleLowerCase("id-ID");
      return matchCategory && (!needle || haystack.includes(needle));
    });
  }, [entries, search, category]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setKeywordDraft("");
    setFormOpen(true);
  }

  function openEdit(entry: KnowledgeRow) {
    setEditingId(entry.id);
    setForm({ category: entry.category, title: entry.title, answer: entry.answer, keywords: [...(entry.keywords ?? [])] });
    setKeywordDraft("");
    setFormOpen(true);
  }

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value || form.keywords.includes(value)) return;
    setForm((current) => ({ ...current, keywords: [...current.keywords, value] }));
    setKeywordDraft("");
  }

  function submit() {
    if (!form.title.trim()) return;
    saveMutation.mutate({ ...form, id: editingId });
  }

  return (
    <AppShell
      title="Knowledge Base"
      subtitle="Kelola jawaban pengetahuan yang dipakai chatbot untuk menjawab warga"
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" /> Tambah Konten <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="items-start gap-3 py-2.5" onSelect={openCreate}>
              <MessageCircleQuestion className="mt-0.5 size-4" />
              <div>
                <p className="font-medium">FAQ</p>
                <p className="text-xs text-muted-foreground">Pertanyaan &amp; jawaban</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="items-start gap-3 py-2.5" onSelect={() => setUploadOpen(true)}>
              <FileUp className="mt-0.5 size-4" />
              <div>
                <p className="font-medium">Dokumen</p>
                <p className="text-xs text-muted-foreground">Upload PDF / DOCX / TXT</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="items-start gap-3 py-2.5" onSelect={() => setUrlOpen(true)}>
              <LinkIcon className="mt-0.5 size-4" />
              <div>
                <p className="font-medium">Website</p>
                <p className="text-xs text-muted-foreground">Crawl URL</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="rounded-xl border border-border bg-background">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari judul, isi jawaban, atau keyword" className="h-10 bg-muted/45 pl-9" aria-label="Cari pengetahuan" />
          </div>
          <Select value={category} onValueChange={(value) => setCategory(value as "semua" | KbCategory)}>
            <SelectTrigger className="h-10 w-full sm:w-56" aria-label="Filter kategori">
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua kategori</SelectItem>
              {KB_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-32">Kategori</TableHead>
                <TableHead className="min-w-56">Judul</TableHead>
                <TableHead className="min-w-56">Keywords</TableHead>
                <TableHead className="min-w-24">Status Aktif</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Tidak ada pengetahuan yang cocok.</TableCell>
                </TableRow>
              ) : filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell><Badge variant="outline" className="rounded-full text-[10px] font-semibold">{entry.category}</Badge></TableCell>
                  <TableCell>
                    <p className="text-sm font-semibold">{entry.title}</p>
                    <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">{entry.answer}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(entry.keywords ?? []).map((keyword) => (
                        <span key={keyword} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{keyword}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={entry.is_active}
                      aria-label={`Status aktif ${entry.title}`}
                      onCheckedChange={(value) => toggleMutation.mutate({ id: entry.id, is_active: value })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${entry.title}`} onClick={() => openEdit(entry)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Hapus ${entry.title}`} onClick={() => setDeleteId(entry.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-6">
        <KnowledgeDocumentsTable />
      </div>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      <AddUrlDialog open={urlOpen} onOpenChange={setUrlOpen} />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Pengetahuan" : "Tambah Pengetahuan Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kb-category">Kategori</Label>
              <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as KbCategory }))}>
                <SelectTrigger id="kb-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KB_CATEGORIES.map((item) => (<SelectItem key={item} value={item}>{item}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-title">Judul</Label>
              <Input id="kb-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Contoh: Syarat pembuatan Kartu Keluarga" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-answer">Isi Jawaban</Label>
              <Textarea id="kb-answer" rows={5} value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} placeholder="Tulis jawaban yang akan dikirim chatbot" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-keyword">Keywords</Label>
              <div className="flex gap-2">
                <Input
                  id="kb-keyword"
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addKeyword(); } }}
                  placeholder="Tulis keyword lalu Enter"
                />
                <Button type="button" variant="outline" onClick={addKeyword}>Tambah</Button>
              </div>
              {form.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.keywords.map((keyword) => (
                    <span key={keyword} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {keyword}
                      <button type="button" aria-label={`Hapus keyword ${keyword}`} onClick={() => setForm((current) => ({ ...current, keywords: current.keywords.filter((item) => item !== keyword) }))}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>{editingId ? "Simpan Perubahan" : "Simpan Pengetahuan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengetahuan ini?</AlertDialogTitle>
            <AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan dan chatbot tidak lagi memakai jawaban ini.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
