import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PURWOREJO_CONTENT } from "@/lib/purworejo-content";
import { ROOT_PATH, type BotMenuRow } from "@/lib/bot-menu-tree";

const COLUMNS = "id, parent_id, key, path, emoji, label, body, category, sort_order, is_active";

/** Ambil label ringkas dari baris pertama naskah. */
function labelFromBody(body: string, path: string): string {
  const firstLine = body.split("\n").find((line) => line.trim().length > 0) ?? path;
  let label = firstLine
    .replace(/\*/g, "")
    .replace(/^Kategori\s*/i, "")
    .replace(/\[[\d.]+\]\s*:?/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
  if (label.length > 80) label = `${label.slice(0, 77)}...`;
  return label || path;
}

function emojiFromBody(body: string): string {
  const firstLine = body.split("\n").find((line) => line.trim().length > 0) ?? "";
  const match = firstLine.trim().match(/^(\p{Extended_Pictographic}\uFE0F?)/u);
  return match?.[1] ?? "";
}

export const listBotMenus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bot_menus")
      .select(COLUMNS)
      .order("path", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as BotMenuRow[];
  });

/** Impor seluruh naskah resmi ke database (hanya bila tabel masih kosong). */
export const importOfficialMenus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error: countError } = await context.supabase
      .from("bot_menus")
      .select("id", { count: "exact", head: true });
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) return { imported: 0 };

    const paths = Object.keys(PURWOREJO_CONTENT)
      .filter((path) => path !== ROOT_PATH)
      .sort((a, b) => a.split(".").length - b.split(".").length || a.localeCompare(b, "en", { numeric: true }));

    const rootBody = PURWOREJO_CONTENT[ROOT_PATH] ?? "";
    const { data: rootRow, error: rootError } = await context.supabase
      .from("bot_menus")
      .insert({
        parent_id: null,
        key: ROOT_PATH,
        path: ROOT_PATH,
        emoji: "🏛️",
        label: "Menu Awal (Sapaan Pembuka)",
        body: rootBody,
        sort_order: 0,
      })
      .select("id")
      .single();
    if (rootError) throw new Error(rootError.message);

    const idByPath = new Map<string, string>([[ROOT_PATH, rootRow.id]]);
    let imported = 1;

    for (const path of paths) {
      const body = PURWOREJO_CONTENT[path] ?? "";
      const parts = path.split(".");
      const key = parts[parts.length - 1] ?? path;
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join(".") : null;
      const parentId = parentPath ? (idByPath.get(parentPath) ?? null) : null;
      const { data: row, error } = await context.supabase
        .from("bot_menus")
        .insert({
          parent_id: parentId,
          key,
          path,
          emoji: emojiFromBody(body),
          label: labelFromBody(body, path),
          body,
          sort_order: Number(key) || 0,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      idByPath.set(path, row.id);
      imported += 1;
    }

    return { imported };
  });

type SaveInput = {
  id?: string | null;
  parentId?: string | null;
  key: string;
  emoji: string;
  label: string;
  body: string;
  category: string;
  isActive: boolean;
};

export const saveBotMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveInput) => {
    const key = (input.key ?? "").trim();
    if (!/^[A-Za-z0-9-]+$/.test(key)) {
      throw new Error("Nomor menu hanya boleh angka/huruf tanpa titik.");
    }
    if (!(input.label ?? "").trim()) throw new Error("Label menu wajib diisi.");
    return { ...input, key, label: input.label.trim() };
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: allRows, error: listError } = await supabase.from("bot_menus").select(COLUMNS);
    if (listError) throw new Error(listError.message);
    const rows = (allRows ?? []) as BotMenuRow[];

    const parentRow = data.parentId ? rows.find((row) => row.id === data.parentId) : null;
    const parentPath = parentRow && parentRow.path !== ROOT_PATH ? parentRow.path : null;
    const newPath = parentPath ? `${parentPath}.${data.key}` : data.key;

    const clash = rows.find((row) => row.path === newPath && row.id !== data.id);
    if (clash) throw new Error(`Nomor menu ${newPath} sudah dipakai.`);

    const payload = {
      emoji: data.emoji,
      label: data.label,
      body: data.body,
      category: data.category,
      is_active: data.isActive,
      key: data.key,
      path: newPath,
    };

    if (!data.id) {
      const siblings = rows.filter((row) =>
        parentRow ? row.parent_id === parentRow.id : row.parent_id === null && row.path !== ROOT_PATH,
      );
      const sortOrder = siblings.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
      const { error } = await supabase
        .from("bot_menus")
        .insert({ ...payload, parent_id: parentRow?.id ?? null, sort_order: sortOrder });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const current = rows.find((row) => row.id === data.id);
    if (!current) throw new Error("Menu tidak ditemukan.");

    if (current.path === ROOT_PATH) {
      const { error } = await supabase
        .from("bot_menus")
        .update({ emoji: data.emoji, label: data.label, body: data.body })
        .eq("id", current.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error } = await supabase.from("bot_menus").update(payload).eq("id", current.id);
    if (error) throw new Error(error.message);

    // Perbarui path seluruh turunan bila nomor menu berubah.
    if (current.path !== newPath) {
      const prefix = `${current.path}.`;
      for (const row of rows) {
        if (!row.path.startsWith(prefix)) continue;
        const updated = `${newPath}.${row.path.slice(prefix.length)}`;
        const { error: childError } = await supabase
          .from("bot_menus")
          .update({ path: updated })
          .eq("id", row.id);
        if (childError) throw new Error(childError.message);
      }
    }

    return { ok: true };
  });

export const deleteBotMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error: findError } = await context.supabase
      .from("bot_menus")
      .select("path")
      .eq("id", data.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (row?.path === ROOT_PATH) throw new Error("Menu awal tidak bisa dihapus.");

    const { error } = await context.supabase.from("bot_menus").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveBotMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; delta: number }) => input)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: allRows, error } = await supabase.from("bot_menus").select(COLUMNS);
    if (error) throw new Error(error.message);
    const rows = (allRows ?? []) as BotMenuRow[];
    const current = rows.find((row) => row.id === data.id);
    if (!current) throw new Error("Menu tidak ditemukan.");

    const siblings = rows
      .filter((row) => row.parent_id === current.parent_id && row.path !== ROOT_PATH)
      .sort((a, b) => a.sort_order - b.sort_order || a.path.localeCompare(b.path));
    const index = siblings.findIndex((row) => row.id === current.id);
    const target = index + data.delta;
    if (index < 0 || target < 0 || target >= siblings.length) return { ok: true };

    const other = siblings[target]!;
    const { error: e1 } = await supabase
      .from("bot_menus")
      .update({ sort_order: other.sort_order })
      .eq("id", current.id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase
      .from("bot_menus")
      .update({ sort_order: current.sort_order })
      .eq("id", other.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });
