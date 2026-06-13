/**
 * Activity API — audit trail for task changes.
 * Used to log every field change, status update, comment, etc.
 */
import { createClient } from "@/lib/supabase/client";

export const activityApi = {
  /**
   * Log an activity entry. Called after item updates.
   */
  async log({ item_id, action = "updated", field_name, old_value, new_value }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("task_activity")
      .insert({
        item_id,
        user_id: user.id,
        action,
        field_name: field_name || null,
        old_value: old_value != null ? String(old_value) : null,
        new_value: new_value != null ? String(new_value) : null,
      })
      .select()
      .single();

    if (error) throw new Error("Failed to log activity: " + error.message);
    return data;
  },

  /**
   * List activity for a task, newest first.
   */
  async listByItem(itemId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_activity")
      .select("*, profiles(id, full_name, avatar_url)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to load activity: " + error.message);
    return data || [];
  },

  /**
   * Log a field change — compares old vs new values.
   * Only logs if values actually changed.
   */
  async logFieldChange({ item_id, field_name, old_value, new_value }) {
    // Skip if no actual change
    if (String(old_value ?? "") === String(new_value ?? "")) return null;

    return this.log({
      item_id,
      action: "updated",
      field_name,
      old_value: old_value ?? "",
      new_value: new_value ?? "",
    });
  },
};
