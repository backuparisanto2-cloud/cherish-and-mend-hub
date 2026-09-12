import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "owner" | "admin";

export type AppUser = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  created_at: string;
};

/** Profil + peran pengguna yang sedang login. */
export const getCurrentAppUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUser | null> => {
    const { data, error } = await context.supabase
      .from("users")
      .select("id, full_name, email, role, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as AppUser | null) ?? null;
  });

async function assertOwner(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Hanya Owner yang bisa mengubah pengaturan ini");
}

/** Daftar seluruh akun (Owner saja). */
export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUser[]> => {
    await assertOwner(context);
    const { data, error } = await context.supabase
      .from("users")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as AppUser[];
  });

/** Buat akun Admin baru (Owner saja) memakai service role di server. */
export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; email: string; password: string }) => {
    const fullName = String(input?.fullName ?? "").trim();
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    if (!fullName) throw new Error("Nama wajib diisi");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email tidak valid");
    if (password.length < 8) throw new Error("Password sementara minimal 8 karakter");
    return { fullName, email, password };
  })
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Gagal membuat akun");
    }

    const userId = created.data.user.id;
    const { error } = await supabaseAdmin.from("users").insert({
      id: userId,
      full_name: data.fullName,
      email: data.email,
      role: "admin",
    });
    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(error.message);
    }
    return { id: userId };
  });

/** Hapus akun Admin (Owner saja). Owner tidak bisa dihapus lewat aplikasi. */
export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    const userId = String(input?.userId ?? "");
    if (!userId) throw new Error("User tidak valid");
    return { userId };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertOwner(context);
    if (data.userId === context.userId) throw new Error("Akun sendiri tidak bisa dihapus");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", data.userId)
      .maybeSingle();
    if (target.error) throw new Error(target.error.message);
    if (!target.data) throw new Error("Akun tidak ditemukan");
    if (target.data.role !== "admin") throw new Error("Hanya akun Admin yang bisa dihapus");

    const removed = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (removed.error) throw new Error(removed.error.message);
    await supabaseAdmin.from("users").delete().eq("id", data.userId);
    return { ok: true };
  });
