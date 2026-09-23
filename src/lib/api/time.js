/**
 * Time API — CRUD for task_time_entries.
 *
 * Production hardening:
 * - Parameterized input validation at boundaries
 * - Safe error mapping via apiError (no raw DB error leakage)
 * - Bound limits and pagination safety
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { assert, clampLimit, requireUuid } from "@/lib/validation";

const TIME_ENTRY_SELECT = "*, profiles(id, full_name, avatar_url)";

function validateDuration(minutes) {
  assert(
    Number.isInteger(minutes) && minutes > 0 && minutes <= 14400,
    "Durasi harus berupa angka menit bulat antara 1 sampai 14400 (maks 10 hari)."
  );
  return minutes;
}

function validateDate(dateStr) {
  assert(
    typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr),
    "Format tanggal harus YYYY-MM-DD."
  );
  return dateStr;
}

function validateDescription(desc) {
  assert(
    typeof desc === "string" && desc.length <= 2000,
    "Deskripsi maksimal 2000 karakter."
  );
  return desc.trim();
}

export const timeApi = {
  /**
   * List all time entries for a task, newest first.
   */
  async listByItem(itemId, { limit } = {}) {
    requireUuid(itemId, "Item ID");
    const pageSize = clampLimit(limit, { defaultLimit: 200, maxLimit: 500 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_time_entries")
      .select(TIME_ENTRY_SELECT)
      .eq("item_id", itemId)
      .order("date", { ascending: false })
      .limit(pageSize);

    if (error) throw apiError(error, "Gagal memuat catatan waktu.");
    return data || [];
  },

  /**
   * Get total minutes logged for a task.
   */
  async getTotal(itemId) {
    requireUuid(itemId, "Item ID");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_time_entries")
      .select("duration_minutes")
      .eq("item_id", itemId);

    if (error) throw apiError(error, "Gagal menghitung total waktu.");
    return (data || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  },

  /**
   * Create a time entry.
   */
  async create({ item_id, duration_minutes, description = "", date }) {
    requireUuid(item_id, "Item ID");
    const cleanDuration = validateDuration(duration_minutes);
    const cleanDesc = validateDescription(description);
    const cleanDate = date ? validateDate(date) : new Date().toISOString().split("T")[0];

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk mencatat waktu.");

    const { data, error } = await supabase
      .from("task_time_entries")
      .insert({
        item_id,
        user_id: user.id,
        duration_minutes: cleanDuration,
        description: cleanDesc,
        date: cleanDate,
      })
      .select(TIME_ENTRY_SELECT)
      .single();

    if (error) throw apiError(error, "Gagal membuat catatan waktu.");
    return data;
  },

  /**
   * Update a time entry.
   */
  async update(id, { duration_minutes, description, date }) {
    requireUuid(id, "Entry ID");
    const updates = {};
    if (duration_minutes !== undefined) updates.duration_minutes = validateDuration(duration_minutes);
    if (description !== undefined) updates.description = validateDescription(description);
    if (date !== undefined) updates.date = validateDate(date);

    assert(Object.keys(updates).length > 0, "Tidak ada data perubahan.");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_time_entries")
      .update(updates)
      .eq("id", id)
      .select(TIME_ENTRY_SELECT)
      .single();

    if (error) throw apiError(error, "Gagal memperbarui catatan waktu.");
    return data;
  },

  /**
   * Delete a time entry.
   */
  async delete(id) {
    requireUuid(id, "Entry ID");
    const supabase = createClient();
    const { error } = await supabase
      .from("task_time_entries")
      .delete()
      .eq("id", id);

    if (error) throw apiError(error, "Gagal menghapus catatan waktu.");
  },
};
