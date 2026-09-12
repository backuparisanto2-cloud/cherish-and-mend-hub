import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  ChevronDown,
  CircleUserRound,
  MessageCircleMore,
  Search,
  Send,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  HeaderUser,
  MobileNav,
  SidebarBrand,
  SidebarNav,
  SidebarStatus,
} from "@/components/app-shell";
import {
  messageText,
  useConversationMessages,
  useConversations,
  useInboxRealtime,
  useMessagePreviews,
  type ConversationRow,
  type ConversationStatusDb,
} from "@/lib/inbox-data";

import { sendWhatsappText } from "@/lib/chatera-send.functions";
import { setConversationStatus } from "@/lib/conversations.functions";



export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Inbox WhatsApp | Purworejo chatbot Apps" },
      {
        name: "description",
        content: "Kelola percakapan WhatsApp warga dan layanan chatbot Kabupaten Purworejo dalam satu inbox.",
      },
      { property: "og:title", content: "Inbox WhatsApp | Purworejo chatbot Apps" },
      {
        property: "og:description",
        content: "Inbox layanan WhatsApp resmi Kabupaten Purworejo untuk bot dan petugas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: Inbox,
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-8 text-sm text-muted-foreground">
      Data pesan gagal dimuat.
    </div>
  ),
});


type ConversationStatus = "Bot Aktif" | "Menunggu Agent" | "Agent Aktif" | "Selesai";
type MessageKind = "citizen" | "bot" | "agent";

type ChatMessage = {
  id: string;
  text: string;
  timestamp: string;
  kind: MessageKind;
  label?: string;
};

type Thread = {
  id: string;
  phone: string;
  name: string;
  conversationId: string | null;
  channelId: string | null;
  lastText: string;
  lastTimestamp: string;
  status: ConversationStatus;
};

const STATUS_STYLES: Record<ConversationStatus, string> = {
  "Bot Aktif": "border-status-bot/25 bg-status-bot-soft text-status-bot",
  "Menunggu Agent": "border-status-waiting/30 bg-status-waiting-soft text-status-waiting-foreground",
  "Agent Aktif": "border-status-agent/25 bg-status-agent-soft text-status-agent",
  Selesai: "border-status-done/25 bg-status-done-soft text-status-done",
};

const STATUS_LABELS: Record<ConversationStatusDb, ConversationStatus> = {
  bot_active: "Bot Aktif",
  waiting_agent: "Menunggu Agent",
  agent_active: "Agent Aktif",
  closed: "Selesai",
};

const FILTERS = ["Semua", "Menunggu Agent", "Agent Aktif", "Bot Aktif", "Selesai"] as const;
type Filter = (typeof FILTERS)[number];

function toThread(
  row: ConversationRow,
  preview: { text: string; created_at: string } | undefined,
): Thread {
  const phone = row.contacts?.wa_number ?? "tanpa-nomor";
  return {
    id: row.id,
    phone,
    name: row.contacts?.name ?? phone,
    conversationId: row.chatera_conversation_id,
    channelId: row.contacts?.channel_id ?? null,
    lastText: preview?.text ?? "—",
    lastTimestamp: preview?.created_at ?? row.last_message_at,
    status: STATUS_LABELS[row.status] ?? "Bot Aktif",
  };
}


