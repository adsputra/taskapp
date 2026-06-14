/**
 * Comments API — CRUD for task_comments.
 * Joins with profiles to get user display info.
 */
import { createClient } from "@/lib/supabase/client";

export const commentsApi = {
  /**
   * List all comments for a task, ordered oldest first (chat-style).
   */
  async listByItem(itemId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_comments")
      .select("*, profiles(id, full_name, email, avatar_url)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true });

    if (error) throw new Error("Failed to load comments: " + error.message);
    return data || [];
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
