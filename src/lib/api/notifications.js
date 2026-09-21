/**
 * Notifications API — CRUD for in-app notifications.
 * Uses existing `read` column (not `is_read`).
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import {
  assert,
  clampLimit,
  requireNonEmptyString,
  requireUuid,
} from "@/lib/validation";

export const notificationsApi = {
  /**
   * List notifications for the current user, newest first.
   */
  async list({ limit = 50, unreadOnly = false } = {}) {
    const pageSize = clampLimit(limit, { defaultLimit: 50, maxLimit: 200 });

    const supabase = createClient();
    let query = supabase
      .from("notifications")
      .select("*, actor:actor_id(id, full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;
    if (error) throw apiError(error, "Failed to load notifications.");
    return data || [];
  },

  /**
   * Get unread count for the current user.
   */
  async unreadCount() {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("read", false);

    if (error) throw apiError(error, "Failed to count notifications.");
    return count || 0;
  },

  /**
   * Mark a single notification as read.
   */
  async markRead(id) {
    requireUuid(id, "Notification ID");
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) throw apiError(error, "Failed to mark read.");
  },

  /**
   * Mark all notifications as read.
   */
  async markAllRead() {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false);

    if (error) throw apiError(error, "Failed to mark all read.");
  },

  /**
   * Create a notification. RLS only allows notifying yourself
   * (cross-user notifications must come from DB triggers).
   */
  async create({ user_id, board_id, item_id, actor_id, type, title, message }) {
    requireUuid(user_id, "User ID");
    requireNonEmptyString(title, { field: "Judul", max: 200 });
    if (board_id) requireUuid(board_id, "Board ID");
    if (item_id) requireUuid(item_id, "Item ID");
    if (actor_id) requireUuid(actor_id, "Actor ID");
    if (message !== undefined && message !== null) {
      assert(typeof message === "string" && message.length <= 2000, "Pesan maksimal 2000 karakter.");
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .insert({ user_id, board_id, item_id, actor_id, type, title, message })
      .select()
      .single();

    if (error) throw apiError(error, "Failed to create notification.");
    return data;
  },

  /**
   * Delete a notification.
   */
  async delete(id) {
    requireUuid(id, "Notification ID");
    const supabase = createClient();
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) throw apiError(error, "Failed to delete notification.");
  },

  /**
   * Delete all read notifications.
   */
  async deleteAllRead() {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("read", true);

    if (error) throw apiError(error, "Failed to delete read notifications.");
  },
};
