/**
 * User API — session & profile operations.
 * Digunakan oleh client components (NavBar, Dashboard, dll).
 */
import { createClient } from "@/lib/supabase/client";

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
   * Update profile fields (full_name, avatar_url, dll).
   */
  async updateProfile(updates) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Change password for the current user.
   */
  async changePassword(currentPassword, newPassword) {
    const supabase = createClient();

    // Verify current password by signing in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) throw new Error("Current password is incorrect");

    // Update to new password
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  /**
   * Get boards owned by the current user (for activity tab).
   */
  async getRecentBoards(limit = 10) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("boards")
      .select("id, title, color, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },
};
