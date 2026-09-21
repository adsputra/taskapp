"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isValidUuid } from "@/lib/validation";

const MAX_PROFILES_PER_CALL = 20;

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

/**
 * Fix profiles that have null email/full_name by pulling data from auth.users.
 * Called when comments display "Unknown" users.
 *
 * Security: requires an authenticated caller and only touches profiles of
 * users who share a board with the caller (or the caller themself).
 */
export async function fixMissingProfiles(userIds) {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) return { ok: true };

    const uniqueIds = [...new Set(userIds)]
      .filter((id) => typeof id === "string")
      .slice(0, MAX_PROFILES_PER_CALL);

    if (uniqueIds.length === 0) return { ok: true };
    if (uniqueIds.some((id) => !isValidUuid(id))) {
      return { error: "Input tidak valid." };
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Tidak terautentikasi" };

    // Authorization: RLS on profiles/board_members only exposes rows the
    // caller may see. Anything not returned is not eligible for repair.
    const allowed = new Set([user.id]);

    const { data: visibleProfiles, error: visibleError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", uniqueIds);

    if (visibleError) {
      logger.error("fixMissingProfiles visibility check failed", { code: visibleError.code });
      return { error: "Gagal memeriksa akses." };
    }
    for (const row of visibleProfiles || []) allowed.add(row.id);

    const { data: sharedMembers, error: sharedError } = await supabase
      .from("board_members")
      .select("user_id")
      .in("user_id", uniqueIds);

    if (sharedError) {
      logger.error("fixMissingProfiles membership check failed", { code: sharedError.code });
      return { error: "Gagal memeriksa akses." };
    }
    for (const row of sharedMembers || []) {
      if (row.user_id) allowed.add(row.user_id);
    }

    const missing = uniqueIds.filter((id) => !allowed.has(id));
    if (missing.length === 0) return { ok: true };

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !url) {
      // Fallback tanpa service role: hanya profile sendiri yang bisa diperbaiki.
      if (missing.includes(user.id)) {
        const fullName =
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }
      return { ok: true, partial: true };
    }

    const admin = createAdminClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let repaired = 0;
    for (const uid of missing) {
      const { data: { user: target }, error } = await admin.auth.admin.getUserById(uid);

      if (error || !target) {
        await admin
          .from("profiles")
          .upsert({ id: uid }, { onConflict: "id", ignoreDuplicates: true });
        continue;
      }

      const fullName =
        target.user_metadata?.full_name || target.email?.split("@")[0] || null;

      const { error: upsertError } = await admin.from("profiles").upsert(
        {
          id: uid,
          email: target.email,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (upsertError) {
        logger.warn("fixMissingProfiles upsert failed", { code: upsertError.code });
      } else {
        repaired += 1;
      }
    }

    logger.info("fixMissingProfiles repaired", { requested: uniqueIds.length, repaired });
    return { ok: true };
  } catch (err) {
    logger.error("fixMissingProfiles error", { detail: err?.message });
    return { error: "Failed to fix profiles." };
  }
}
