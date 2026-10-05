/**
 * Items API — semua operasi CRUD untuk board_items.
 *
 * v3 — production hardening:
 * - validasi ID/field di boundary, allowlist field update
 * - pagination default + batas maksimum di semua list
 * - listMyTasks difilter di server (bukan fetch semua lalu filter di JS)
 * - reorder lewat satu RPC (bukan N request)
 * - activity log & notifikasi ditulis trigger database (tidak bisa
 *   dipalsukan atau dilewati dari browser)
 */
import { createClient } from "@/lib/supabase/client";
import { notifyActivityChanged } from "./activity";
import { apiError } from "./errors";
import {
  assert,
  clampLimit,
  isValidEmail,
  parseSort,
  requireNonEmptyString,
  requirePlainObject,
  requireUuid,
  requireUuidArray,
} from "@/lib/validation";

const ITEM_SORT_FIELDS = ["updated_at", "created_at", "order_index", "title"];
const ITEM_UPDATE_FIELDS = [
  "title",
  "description",
  "order_index",
  "group_id",
  "data",
  "parent_id",
  "sprint_id",
  "story_points",
  "estimate_minutes",
];

// Raised by the board_items_check_refs trigger.
const ITEM_ERROR_MESSAGES = {
  "23514": "Parent atau sprint harus berasal dari board yang sama.",
  "42501": "Kamu tidak punya izin untuk perubahan ini.",
};

function buildItemUpdates(updates) {
  requirePlainObject(updates, "Perubahan item");
  const clean = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!ITEM_UPDATE_FIELDS.includes(key)) continue;
    clean[key] = value;
  }

  if (clean.title !== undefined) {
    clean.title = requireNonEmptyString(clean.title, { field: "Judul task", max: 300 });
  }
  if (clean.description !== undefined) {
    assert(typeof clean.description === "string" && clean.description.length <= 20000, "Deskripsi terlalu panjang.");
  }
  if (clean.group_id !== undefined) {
    assert(typeof clean.group_id === "string" && clean.group_id.length <= 100, "Group tidak valid.");
  }
  if (clean.order_index !== undefined) {
    assert(Number.isInteger(clean.order_index) && clean.order_index >= 0, "Order tidak valid.");
  }
  if (clean.story_points !== undefined) {
    assert(Number.isInteger(clean.story_points) && clean.story_points >= 0, "Story points tidak valid.");
  }
  if (clean.estimate_minutes !== undefined) {
    assert(Number.isInteger(clean.estimate_minutes) && clean.estimate_minutes >= 0, "Estimasi tidak valid.");
  }
  if (clean.parent_id !== undefined && clean.parent_id !== null) {
    requireUuid(clean.parent_id, "Parent ID");
  }
  if (clean.sprint_id !== undefined && clean.sprint_id !== null) {
    requireUuid(clean.sprint_id, "Sprint ID");
  }
  if (clean.data !== undefined) {
    requirePlainObject(clean.data, "Data item");
  }

  assert(Object.keys(clean).length > 0, "Tidak ada perubahan yang valid.");
  return clean;
}

