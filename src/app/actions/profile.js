"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";


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
    if (!userIds || userIds.length === 0) return { ok: true };

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !url) {
      // No service role key — try with regular client as fallback
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fix the current user's profile if it's in the list
        if (userIds.includes(user.id)) {
          const fullName =
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User";
          await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                email: user.email,
                full_name: fullName,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
        }

        // For other users: ensure profile rows exist at minimum
        // (with the RLS fix, the profiles join will work and names will show)
        for (const uid of userIds) {
          if (uid === user.id) continue;
          await supabase.from("profiles")
            .upsert({ id: uid }, { onConflict: "id", ignoreDuplicates: true });
        }
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
        if (error || !user) {
          // User might have been deleted — ensure at least a profile row exists
          await supabase.from("profiles")
            .upsert({ id: uid }, { onConflict: "id", ignoreDuplicates: true });
          continue;
        }

        const email = user.email;
        const fullName = user.user_metadata?.full_name || email?.split("@")[0] || null;

        // Upsert profile with real data from auth.users
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