function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(date);
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <Badge variant="outline" className={cn("h-5 whitespace-nowrap rounded-full px-2 text-[10px] font-semibold", STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

function Inbox() {
  const queryClient = useQueryClient();
  const send = useServerFn(sendWhatsappText);
  const changeStatus = useServerFn(setConversationStatus);
  useInboxRealtime();
  const conversationsQuery = useConversations();
  const previewsQuery = useMessagePreviews();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("Semua");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(true);

  const previews = previewsQuery.data ?? {};
  const threads = useMemo(
    () =>
      (conversationsQuery.data ?? [])
        .map((row) => toThread(row, previews[row.id]))
        .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()),
    [conversationsQuery.data, previews],
  );

  const filteredThreads = threads.filter((thread) => {
    const matchesFilter = filter === "Semua" || thread.status === filter;
    const needle = search.trim().toLocaleLowerCase("id-ID");
    const matchesSearch = !needle || `${thread.name} ${thread.phone} ${thread.lastText}`.toLocaleLowerCase("id-ID").includes(needle);
    return matchesFilter && matchesSearch;
  });
  const active = threads.find((thread) => thread.id === activeId) ?? filteredThreads[0] ?? threads[0] ?? null;
  const messagesQuery = useConversationMessages(active?.id ?? null);
  const chatMessages: ChatMessage[] = (messagesQuery.data ?? []).map((row) => ({
    id: row.id,
    text: messageText(row.content, row.content_type),
    timestamp: row.created_at,
    kind: row.sender_type === "user" ? "citizen" : row.sender_type,
    ...(row.sender_type === "bot"
      ? { label: "Bot Purworejo" }
      : row.sender_type === "agent"
        ? { label: "Agent" }
        : {}),
  }));
  const loadError = conversationsQuery.error ?? messagesQuery.error ?? null;

  async function handleStatusChange(action: "take_over" | "return_to_bot") {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      await changeStatus({ data: { conversationId: active.id, action } });
      await queryClient.invalidateQueries({ queryKey: ["inbox", "conversations"] });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status percakapan gagal diubah.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(message: { text: string }) {
    const text = message.text.trim();
    if (!active || !text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await send({
        data: {
          to: active.phone,
          text,
          conversationId: active.conversationId,
          channelId: active.channelId,
        },
      });
      if (!result.ok) throw new Error(result.error ?? `Pengiriman gagal (status ${result.status})`);
      await queryClient.invalidateQueries({ queryKey: ["inbox"] });
      setDraft("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Pesan gagal dikirim.");
      throw sendError;
    } finally {
      setBusy(false);
    }
  }


  const inboxBadge = (
    <span className="rounded-full bg-sidebar-primary-foreground/15 px-1.5 text-[10px]">{threads.length}</span>
  );

  return (
    <main className="flex h-dvh min-h-[700px] overflow-hidden bg-app-canvas text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarBrand />
        <SidebarNav badges={{ Inbox: inboxBadge }} />
        <SidebarStatus />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid h-[76px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <MobileNav badges={{ Inbox: inboxBadge }} />
            <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMobileListOpen((value) => !value)} aria-label="Buka daftar percakapan">
              <MessageCircleMore />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold sm:text-xl">Inbox Percakapan</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">Kelola pesan warga, bot, dan petugas dalam satu tempat</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <HeaderUser />
          </div>
        </header>


        {loadError ? <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">Gagal memuat sebagian data: {loadError.message}</div> : null}

        <div id="inbox" className="flex min-h-0 flex-1 gap-4 overflow-hidden p-0 md:p-4">
          <section className={cn("w-full shrink-0 overflow-hidden border-border bg-background md:w-[360px] md:rounded-md md:border md:border-t-[3px] md:border-t-primary md:shadow-sm xl:w-[390px]", !mobileListOpen && "hidden md:block")} aria-label="Daftar percakapan">
            <div className="flex h-12 items-center justify-between border-b border-border px-4">
              <div className="flex min-w-0 items-center gap-2">
                <MessageCircleMore className="size-4 text-primary" />
                <h2 className="truncate text-sm font-bold">Daftar Percakapan</h2>
              </div>
              <Badge variant="secondary" className="rounded-sm px-2 text-[10px] font-bold">
                {filteredThreads.length} pesan
              </Badge>
            </div>
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau nomor WhatsApp" className="h-10 bg-muted/45 pl-9" aria-label="Cari percakapan" />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Filter status">
                {FILTERS.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={filter === item ? "default" : "outline"}
                    className="h-7 shrink-0 rounded-full px-3 text-[10px] shadow-none"
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex h-[calc(100%-161px)] flex-col overflow-y-auto">
              {filteredThreads.length === 0 ? (
                <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">Tidak ada percakapan yang cocok.</div>
              ) : filteredThreads.map((thread) => {
                const selected = active?.id === thread.id;
                const waiting = thread.status === "Menunggu Agent";
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => { setActiveId(thread.id); setMobileListOpen(false); }}
                    className={cn(
                      "relative grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border px-4 py-3.5 text-left transition-colors",
                      selected ? "border-l-[3px] border-l-primary bg-conversation-selected" : "hover:bg-muted/45",
                      waiting && !selected && "border-l-[3px] border-l-status-waiting bg-status-waiting-soft/30",
                    )}
                  >
                    <Avatar className="mt-0.5 size-10 shrink-0 border border-border">
                      <AvatarFallback className="bg-avatar text-xs font-bold text-avatar-foreground">{initials(thread.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <span className="truncate text-sm font-semibold">{thread.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatClock(thread.lastTimestamp)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{thread.phone}</span>
                      <span className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <span className="truncate text-xs text-muted-foreground">{thread.lastText}</span>
                        <StatusBadge status={thread.status} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {active ? (
            <section className={cn("min-w-0 flex-1 flex-col overflow-hidden bg-chat-canvas md:rounded-md md:border md:border-t-[3px] md:border-border md:border-t-primary md:shadow-sm", mobileListOpen ? "hidden md:flex" : "flex")} aria-label={`Percakapan dengan ${active.name}`}>
              <div className="grid min-h-[72px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMobileListOpen(true)} aria-label="Kembali ke daftar percakapan">
                    <ChevronDown className="rotate-90" />
                  </Button>
                  <Avatar className="size-10 shrink-0 border border-border">
                    <AvatarFallback className="bg-avatar text-xs font-bold text-avatar-foreground">{initials(active.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-bold sm:text-base">{active.name}</h2>
                      <StatusBadge status={active.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">WhatsApp • {active.phone}</p>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-2 xl:flex">
                  {active.status !== "Agent Aktif" ? (
                    <Button variant="outline" size="sm" className="gap-2" disabled={busy} onClick={() => void handleStatusChange("take_over")}><UserRoundCheck className="size-3.5" /> Ambil Alih dari Bot</Button>
                  ) : (
                    <Button variant="secondary" size="sm" className="gap-2" disabled={busy} onClick={() => void handleStatusChange("return_to_bot")}><Bot className="size-3.5" /> Kembalikan ke Bot</Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 xl:hidden"
                  aria-label={active.status !== "Agent Aktif" ? "Ambil alih dari bot" : "Kembalikan ke bot"}
                  disabled={busy}
                  onClick={() => void handleStatusChange(active.status !== "Agent Aktif" ? "take_over" : "return_to_bot")}
                >
                  <CircleUserRound />
                </Button>
              </div>

              <Conversation className="min-h-0">
                <ConversationContent className="mx-auto w-full max-w-4xl gap-4 px-4 py-6 sm:px-8">
                  <div className="mx-auto rounded-full border border-border bg-background px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">Hari ini</div>
                  {chatMessages.map((message) => {
                    const outbound = message.kind !== "citizen";
                    return (
                      <Message key={message.id} from={outbound ? "user" : "assistant"} className={cn("max-w-[82%] gap-1 sm:max-w-[72%]", !outbound && "mr-auto")}>
                        {message.label ? <span className={cn("px-1 text-[10px] font-semibold", message.kind === "agent" ? "text-status-agent" : "text-status-bot")}>{message.label}</span> : null}
                        <MessageContent className={cn(
                          "rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                          message.kind === "citizen" && "border-border bg-message-citizen text-message-citizen-foreground",
                          message.kind === "bot" && "border-message-bot bg-message-bot text-message-bot-foreground",
                          message.kind === "agent" && "border-message-agent bg-message-agent text-message-agent-foreground",
                        )}>
                          <p className="whitespace-pre-wrap break-words">
                            <Linkify text={message.text} />
                          </p>
                          <span className={cn("self-end text-[9px]", message.kind === "citizen" ? "text-muted-foreground" : "opacity-75")}>{formatClock(message.timestamp)}</span>
                        </MessageContent>
                      </Message>
                    );
                  })}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              <div className="shrink-0 border-t border-border bg-background p-3 sm:px-5 sm:py-4">
                {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
                <PromptInput onSubmit={handleSend} className="mx-auto max-w-4xl">
                  <PromptInputTextarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Balas pesan..."
                    className="min-h-14 py-3"
                    aria-label="Balas pesan"
                  />
                  <PromptInputFooter className="justify-between border-t border-border/60 pt-2">
                    <span className="text-[10px] text-muted-foreground">Enter untuk kirim • Shift + Enter untuk baris baru</span>
                    <PromptInputSubmit {...(busy ? { status: "submitted" as const } : {})} disabled={busy || !draft.trim()} aria-label="Kirim pesan">
                      {busy ? null : <Send className="size-4" />}
                    </PromptInputSubmit>
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </section>
          ) : (
            <div className="hidden flex-1 place-items-center rounded-md border border-border bg-background text-sm text-muted-foreground shadow-sm md:grid">
              <div className="text-center"><MessageCircleMore className="mx-auto mb-3 size-8" />Pilih percakapan untuk mulai.</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
