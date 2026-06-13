/**
 * Time API — CRUD for task_time_entries.
 */
import { createClient } from "@/lib/supabase/client";

export const timeApi = {
  /**
   * List all time entries for a task, newest first.
   */
  async listByItem(itemId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_time_entries")
      .select("*, profiles(id, full_name, avatar_url)")
      .eq("item_id", itemId)
      .order("date", { ascending: false });

    if (error) throw new Error("Failed to load time entries: " + error.message);
    return data || [];
  },

  /**
   * Get total minutes logged for a task.
   */
  async getTotal(itemId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_time_entries")
      .select("duration_minutes")
      .eq("item_id", itemId);

    if (error) throw new Error("Failed to calculate total: " + error.message);
    return (data || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  },

  /**
   * Create a time entry.
   */
  async create({ item_id, duration_minutes, description = "", date }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("task_time_entries")
      .insert({
        item_id,
        user_id: user.id,
        duration_minutes,
        description,
        date: date || new Date().toISOString().split("T")[0],
      })
      .select("*, profiles(id, full_name, avatar_url)")
      .single();

    if (error) throw new Error("Failed to create time entry: " + error.message);
    return data;
  },

  /**
   * Update a time entry.
   */
  async update(id, { duration_minutes, description, date }) {
    const supabase = createClient();
    const updates = {};
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (description !== undefined) updates.description = description;
    if (date !== undefined) updates.date = date;

    const { data, error } = await supabase
      .from("task_time_entries")
      .update(updates)
      .eq("id", id)
      .select("*, profiles(id, full_name, avatar_url)")
      .single();

    if (error) throw new Error("Failed to update time entry: " + error.message);
    return data;
  },

  /**
   * Delete a time entry.
   */
  async delete(id) {
    const supabase = createClient();
    const { error } = await supabase
      .from("task_time_entries")
      .delete()
      .eq("id", id);

    if (error) throw new Error("Failed to delete time entry: " + error.message);
  },
};