export const itemsApi = {
  /**
   * List item untuk satu board atau semua board user (RLS-scoped).
   */
  async list({ boardId, sort = "-updated_at", limit, sprintId, parentId } = {}) {
    const supabase = createClient();
    const { field, ascending } = parseSort(sort, ITEM_SORT_FIELDS);
    const pageSize = clampLimit(limit, { defaultLimit: 1000, maxLimit: 5000 });

    let query = supabase
      .from("board_items")
      .select("*")
      .order(field, { ascending })
      .limit(pageSize);

    if (boardId) query = query.eq("board_id", requireUuid(boardId, "Board ID"));
    if (sprintId) query = query.eq("sprint_id", requireUuid(sprintId, "Sprint ID"));
    if (parentId !== undefined) {
      if (parentId === null) {
        query = query.is("parent_id", null);
      } else {
        query = query.eq("parent_id", requireUuid(parentId, "Parent ID"));
      }
    }

    const { data, error } = await query;
    if (error) throw apiError(error, "Gagal memuat items.");
    return data || [];
  },

  /**
   * List items untuk satu board, urut by order_index.
   */
  async listByBoard(boardId, { limit } = {}) {
    requireUuid(boardId, "Board ID");
    const pageSize = clampLimit(limit, { defaultLimit: 1000, maxLimit: 5000 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_items")
      .select("*")
      .eq("board_id", boardId)
      .order("order_index", { ascending: true })
      .limit(pageSize);

    if (error) throw apiError(error, "Gagal memuat items.");
    return data || [];
  },

  /**
   * List subtasks for a parent item.
   */
  async listSubtasks(parentId, { limit } = {}) {
    requireUuid(parentId, "Parent ID");
    const pageSize = clampLimit(limit, { defaultLimit: 200, maxLimit: 500 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_items")
      .select("*")
      .eq("parent_id", parentId)
      .order("order_index", { ascending: true })
      .limit(pageSize);

    if (error) throw apiError(error, "Failed to load subtasks.");
    return data || [];
  },

  /**
   * List my tasks across all accessible boards.
   * Filters server-side (scalar owner string + array-owner containment)
   * instead of downloading the whole table.
   */
  async listMyTasks(userEmail, { limit } = {}) {
    assert(typeof userEmail === "string" && isValidEmail(userEmail), "Email user tidak valid.");
    const pageSize = clampLimit(limit, { defaultLimit: 200, maxLimit: 500 });

    const supabase = createClient();
    const buildQuery = () =>
      supabase
        .from("board_items")
        .select("*, board:boards(title, color)")
        .order("updated_at", { ascending: false })
        .limit(pageSize);

    const [scalarResult, arrayResult] = await Promise.all([
      buildQuery().eq("data->>owner", userEmail),
      buildQuery().contains("data", { owner: [userEmail] }),
    ]);

    if (scalarResult.error) throw apiError(scalarResult.error, "Gagal memuat tugas saya.");
    if (arrayResult.error) throw apiError(arrayResult.error, "Gagal memuat tugas saya.");

    const merged = new Map();
    for (const item of [...(scalarResult.data || []), ...(arrayResult.data || [])]) {
      merged.set(item.id, item);
    }

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    );
  },

  /**
   * Buat item baru.
   */
  async create({ board_id, group_id, title, order_index = 0, data = {}, parent_id, sprint_id, description }) {
    requireUuid(board_id, "Board ID");
    const cleanGroupId = group_id !== undefined && group_id !== null ? String(group_id) : "";
    assert(cleanGroupId.length > 0 && cleanGroupId.length <= 100, "Group tidak valid.");
    requireNonEmptyString(title, { field: "Judul task", max: 300 });
    assert(Number.isInteger(order_index) && order_index >= 0, "Order tidak valid.");
    requirePlainObject(data, "Data item");
    if (parent_id) requireUuid(parent_id, "Parent ID");
    if (sprint_id) requireUuid(sprint_id, "Sprint ID");
    if (description !== undefined && description !== null) {
      assert(typeof description === "string" && description.length <= 20000, "Deskripsi terlalu panjang.");
    }

    const insertData = { board_id, group_id: cleanGroupId, title: title.trim(), order_index, data };
    if (parent_id) insertData.parent_id = parent_id;
    if (sprint_id) insertData.sprint_id = sprint_id;
    if (description) insertData.description = description;

    const supabase = createClient();
    const { data: item, error } = await supabase
      .from("board_items")
      .insert(insertData)
      .select()
      .single();

    if (error) throw apiError(error, "Gagal membuat item.", ITEM_ERROR_MESSAGES);

    if (parent_id) notifyActivityChanged(parent_id);
    return item;
  },

  /**
   * Update item. The audit trail is written by the database trigger.
   * @param {string} id - item ID
   * @param {object} updates - fields to update
   */
  async update(id, updates) {
    requireUuid(id, "Item ID");
    const clean = buildItemUpdates(updates);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_items")
      .update(clean)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new Error("Task tidak ditemukan atau kamu tidak punya akses.");
      }
      throw apiError(error, "Gagal update item.", ITEM_ERROR_MESSAGES);
    }

    notifyActivityChanged(id);
    return data;
  },

  /**
   * Hapus item.
   */
  async delete(id) {
    requireUuid(id, "Item ID");
    const supabase = createClient();
    // .select() so RLS-filtered deletes (non-admins) surface as errors
    // instead of silently doing nothing.
    const { data, error } = await supabase.from("board_items").delete().eq("id", id).select("id");
    if (error) throw apiError(error, "Gagal menghapus item.");
    if (!data || data.length === 0) {
      throw new Error("Hanya admin board yang bisa menghapus task.");
    }
  },

  /**
   * Batch reorder — satu RPC atomik untuk semua item dalam satu group.
   */
  async reorder(groupId, orderedIds) {
    const cleanGroupId = groupId !== undefined && groupId !== null ? String(groupId) : "";
    assert(cleanGroupId.length > 0 && cleanGroupId.length <= 100, "Group tidak valid.");
    requireUuidArray(orderedIds, { field: "Daftar item", max: 1000 });

    const supabase = createClient();
    const { error } = await supabase.rpc("reorder_board_items", {
      p_group_id: cleanGroupId,
      p_item_ids: orderedIds,
    });

    if (error) throw apiError(error, "Gagal reorder items.");
  },
};
