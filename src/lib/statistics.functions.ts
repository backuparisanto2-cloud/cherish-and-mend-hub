import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatsAgent = {
  name: string;
  initials: string;
  chats: number;
  avgResponseSeconds: number | null;
};

export type StatsPayload = {
  todayConversations: number;
  weekConversations: number;
  waitingAgent: number;
  avgResponseSeconds: number | null;
  daily: { day: string; pesan: number }[];
  categories: { name: string; value: number }[];
  agents: StatsAgent[];
};

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function startOfLocalDay(offsetDays = 0): Date {
  const now = new Date();
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

/** Pastikan pemanggil benar-benar berperan Owner. */
async function assertOwner(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Halaman ini khusus akun Owner");
}

/** Ambil seluruh angka statistik layanan dari data asli. */
export const getStatistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatsPayload> => {
    await assertOwner(context);
    const db = context.supabase;
    const todayStart = startOfLocalDay(0).toISOString();
    const weekStart = startOfLocalDay(6).toISOString();

    const [todayRes, weekRes, waitingRes, messagesRes] = await Promise.all([
      db.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      db.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
      db.from("conversations").select("id", { count: "exact", head: true }).eq("status", "waiting_agent"),
      db
        .from("messages")
        .select("conversation_id, direction, sender_type, agent_name, matched_knowledge_category, created_at")
        .gte("created_at", startOfLocalDay(30).toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const messages = messagesRes.data ?? [];

    // Grafik pesan masuk 7 hari terakhir.
    const buckets: { day: string; key: string; pesan: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfLocalDay(i);
      buckets.push({ day: DAY_LABELS[d.getUTCDay()] ?? "", key: d.toISOString().slice(0, 10), pesan: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const m of messages) {
      if (m.direction !== "inbound") continue;
      const key = String(m.created_at).slice(0, 10);
      const bucket = byKey.get(key);
      if (bucket) bucket.pesan += 1;
    }

    // Kategori knowledge base yang berhasil menjawab.
    const categoryCount = new Map<string, number>();
    for (const m of messages) {
      const cat = m.matched_knowledge_category;
      if (!cat) continue;
      categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
    }

    // Waktu respon agent: jeda pesan warga terakhir sebelum balasan agent pertama.
    const lastInbound = new Map<string, number>();
    const agentStats = new Map<string, { chats: number; totalSeconds: number; samples: number }>();
    const answered = new Set<string>();
    const responseSeconds: number[] = [];

    for (const m of messages) {
      const convId = m.conversation_id ?? "";
      const at = new Date(String(m.created_at)).getTime();
      if (m.direction === "inbound") {
        if (!lastInbound.has(convId)) lastInbound.set(convId, at);
        continue;
      }
      if (m.sender_type !== "agent") continue;

      const name = m.agent_name || "Agent";
      const stat = agentStats.get(name) ?? { chats: 0, totalSeconds: 0, samples: 0 };
      const waitedFrom = lastInbound.get(convId);
      let delta: number | null = null;
      if (waitedFrom !== undefined && !answered.has(convId)) {
        delta = Math.max(0, Math.round((at - waitedFrom) / 1000));
        responseSeconds.push(delta);
        answered.add(convId);
      }
      if (delta !== null) {
        stat.totalSeconds += delta;
        stat.samples += 1;
      }
      stat.chats += 1;
      agentStats.set(name, stat);
      lastInbound.delete(convId);
    }

    const agents: StatsAgent[] = Array.from(agentStats.entries())
      .map(([name, s]) => ({
        name,
        initials:
          name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p.charAt(0).toUpperCase())
            .join("") || "A",
        chats: s.chats,
        avgResponseSeconds: s.samples > 0 ? Math.round(s.totalSeconds / s.samples) : null,
      }))
      .sort((a, b) => b.chats - a.chats);

    return {
      todayConversations: todayRes.count ?? 0,
      weekConversations: weekRes.count ?? 0,
      waitingAgent: waitingRes.count ?? 0,
      avgResponseSeconds:
        responseSeconds.length > 0
          ? Math.round(responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length)
          : null,
      daily: buckets.map(({ day, pesan }) => ({ day, pesan })),
      categories: Array.from(categoryCount.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      agents,
    };
  });

export type AdminConversationRow = {
  id: string;
  contactName: string;
  waNumber: string | null;
  status: string;
  agentName: string | null;
  messageCount: number;
  lastMessageAt: string;
};

export type AdminUserRow = {
  id: string;
  name: string;
  waNumber: string | null;
  messages: number;
  lastSeenAt: string | null;
};

export type AdminOverview = {
  conversations: AdminConversationRow[];
  totalUsers: number;
  newUsersThisWeek: number;
  avgMessagesPerUser: number;
  topUsers: AdminUserRow[];
};

/** Daftar percakapan + statistik pengguna untuk halaman admin (Owner saja). */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await assertOwner(context);
    const db = context.supabase;
    const weekStart = startOfLocalDay(6).toISOString();

    const [convRes, contactsRes, msgRes] = await Promise.all([
      db
        .from("conversations")
        .select("id, status, agent_name, last_message_at, contact_id")
        .order("last_message_at", { ascending: false })
        .limit(200),
      db.from("contacts").select("id, name, wa_number, created_at").limit(2000),
      db.from("messages").select("conversation_id, created_at").limit(10000),
    ]);

    const conversationsRaw = convRes.data ?? [];
    const contacts = contactsRes.data ?? [];
    const messages = msgRes.data ?? [];

    const perConversation = new Map<string, number>();
    for (const m of messages) {
      const key = m.conversation_id ?? "";
      if (!key) continue;
      perConversation.set(key, (perConversation.get(key) ?? 0) + 1);
    }

    const contactById = new Map(contacts.map((c) => [c.id, c]));

    const conversations: AdminConversationRow[] = conversationsRaw.map((c) => {
      const contact = c.contact_id ? contactById.get(c.contact_id) : undefined;
      return {
        id: c.id,
        contactName: contact?.name || contact?.wa_number || "Warga",
        waNumber: contact?.wa_number ?? null,
        status: c.status,
        agentName: c.agent_name ?? null,
        messageCount: perConversation.get(c.id) ?? 0,
        lastMessageAt: c.last_message_at,
      };
    });

    // Agregat per warga (kontak) berdasarkan percakapan miliknya.
    const perContactMessages = new Map<string, number>();
    const perContactLast = new Map<string, string>();
    for (const c of conversationsRaw) {
      if (!c.contact_id) continue;
      perContactMessages.set(
        c.contact_id,
        (perContactMessages.get(c.contact_id) ?? 0) + (perConversation.get(c.id) ?? 0),
      );
      const prev = perContactLast.get(c.contact_id);
      if (!prev || String(c.last_message_at) > prev) {
        perContactLast.set(c.contact_id, String(c.last_message_at));
      }
    }

    const totalUsers = contacts.length;
    const newUsersThisWeek = contacts.filter((c) => String(c.created_at) >= weekStart).length;
    const totalMessages = messages.length;

    const topUsers: AdminUserRow[] = contacts
      .map((c) => ({
        id: c.id,
        name: c.name || c.wa_number || "Warga",
        waNumber: c.wa_number ?? null,
        messages: perContactMessages.get(c.id) ?? 0,
        lastSeenAt: perContactLast.get(c.id) ?? null,
      }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 10);

    return {
      conversations,
      totalUsers,
      newUsersThisWeek,
      avgMessagesPerUser: totalUsers > 0 ? Math.round((totalMessages / totalUsers) * 10) / 10 : 0,
      topUsers,
    };
  });

export type AdminMessageRow = {
  id: string;
  waNumber: string | null;
  contactName: string;
  direction: string;
  senderType: string;
  text: string;
  status: string | null;
  createdAt: string;
};

/** Pesan warga terbaru beserta waktu & status pengiriman (Owner saja). */
export const getRecentMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMessageRow[]> => {
    await assertOwner(context);
    const db = context.supabase;

    const { data: messages } = await db
      .from("messages")
      .select("id, conversation_id, direction, sender_type, content, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = messages ?? [];
    if (rows.length === 0) return [];

    const { data: conversations } = await db
      .from("conversations")
      .select("id, contact_id")
      .limit(2000);
    const { data: contacts } = await db.from("contacts").select("id, name, wa_number").limit(2000);

    const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));
    const contactByConversation = new Map(
      (conversations ?? []).map((c) => [c.id, c.contact_id ? contactById.get(c.contact_id) : undefined]),
    );

    return rows.map((m) => {
      const contact = m.conversation_id ? contactByConversation.get(m.conversation_id) : undefined;
      const content = (m.content ?? {}) as { text?: { body?: string } | string };
      const text =
        typeof content.text === "string"
          ? content.text
          : (content.text?.body ?? "(tanpa teks)");
      return {
        id: m.id,
        waNumber: contact?.wa_number ?? null,
        contactName: contact?.name || contact?.wa_number || "Warga",
        direction: m.direction,
        senderType: m.sender_type,
        text,
        status: m.status ?? null,
        createdAt: m.created_at,
      };
    });
  });
