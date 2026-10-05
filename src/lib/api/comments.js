/**
 * Comments API — CRUD for task_comments.
 * Joins with profiles to get user display info.
 */
import { createClient } from "@/lib/supabase/client";
import { notifyActivityChanged } from "./activity";
import { apiError } from "./errors";
import { MAX_MENTIONS, assert, clampLimit, requireUuid } from "@/lib/validation";

const MAX_COMMENT_LENGTH = 5000;
const COMMENT_SELECT = "*, profiles(id, full_name, email, avatar_url)";

function requireContent(content) {
  assert(typeof content === "string" && content.trim().length > 0, "Komentar tidak boleh kosong.");
  assert(content.length <= MAX_COMMENT_LENGTH, `Komentar maksimal ${MAX_COMMENT_LENGTH} karakter.`);
  return content.trim();
}

export const commentsApi = {
  /**
   * List all comments for a task, ordered oldest first (chat-style).
   * Repairs missing author profiles (RPC, scoped to people the caller
   * shares a board with) so names resolve correctly.
   */
  async listByItem(itemId, { limit } = {}) {
    requireUuid(itemId, "Item ID");
    const pageSize = clampLimit(limit, { defaultLimit: 500, maxLimit: 1000 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_comments")
      .select(COMMENT_SELECT)
      .eq("item_id", itemId)
      .order("created_at", { ascending: true })
      .limit(pageSize);

    if (error) throw apiError(error, "Failed to load comments.");
    const comments = data || [];

    const missingUserIds = [
      ...new Set(
        comments
          .filter((comment) => !comment.profiles || (!comment.profiles.full_name && !comment.profiles.email))
          .map((comment) => comment.user_id)
          .filter(Boolean)
      ),
    ].slice(0, 20);

    if (missingUserIds.length > 0) {
      const { data: repaired, error: repairError } = await supabase.rpc("repair_missing_profiles", {
        p_user_ids: missingUserIds,
      });
      if (repairError || !repaired) return comments;

      const { data: refreshed, error: refreshError } = await supabase
        .from("task_comments")
        .select(COMMENT_SELECT)
        .eq("item_id", itemId)
        .order("created_at", { ascending: true })
        .limit(pageSize);

      if (refreshError) throw apiError(refreshError, "Failed to load comments.");
      return refreshed || comments;
    }

    return comments;
  },

  /**
   * Create a new comment. `mentioned_user_ids` are the people tagged with
   * @ — the database notifies the ones who can read the board.
   */
  async create({ item_id, content, mentioned_user_ids = [] }) {
    requireUuid(item_id, "Item ID");
    const cleanContent = requireContent(content);
    assert(Array.isArray(mentioned_user_ids) && mentioned_user_ids.length <= MAX_MENTIONS, "Terlalu banyak mention.");
    mentioned_user_ids.forEach((id) => requireUuid(id, "Mention"));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk berkomentar.");

    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        item_id,
        user_id: user.id,
        content: cleanContent,
        mentioned_user_ids: [...new Set(mentioned_user_ids)],
      })
      .select(COMMENT_SELECT)
      .single();

    if (error) throw apiError(error, "Failed to create comment.");
    notifyActivityChanged(item_id);
    return data;
  },

  /**
   * Update a comment (only own comments).
   */
  async update(id, { content }) {
    requireUuid(id, "Comment ID");
    const cleanContent = requireContent(content);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_comments")
      .update({ content: cleanContent })
      .eq("id", id)
      .select(COMMENT_SELECT)
      .single();

    if (error) {
      if (error.code === "PGRST116") throw new Error("Komentar tidak ditemukan atau bukan milikmu.");
      throw apiError(error, "Failed to update comment.");
    }
    return data;
  },

  /**
   * Delete a comment.
   */
  async delete(id) {
    requireUuid(id, "Comment ID");
    const supabase = createClient();
    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", id);

    if (error) throw apiError(error, "Failed to delete comment.");
  },
};
