"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

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
      logger.warn("getProfile failed", { code: fetchError.code });
      return { error: "Gagal mengambil profile." };
    }

    return { profile };
  } catch (err) {
    logger.error("getProfile error", { detail: err?.message });
    return { error: "Gagal mengambil profile." };
  }
}
