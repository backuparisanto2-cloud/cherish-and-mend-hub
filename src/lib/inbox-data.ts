import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConversationStatusDb = "bot_active" | "waiting_agent" | "agent_active" | "closed";

export type ConversationRow = {
  id: string;
  chatera_conversation_id: string | null;
  status: ConversationStatusDb;
  assigned_agent_chatera_id: string | null;
  last_message_at: string;
  contacts: { wa_number: string | null; name: string | null; channel_id: string | null } | null;
};

export type MessageRow = {
  id: string;
  direction: string;
  sender_type: "user" | "bot" | "agent";
  content_type: string;
  content: unknown;
  status: string | null;
  created_at: string;
};

/** Ambil teks dari kolom content jsonb apa pun bentuknya. */
export function messageText(content: unknown, contentType: string): string {
  const c = (content ?? {}) as Record<string, unknown>;
  const text = c["text"];
  if (typeof text === "string") return text;
  if (text && typeof text === "object") {
    const body = (text as Record<string, unknown>)["body"];
    if (typeof body === "string") return body;
  }
  const media = (c["image"] ?? c["audio"] ?? c["video"] ?? c["document"]) as
    | Record<string, unknown>
    | undefined;
  if (media) {
    const caption = media["caption"];
    if (typeof caption === "string" && caption) return caption;
    return `[${contentType}]`;
  }
  return contentType === "text" ? "—" : `[${contentType}]`;
}

export function useConversations() {
  return useQuery({
    queryKey: ["inbox", "conversations"],
    queryFn: async (): Promise<ConversationRow[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, chatera_conversation_id, status, assigned_agent_chatera_id, last_message_at, contacts(wa_number, name, channel_id)",
        )
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ConversationRow[];
    },
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["inbox", "messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, direction, sender_type, content_type, content, status, created_at")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as MessageRow[];
    },
  });
}

/** Realtime: perbarui daftar percakapan dan isi chat tanpa refresh manual. */
export function useInboxRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["inbox", "messages"] });
        void queryClient.invalidateQueries({ queryKey: ["inbox", "previews"] });
        void queryClient.invalidateQueries({ queryKey: ["inbox", "conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["inbox", "conversations"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** Cuplikan pesan terakhir per percakapan untuk daftar inbox. */
export function useMessagePreviews() {
  return useQuery({
    queryKey: ["inbox", "previews"],
    queryFn: async (): Promise<Record<string, { text: string; created_at: string }>> => {
      const { data, error } = await supabase
        .from("messages")
        .select("conversation_id, content, content_type, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      const map: Record<string, { text: string; created_at: string }> = {};
      for (const row of data ?? []) {
        const key = row.conversation_id;
        if (!key || map[key]) continue;
        map[key] = {
          text: messageText(row.content, row.content_type),
          created_at: row.created_at,
        };
      }
      return map;
    },
  });
}
