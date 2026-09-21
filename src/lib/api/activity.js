/**
 * Activity API — audit trail for task changes.
 * Used to log every field change, status update, comment, etc.
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { assert, clampLimit, requireUuid } from "@/lib/validation";

const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "commented",
  "attached",
  "status_changed",
  "assigned",
];
const MAX_TEXT_LENGTH = 5000;

function serializeValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

// Notify listeners when new activity is logged
const notifyActivity = (itemId) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("activity-updated", { detail: { itemId } }));
  }
};

export const activityApi = {
  /**
   * Log a single activity entry.
   */
  async log({ item_id, action = "updated", field_name, old_value, new_value }) {
    requireUuid(item_id, "Item ID");
    assert(ACTIVITY_ACTIONS.includes(action), "Action activity tidak valid.");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk mencatat aktivitas.");

    const { data, error } = await supabase
      .from("task_activity")
      .insert({
        item_id,
        user_id: user.id,
        action,
        field_name: field_name ? String(field_name).slice(0, 100) : null,
        old_value: serializeValue(old_value),
        new_value: serializeValue(new_value),
      })
      .select()
      .single();

    if (error) throw apiError(error, "Failed to log activity.");
    notifyActivity(item_id);
    return data;
  },

  /**
   * Log multiple activity entries with a single insert.
   */
  async logMany(entries) {
    assert(Array.isArray(entries) && entries.length > 0, "Tidak ada activity untuk dicatat.");
    assert(entries.length <= 100, "Maksimal 100 activity per batch.");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk mencatat aktivitas.");

    const rows = entries.map((entry) => {
      requireUuid(entry.item_id, "Item ID");
      assert(ACTIVITY_ACTIONS.includes(entry.action || "updated"), "Action activity tidak valid.");
      return {
        item_id: entry.item_id,
        user_id: user.id,
        action: entry.action || "updated",
        field_name: entry.field_name ? String(entry.field_name).slice(0, 100) : null,
        old_value: serializeValue(entry.old_value),
        new_value: serializeValue(entry.new_value),
      };
    });

    const { data, error } = await supabase.from("task_activity").insert(rows).select();

    if (error) throw apiError(error, "Failed to log activity.");

    for (const itemId of new Set(rows.map((row) => row.item_id))) {
      notifyActivity(itemId);
    }
    return data || [];
  },

  /**
   * List activity for a task, newest first.
   */
  async listByItem(itemId, { limit } = {}) {
    requireUuid(itemId, "Item ID");
    const pageSize = clampLimit(limit, { defaultLimit: 200, maxLimit: 500 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_activity")
      .select("*, profiles(id, full_name, avatar_url)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (error) throw apiError(error, "Failed to load activity.");
    return data || [];
  },

  /**
   * Log a field change — compares old vs new values.
   * Only logs if values actually changed.
   */
  async logFieldChange({ item_id, field_name, old_value, new_value }) {
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
