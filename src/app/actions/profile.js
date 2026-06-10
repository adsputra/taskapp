"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Memastikan user memiliki row di tabel `profiles`.
 *
 * Dipanggil setelah login, signup, atau auth callback.
 * Idempoten: jika profile sudah ada, tidak melakukan apa-apa.
 *
 * Returns { ok: true } jika sukses, atau { error: string } jika gagal.
 */
export async function ensureProfile() {
  try {
    const supabase = await createClient();

    // Dapatkan user dari session JWT
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return { error: "Gagal verifikasi sesi: " + userError.message };
    }

    if (!user) {
      return { error: "Tidak terautentikasi" };
    }

    // Cek apakah profile sudah ada
    const { data: existing, error: fetchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch profile error:", fetchError);
      return { error: "Gagal mengecek profile: " + fetchError.message };
    }

    // Sudah ada → tidak perlu insert
    if (existing) {
      return { ok: true };
    }

    // Profile belum ada → buat baru
    const fullName =
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User";

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      email: user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
    });

    if (insertError) {
      // Mungkin race condition — profile sudah dibuat oleh request lain
      if (insertError.code === "23505") {
        return { ok: true };
      }
      console.error("Insert profile error:", insertError);
      return { error: "Gagal membuat profile: " + insertError.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("ensureProfile error:", err);
    return { error: "Kesalahan tidak terduga saat membuat profile." };
  }
}

/**
 * Mendapatkan data profile user saat ini.
 * Digunakan oleh server components untuk membaca data profil.
 *
 * Returns { profile } atau { error }.
 */
export async function getProfile() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Tidak terautentikasi" };
    }

    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      // Profile belum ada — buat sekarang
      if (fetchError.code === "PGRST116") {
        await ensureProfile();
        return getProfile();
      }
      return { error: fetchError.message };
    }

    return { profile };
  } catch (err) {
    console.error("getProfile error:", err);
    return { error: "Gagal mengambil profile." };
  }
}
