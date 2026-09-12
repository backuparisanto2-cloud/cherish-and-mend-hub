import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CheckCircle2, FileText, Link as LinkIcon, Loader2, Trash2, Upload, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KB_CATEGORIES, type KbCategory } from "@/lib/knowledge-base";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_EXTENSIONS,
  deleteKnowledgeDocument,
  fetchKnowledgeDocuments,
  getExtension,
  uploadKnowledgeDocument,
  type KnowledgeDocument,
} from "@/lib/knowledge-documents";
import { processKnowledgeDocument } from "@/lib/knowledge-documents.functions";
import { ingestKnowledgeUrl } from "@/lib/knowledge-url.functions";
import { cn } from "@/lib/utils";

const DOCS_KEY = ["knowledge_documents"];
const KB_KEY = ["knowledge_base"];

export function UploadDocumentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const process = useServerFn(processKnowledgeDocument);
  const [category, setCategory] = useState<KbCategory>("Umum");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: DOCS_KEY });
    void queryClient.invalidateQueries({ queryKey: KB_KEY });
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: KbCategory }) => {
      const documentId = await uploadKnowledgeDocument(file, category);
      onOpenChange(false);
      setFile(null);
      toast.info("Dokumen terunggah, sedang diproses…");
      refreshAll();
      return process({ data: { documentId } });
    },
    onSuccess: (result) => {
      if (result.ok) toast.success(`Dokumen selesai diproses: ${result.entriesCreated} entri dibuat (nonaktif, silakan review).`);
      else toast.error(`Gagal memproses dokumen: ${result.error}`);
      refreshAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal mengunggah dokumen"),
  });

  function pick(candidate: File | null | undefined) {
    if (!candidate) return;
    if (!(DOCUMENT_EXTENSIONS as readonly string[]).includes(getExtension(candidate.name))) {
      toast.error("Tipe file tidak didukung. Gunakan PDF, Word, Excel, atau PowerPoint.");
      return;
    }
    setFile(candidate);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!uploadMutation.isPending) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Dokumen</DialogTitle>
          <DialogDescription>
            Isi dokumen akan dipecah otomatis menjadi beberapa entri pengetahuan berstatus nonaktif untuk Anda review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-category">Kategori tujuan</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as KbCategory)}>
              <SelectTrigger id="doc-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KB_CATEGORIES.map((item) => (<SelectItem key={item} value={item}>{item}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File dokumen</Label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files?.[0]); }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm transition-colors hover:bg-muted/70",
                dragging && "border-primary bg-primary/5",
              )}
            >
              {file ? (
                <>
                  <FileText className="size-6 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · klik untuk ganti</span>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="font-medium">Tarik file ke sini atau klik untuk pilih</span>
                  <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX · maks. 20 MB</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="hidden"
              aria-label="Pilih file dokumen"
              onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploadMutation.isPending}>Batal</Button>
          <Button
            onClick={() => { if (file) uploadMutation.mutate({ file, category }); }}
            disabled={!file || uploadMutation.isPending}
            className="gap-2"
          >
            {uploadMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Unggah & Proses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddUrlDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const ingest = useServerFn(ingestKnowledgeUrl);
  const [category, setCategory] = useState<KbCategory>("Umum");
  const [url, setUrl] = useState("");

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: DOCS_KEY });
    void queryClient.invalidateQueries({ queryKey: KB_KEY });
  };

  const mutation = useMutation({
    mutationFn: () => ingest({ data: { url: url.trim(), category } }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Halaman selesai diproses: ${result.entriesCreated} entri dibuat (nonaktif, silakan review).`);
        setUrl("");
        onOpenChange(false);
      } else {
        toast.error(`Gagal memproses halaman: ${result.error}`);
      }
      refreshAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal memproses halaman"),
  });

  const valid = /^https?:\/\/\S+\.\S+/i.test(url.trim());

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah dari URL</DialogTitle>
          <DialogDescription>
            Isi halaman web akan diambil dan dipecah otomatis menjadi beberapa entri pengetahuan berstatus nonaktif untuk Anda review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url-category">Kategori tujuan</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as KbCategory)}>
              <SelectTrigger id="url-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KB_CATEGORIES.map((item) => (<SelectItem key={item} value={item}>{item}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="url-input">Alamat halaman (URL)</Label>
            <Input
              id="url-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://purworejokab.go.id/halaman-informasi"
              inputMode="url"
            />
            {url.trim() && !valid ? (
              <p className="text-xs text-destructive">Masukkan URL lengkap yang dimulai dengan http:// atau https://</p>
            ) : (
              <p className="text-xs text-muted-foreground">Halaman harus bisa dibuka publik tanpa login, maksimal 2 MB.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Batal</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending} className="gap-2">
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
            Ambil & Proses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ doc }: { doc: KnowledgeDocument }) {
  if (doc.status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1 rounded-full text-[10px] font-semibold">
        <Loader2 className="size-3 animate-spin" /> Memproses
      </Badge>
    );
  }
  if (doc.status === "done") {
    return (
      <Badge variant="outline" className="gap-1 rounded-full border-primary/40 text-[10px] font-semibold text-primary">
        <CheckCircle2 className="size-3" /> Berhasil · {doc.entries_created} entri dibuat
      </Badge>
    );
  }
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Badge variant="destructive" className="gap-1 rounded-full text-[10px] font-semibold">
        <XCircle className="size-3" /> Gagal
      </Badge>
      {doc.error_message ? <span className="max-w-xs text-[11px] text-muted-foreground">{doc.error_message}</span> : null}
    </span>
  );
}

export function KnowledgeDocumentsTable() {
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: DOCS_KEY,
    queryFn: fetchKnowledgeDocuments,
    refetchInterval: (query) => (query.state.data?.some((doc) => doc.status === "processing") ? 3000 : false),
  });
  const [deleting, setDeleting] = useState<KnowledgeDocument | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (doc: KnowledgeDocument) => deleteKnowledgeDocument(doc),
    onSuccess: () => {
      setDeleting(null);
      toast.success("Dokumen dan entri turunannya dihapus");
      void queryClient.invalidateQueries({ queryKey: DOCS_KEY });
      void queryClient.invalidateQueries({ queryKey: KB_KEY });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menghapus dokumen"),
  });

  return (
    <section className="rounded-xl border border-border bg-background">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">Dokumen Terunggah</h2>
        <p className="text-xs text-muted-foreground">Entri hasil ekstraksi tersimpan nonaktif; periksa dan aktifkan di tabel Knowledge Base di atas.</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Nama File</TableHead>
              <TableHead className="min-w-32">Kategori</TableHead>
              <TableHead className="min-w-48">Status</TableHead>
              <TableHead className="min-w-36">Tanggal Upload</TableHead>
              <TableHead className="w-16 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell>
              </TableRow>
            ) : docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Belum ada dokumen yang diunggah.</TableCell>
              </TableRow>
            ) : docs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.file_name}</p>
                      <p className="text-[11px] uppercase text-muted-foreground">{doc.file_type}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="rounded-full text-[10px] font-semibold">{doc.category}</Badge></TableCell>
                <TableCell><StatusBadge doc={doc} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(doc.created_at), "d MMM yyyy, HH:mm", { locale: localeId })}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" aria-label={`Hapus dokumen ${doc.file_name}`} onClick={() => setDeleting(doc)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen ini?</AlertDialogTitle>
            <AlertDialogDescription>
              File "{deleting?.file_name}" beserta {deleting?.entries_created ?? 0} entri pengetahuan yang dihasilkan darinya akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); if (deleting) deleteMutation.mutate(deleting); }}
              disabled={deleteMutation.isPending}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
