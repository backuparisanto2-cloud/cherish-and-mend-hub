// Helper murni (browser & server) untuk menu chatbot bertingkat dari tabel bot_menus.

export const ROOT_PATH = "utama";

export type BotMenuRow = {
  id: string;
  parent_id: string | null;
  key: string;
  path: string;
  emoji: string;
  label: string;
  body: string;
  category: string;
  sort_order: number;
  is_active: boolean;
};

export type BotMenuNode = BotMenuRow & { children: BotMenuNode[] };

export type BotMenuTree = {
  root: BotMenuNode | null;
  topLevel: BotMenuNode[];
  byPath: Map<string, BotMenuNode>;
};

/** Susun daftar baris datar menjadi pohon menu. */
export function buildMenuTree(rows: BotMenuRow[]): BotMenuTree {
  const byId = new Map<string, BotMenuNode>();
  const byPath = new Map<string, BotMenuNode>();
  for (const row of rows) {
    const node: BotMenuNode = { ...row, children: [] };
    byId.set(row.id, node);
    byPath.set(row.path, node);
  }
  const topLevel: BotMenuNode[] = [];
  let root: BotMenuNode | null = null;
  for (const node of byId.values()) {
    if (node.path === ROOT_PATH) {
      root = node;
      continue;
    }
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else topLevel.push(node);
  }
  const sortRec = (list: BotMenuNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.path.localeCompare(b.path));
    list.forEach((child) => sortRec(child.children));
  };
  sortRec(topLevel);
  return { root, topLevel, byPath };
}

const BACK_HOME = "🏠 Ketik *0* untuk kembali ke Menu Utama";
const HELP_HINT = "❓ Ketik *8* atau *Bantuan* jika Anda bingung";

/** Teks balasan untuk satu node: pakai body, atau susun otomatis dari submenu. */
export function renderMenu(node: BotMenuNode): string {
  if (node.body.trim()) return node.body;

  const heading = `${node.emoji ? `${node.emoji} ` : ""}*${node.label}*`.trim();
  const active = node.children.filter((child) => child.is_active);
  const lines: string[] = [heading];

  if (active.length > 0) {
    lines.push("", "Silakan pilih dengan membalas angka berikut:");
    for (const child of active) {
      lines.push(`${child.emoji ? `${child.emoji} ` : ""}[${child.path}] ${child.label}`.trim());
    }
  }

  const parentPath = parentOf(node.path);
  lines.push("");
  if (parentPath && parentPath !== ROOT_PATH) {
    lines.push(`🔙 Ketik *${parentPath}* untuk kembali ke menu sebelumnya`);
  }
  lines.push(HELP_HINT, BACK_HOME);
  return lines.join("\n");
}

export function parentOf(path: string): string | null {
  const parts = path.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

const GREETINGS = new Set([
  "halo",
  "hallo",
  "hai",
  "hi",
  "assalamualaikum",
]);

const HELP_COMMANDS = new Set(["8", "help", "bantuan", "tolong"]);
const RESET_COMMANDS = new Set(["0", "menu", "mulai", "mulai ulang", "start", "start over", "restart"]);

/** Normalisasi input warga menjadi kunci menu, mis. "3 . 10 . 1" -> "3.10.1". */
export function toMenuKey(text: string): string {
  return text
    .trim()
    .replace(/[)\]]/g, "")
    .replace(/[^\d.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export const UNKNOWN_PREFIX =
  "Maaf, pilihan tidak dikenali. Silakan pilih salah satu menu berikut.\n\n";

function mainMenu(tree: BotMenuTree): string | null {
  const root = tree.root;
  if (!root) return null;
  if (root.body.trim()) return root.body;
  const virtual: BotMenuNode = { ...root, children: tree.topLevel };
  return renderMenu(virtual);
}

/** true kalau input berupa greeting atau kunci menu yang ada di pohon. */
export function isMenuInputFor(tree: BotMenuTree, text: string | null | undefined): boolean {
  const normalized = (text ?? "").trim().toLowerCase();
  if (normalized === "") return true;
  if (GREETINGS.has(normalized) || HELP_COMMANDS.has(normalized) || RESET_COMMANDS.has(normalized)) return true;
  const cleaned = normalized.replace(/[)\]\s]/g, "");
  if (!/^\d+(\.\d+)*$/.test(cleaned)) return false;
  const node = tree.byPath.get(cleaned);
  return cleaned === "0" || Boolean(node && node.is_active);
}

/** Balasan menu untuk sebuah input; null bila pohon menu kosong. */
export function resolveMenuReply(tree: BotMenuTree, text: string | null | undefined): string | null {
  const main = mainMenu(tree);
  if (!main) return null;

  const normalized = (text ?? "").trim().toLowerCase();
  if (GREETINGS.has(normalized) || RESET_COMMANDS.has(normalized)) return main;
  if (HELP_COMMANDS.has(normalized)) {
    return "❓ *Bantuan*\n\nBalas dengan angka yang tertera untuk memilih layanan. Anda juga bisa mengetik pertanyaan dengan kalimat biasa.\n\nKetik *0* atau *Mulai ulang* untuk kembali ke awal, atau ketik *7* untuk berbicara dengan petugas.";
  }

  const key = toMenuKey(normalized);
  if (key === "0" || key === "") return main;

  const node = tree.byPath.get(key);
  if (node && node.is_active) return renderMenu(node);

  const parts = key.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = tree.byPath.get(parts.slice(0, i).join("."));
    if (parent && parent.is_active) return UNKNOWN_PREFIX + renderMenu(parent);
  }
  return UNKNOWN_PREFIX + main;
}
