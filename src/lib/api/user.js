/**
 * User API — session & profile operations.
 * Digunakan oleh client components (NavBar, Dashboard, dll).
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import {
  assert,
  clampLimit,
  passwordError,
  requireNonEmptyString,
} from "@/lib/validation";

const PROFILE_UPDATE_FIELDS = ["full_name", "avatar_url"];

function buildProfileUpdates(updates) {
  assert(
    updates !== null && typeof updates === "object" && !Array.isArray(updates),
    "Perubahan profile tidak valid."
  );

  const clean = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!PROFILE_UPDATE_FIELDS.includes(key)) continue;
    if (key === "full_name") {
      clean.full_name = requireNonEmptyString(value, { field: "Nama", max: 100 });
    } else {
      assert(
        value === null || (typeof value === "string" && /^https?:\/\//i.test(value) && value.length <= 500),
        "URL avatar tidak valid."
      );
      clean.avatar_url = value;
    }
  }

  assert(Object.keys(clean).length > 0, "Tidak ada perubahan profile yang valid.");
  return clean;
}

export const userApi = {
  /**
   * Dapatkan user yang sedang login + profile.
   */
  async me() {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      // Profile belum ada — kembalikan data minimal dari auth
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: user.created_at,
      };
    }

    return profile;
  },

  /**
   * Dapatkan session JWT saat ini.
   */
  async session() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) return null;
    return data.session;
  },

  /**
   * Update profile fields (full_name, avatar_url).
   */
  async updateProfile(updates) {
    const clean = buildProfileUpdates(updates);

    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("profiles")
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw apiError(error, "Gagal update profile.");
    return data;
  },

  /**
   * Change password for the current user.
   */
  async changePassword(currentPassword, newPassword) {
    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      throw new Error("Password saat ini wajib diisi.");
    }
    const passwordIssue = passwordError(newPassword);
    if (passwordIssue) throw new Error(passwordIssue);

    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) throw new Error("Password saat ini salah.");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw apiError(error, "Gagal mengganti password.");
    return { ok: true };
  },

  /**
   * Get boards owned by the current user (for activity tab).
   */
  async getRecentBoards(limit = 10) {
    const pageSize = clampLimit(limit, { defaultLimit: 10, maxLimit: 50 });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("boards")
      .select("id, title, color, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(pageSize);

    if (error) throw apiError(error, "Gagal memuat boards.");
    return data || [];
  },
};
