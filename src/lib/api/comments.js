/**
 * Comments API — CRUD for task_comments.
 * Joins with profiles to get user display info.
 */
import { createClient } from "@/lib/supabase/client";
import { fixMissingProfiles } from "@/app/actions/profile";

export const commentsApi = {
  /**
   * List all comments for a task, ordered oldest first (chat-style).
   * Auto-fixes missing profiles via server action so names resolve correctly.
   */
  async listByItem(itemId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_comments")
      .select("*, profiles(id, full_name, email, avatar_url)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true });

    if (error) throw new Error("Failed to load comments: " + error.message);
    const comments = data || [];

    // Find comments whose profile data is missing or incomplete
    const missingUserIds = [
      ...new Set(
        comments
          .filter((c) => !c.profiles || (!c.profiles.full_name && !c.profiles.email))
          .map((c) => c.user_id)
          .filter(Boolean)
      ),
    ];

    if (missingUserIds.length > 0) {
      // Use server action to properly fix profiles (has access to auth.users)
      await fixMissingProfiles(missingUserIds);

      // Re-fetch with profiles now populated
      const { data: refreshed } = await supabase
        .from("task_comments")
        .select("*, profiles(id, full_name, email, avatar_url)")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });

      return refreshed || comments;
    }

    return comments;
  },

  /**
   * Create a new comment.
   */
  async create({ item_id, content }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("task_comments")
      .insert({ item_id, user_id: user.id, content })
      .select("*, profiles(id, full_name, email, avatar_url)")
      .single();

    if (error) throw new Error("Failed to create comment: " + error.message);
    return data;
  },

  /**
   * Update a comment (only own comments).
   */
  async update(id, { content }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_comments")
      .update({ content })
      .eq("id", id)
      .select("*, profiles(id, full_name, email, avatar_url)")
      .single();

    if (error) throw new Error("Failed to update comment: " + error.message);
    return data;
  },

  /**
   * Delete a comment.
   */
  async delete(id) {
    const supabase = createClient();
    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", id);

    if (error) throw new Error("Failed to delete comment: " + error.message);
  },
};
