"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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

/**
 * Fix profiles that have null email/full_name by pulling data from auth.users.
 * Called when comments display "Unknown" users.
 * Uses service_role key for admin access when available.
 */
export async function fixMissingProfiles(userIds) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !url) {
      // No service role key — try with regular client as fallback
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Not authenticated" };

      // Can only fix own profile
      if (userIds.includes(user.id)) {
        await supabase
          .from("profiles")
          .update({
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
      return { ok: true, partial: true };
    }

    // Use service role for full admin access
    const supabase = createAdminClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fix each user individually using getUserById (avoids pagination issues)
    for (const uid of userIds) {
      try {
        const { data: { user }, error } = await supabase.auth.admin.getUserById(uid);
        if (error || !user) continue;

        const email = user.email;
        const fullName = user.user_metadata?.full_name || email?.split("@")[0] || null;

        // Ensure profile row exists (upsert), then update with real data
        await supabase.from("profiles").upsert(
          {
            id: uid,
            email,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      } catch (e) {
        // Skip this user, continue with others
        console.warn(`fixMissingProfiles: failed for user ${uid}:`, e.message);
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("fixMissingProfiles error:", err);
    return { error: "Failed to fix profiles." };
  }
}
