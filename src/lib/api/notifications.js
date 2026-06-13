/**
 * Notifications API — CRUD for in-app notifications.
 * Uses existing `read` column (not `is_read`).
 */
import { createClient } from "@/lib/supabase/client";

export const notificationsApi = {
  /**
   * List notifications for the current user, newest first.
   */
  async list({ limit = 50, unreadOnly = false } = {}) {
    const supabase = createClient();
    let query = supabase
      .from("notifications")
      .select("*, actor:actor_id(id, full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;
    if (error) throw new Error("Failed to load notifications: " + error.message);
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

    if (error) throw new Error("Failed to count notifications: " + error.message);
    return count || 0;
  },

  /**
   * Mark a single notification as read.
   */
  async markRead(id) {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) throw new Error("Failed to mark read: " + error.message);
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

    if (error) throw new Error("Failed to mark all read: " + error.message);
  },

  /**
   * Create a notification.
   */
  async create({ user_id, board_id, item_id, actor_id, type, title, message }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .insert({ user_id, board_id, item_id, actor_id, type, title, message })
      .select()
      .single();

    if (error) throw new Error("Failed to create notification: " + error.message);
    return data;
  },

  /**
   * Delete a notification.
   */
  async delete(id) {
    const supabase = createClient();
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) throw new Error("Failed to delete notification: " + error.message);
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

    if (error) throw new Error("Failed to delete read notifications: " + error.message);
  },
};
