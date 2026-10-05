/**
 * Activity API — read-only view of the audit trail.
 *
 * Entries are written exclusively by database triggers (see
 * supabase/schema.sql §9b): the API role has no INSERT privilege on
 * task_activity, so the trail cannot be forged or skipped from a browser.
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { clampLimit, requireUuid } from "@/lib/validation";

/**
 * Tell open activity views to refetch right away. The rows themselves are
 * written by database triggers; realtime delivers them too, this just
 * avoids waiting for the realtime round trip after our own edits.
 */
export function notifyActivityChanged(itemId) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("activity-updated", { detail: { itemId } }));
  }
}

export const activityApi = {
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
};
