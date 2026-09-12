import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, GripVertical, Pencil } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DUMMY_BOT_MENUS, KB_CATEGORIES, type BotMenu, type KbCategory } from "@/lib/dummy-knowledge";

export const Route = createFileRoute("/_authenticated/menu-bot")({
  head: () => ({
    meta: [
      { title: "Menu Bot WhatsApp | Purworejo chatbot Apps" },
      { name: "description", content: "Atur urutan, label, ikon, dan pesan template tujuh menu utama chatbot WhatsApp Kabupaten Purworejo." },
      { property: "og:title", content: "Menu Bot WhatsApp | Purworejo chatbot Apps" },
      { property: "og:description", content: "Konfigurasi menu utama chatbot layanan publik Kabupaten Purworejo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenuBotPage,
});

function MenuBotPage() {
  const [menus, setMenus] = useState<BotMenu[]>(DUMMY_BOT_MENUS);
  const [editing, setEditing] = useState<BotMenu | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    setMenus((current) => {
      const next = [...current];
      const from = next.findIndex((menu) => menu.id === fromId);
      const to = next.findIndex((menu) => menu.id === toId);
      if (from < 0 || to < 0) return current;
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to, 0, moved);
      return next.map((menu, index) => ({ ...menu, order: index + 1 }));
    });
  }

  function move(id: string, delta: number) {
    setMenus((current) => {
      const index = current.findIndex((menu) => menu.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(target, 0, moved);
      return next.map((menu, position) => ({ ...menu, order: position + 1 }));
    });
  }

  function saveEditing() {
    if (!editing) return;
    setMenus((current) => current.map((menu) => (menu.id === editing.id ? editing : menu)));
    setEditing(null);
  }

  return (
    <AppShell title="Menu Bot" subtitle="Susun urutan dan isi tujuh menu utama yang dikirim chatbot ke warga">
      <div className="space-y-3">
        {menus.map((menu, index) => (
          <article
            key={menu.id}
            draggable
            onDragStart={() => setDragId(menu.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => { if (dragId) reorder(dragId, menu.id); setDragId(null); }}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-background p-4 sm:gap-4"
          >
            <div className="flex flex-col items-center gap-2">
              <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden />
              <span className="grid size-8 place-items-center rounded-full bg-muted text-sm font-bold">{menu.order}</span>
              <div className="flex flex-col">
                <Button variant="ghost" size="icon" className="size-7" aria-label={`Naikkan ${menu.label}`} disabled={index === 0} onClick={() => move(menu.id, -1)}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" aria-label={`Turunkan ${menu.label}`} disabled={index === menus.length - 1} onClick={() => move(menu.id, 1)}>
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl" aria-hidden>{menu.emoji}</span>
                <h2 className="text-sm font-bold sm:text-base">{menu.label}</h2>
                <Badge variant="outline" className="rounded-full text-[10px] font-semibold">{menu.category}</Badge>
                <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => setEditing(menu)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Terkait knowledge base: {menu.category}</p>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-sans text-xs text-muted-foreground">{menu.template}</pre>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Menu {editing?.order}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="menu-emoji">Icon</Label>
                  <Input id="menu-emoji" value={editing.emoji} onChange={(event) => setEditing({ ...editing, emoji: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu-label">Label Menu</Label>
                  <Input id="menu-label" value={editing.label} onChange={(event) => setEditing({ ...editing, label: event.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-category">Kategori Knowledge Base</Label>
                <Select value={editing.category} onValueChange={(value) => setEditing({ ...editing, category: value as KbCategory })}>
                  <SelectTrigger id="menu-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KB_CATEGORIES.map((item) => (<SelectItem key={item} value={item}>{item}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-template">Pesan Template</Label>
                <Textarea id="menu-template" rows={8} value={editing.template} onChange={(event) => setEditing({ ...editing, template: event.target.value })} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button onClick={saveEditing}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
