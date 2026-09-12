import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BotEngine = "keyword" | "ai_external";

export type AppSettings = {
  id: string;
  instansi_name: string;
  logo_url: string | null;
  jam_buka: string;
  jam_tutup: string;
  bot_engine: BotEngine;
  updated_at: string;
};

export const APP_SETTINGS_DEFAULTS = {
  instansi_name: "Pemerintah Kabupaten Purworejo",
  jam_buka: "08:00",
  jam_tutup: "15:30",
  bot_engine: "keyword",
} as const;

/** Ambil satu baris pengaturan aplikasi (null jika belum ada). */
export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppSettings | null> => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("id, instansi_name, logo_url, jam_buka, jam_tutup, bot_engine, updated_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as AppSettings | null) ?? null;
  });

/** Simpan pengaturan aplikasi (Owner saja). */
export const saveAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    instansiName: string;
    jamBuka: string;
    jamTutup: string;
    logoUrl: string | null;
    botEngine?: string;
  }) => {
    const instansiName = String(input?.instansiName ?? "").trim();
    const jamBuka = String(input?.jamBuka ?? "").trim();
    const jamTutup = String(input?.jamTutup ?? "").trim();
    const logoUrl = input?.logoUrl ? String(input.logoUrl).trim() : null;
    if (!instansiName) throw new Error("Nama instansi wajib diisi");
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(jamBuka)) throw new Error("Jam mulai harus format HH:MM");
    if (!timePattern.test(jamTutup)) throw new Error("Jam selesai harus format HH:MM");
    const botEngine: "keyword" | "ai_external" =
      input?.botEngine === "ai_external" ? "ai_external" : "keyword";
    return { instansiName, jamBuka, jamTutup, logoUrl, botEngine };
  })
  .handler(async ({ context, data }): Promise<AppSettings> => {
    const roleCheck = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (roleCheck.error) throw new Error(roleCheck.error.message);
    if (!roleCheck.data) throw new Error("Hanya Owner yang bisa mengubah pengaturan ini");

    const existing = await context.supabase
      .from("app_settings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    const payload = {
      instansi_name: data.instansiName,
      jam_buka: data.jamBuka,
      jam_tutup: data.jamTutup,
      logo_url: data.logoUrl,
      bot_engine: data.botEngine,
    };

    const result = existing.data
      ? await context.supabase
          .from("app_settings")
          .update(payload)
          .eq("id", (existing.data as { id: string }).id)
          .select("id, instansi_name, logo_url, jam_buka, jam_tutup, bot_engine, updated_at")
          .single()
      : await context.supabase
          .from("app_settings")
          .insert(payload)
          .select("id, instansi_name, logo_url, jam_buka, jam_tutup, bot_engine, updated_at")
          .single();

    if (result.error) throw new Error(result.error.message);
    return result.data as AppSettings;
  });
