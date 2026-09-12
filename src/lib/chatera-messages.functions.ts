import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type InboundMessage = {
  id: string;
  delivery_id: string;
  direction: string;
  message_id: string | null;
  conversation_id: string | null;
  channel_id: string | null;
  sender_phone: string | null;
  sender_name: string | null;
  content_text: string | null;
  event_timestamp: string | null;
  received_at: string;
};

export const listInboundMessages = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await supabasePublic
    .from("chatera_messages")
    .select(
      "id, delivery_id, direction, message_id, conversation_id, channel_id, sender_phone, sender_name, content_text, event_timestamp, received_at",
    )
    .order("received_at", { ascending: false })
    .limit(500);

  if (error) return { messages: [] as InboundMessage[], error: error.message };
  return { messages: (data ?? []) as InboundMessage[], error: null as string | null };
});
