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
};
