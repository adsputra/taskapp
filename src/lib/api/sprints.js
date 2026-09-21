/**
 * Sprints API — CRUD for sprints + moving items between sprints.
 *
 * v2 — production hardening: validasi input, pagination, dan
 * assign/unassign memakai satu RPC batch (bukan N request).
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import {
  SPRINT_STATUSES,
  assert,
  clampLimit,
  requireEnum,
  requireNonEmptyString,
  requireUuid,
  requireUuidArray,
} from "@/lib/validation";

const SPRINT_UPDATE_FIELDS = ["title", "start_date", "end_date", "status"];

function requireDateString(value, field) {
  assert(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    `${field} tidak valid.`
  );
  return value;
}

function buildSprintUpdates(updates) {
  assert(updates !== null && typeof updates === "object" && !Array.isArray(updates), "Perubahan sprint tidak valid.");
  const clean = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!SPRINT_UPDATE_FIELDS.includes(key)) continue;
    if (key === "title") {
      clean.title = requireNonEmptyString(value, { field: "Judul sprint", max: 200 });
    } else if (key === "status") {
      clean.status = requireEnum(value, SPRINT_STATUSES, "Status sprint");
    } else {
      clean[key] = requireDateString(value, key === "start_date" ? "Tanggal mulai" : "Tanggal selesai");
    }
  }

  assert(Object.keys(clean).length > 0, "Tidak ada perubahan sprint yang valid.");
  return clean;
}

export const sprintsApi = {
  /**
   * List all sprints for a board, newest first.
   */
  async listByBoard(boardId, { limit } = {}) {
    requireUuid(boardId, "Board ID");
    const pageSize = clampLimit(limit, { defaultLimit: 100, maxLimit: 200 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (error) throw apiError(error, "Failed to load sprints.");
    return data || [];
  },

  /**
   * Get the active sprint for a board.
   */
  async getActive(boardId) {
    requireUuid(boardId, "Board ID");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .select("*")
      .eq("board_id", boardId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw apiError(error, "Failed to load active sprint.");
    return data;
  },

  /**
   * Create a new sprint.
   */
  async create({ board_id, title, start_date, end_date }) {
    requireUuid(board_id, "Board ID");
    requireNonEmptyString(title, { field: "Judul sprint", max: 200 });
    if (start_date) requireDateString(start_date, "Tanggal mulai");
    if (end_date) requireDateString(end_date, "Tanggal selesai");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .insert({ board_id, title: title.trim(), start_date, end_date })
      .select()
      .single();

    if (error) throw apiError(error, "Failed to create sprint.");
    return data;
  },

  /**
   * Update a sprint (title, dates, status).
   */
  async update(id, updates) {
    requireUuid(id, "Sprint ID");
    const clean = buildSprintUpdates(updates);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .update(clean)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") throw new Error("Sprint tidak ditemukan atau kamu tidak punya akses.");
      throw apiError(error, "Failed to update sprint.");
    }
    return data;
  },

  /**
   * Start a sprint (change status from planning to active).
   */
  async start(id) {
    return this.update(id, { status: "active", start_date: new Date().toISOString().split("T")[0] });
  },

  /**
   * Complete a sprint.
   */
  async complete(id) {
    return this.update(id, { status: "completed", end_date: new Date().toISOString().split("T")[0] });
  },

  /**
   * Delete a sprint. board_items.sprint_id is ON DELETE SET NULL,
   * so items automatically return to the backlog.
   */
  async delete(id) {
    requireUuid(id, "Sprint ID");
    const supabase = createClient();
    const { error } = await supabase.from("sprints").delete().eq("id", id);
    if (error) throw apiError(error, "Failed to delete sprint.");
  },

  /**
   * Move items into a sprint — one batch RPC.
   */
  async assignItems(sprintId, itemIds) {
    requireUuid(sprintId, "Sprint ID");
    requireUuidArray(itemIds, { field: "Daftar item", max: 1000 });

    const supabase = createClient();
    const { error } = await supabase.rpc("set_items_sprint", {
      p_sprint_id: sprintId,
      p_item_ids: itemIds,
    });

    if (error) throw apiError(error, "Failed to assign items.");
  },

  /**
   * Remove items from a sprint (back to backlog) — one batch RPC.
   */
  async unassignItems(itemIds) {
    requireUuidArray(itemIds, { field: "Daftar item", max: 1000 });

    const supabase = createClient();
    const { error } = await supabase.rpc("set_items_sprint", {
      p_sprint_id: null,
      p_item_ids: itemIds,
    });

    if (error) throw apiError(error, "Failed to unassign items.");
  },
};
