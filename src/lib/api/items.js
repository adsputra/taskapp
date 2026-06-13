/**
 * Items API — semua operasi CRUD untuk board_items.
 * v2 — added activity logging, subtask support, sprint filtering.
 */
import { createClient } from "@/lib/supabase/client";
import { activityApi } from "./activity";

export const itemsApi = {
  /**
   * List item untuk satu board atau semua board user.
   */
  async list({ boardId, sort = "-updated_at", limit, sprintId, parentId } = {}) {
    const supabase = createClient();
    const isDesc = sort.startsWith("-");
    const field = isDesc ? sort.slice(1) : sort;

    let query = supabase.from("board_items").select("*").order(field, { ascending: !isDesc });

    if (boardId) query = query.eq("board_id", boardId);
    if (sprintId) query = query.eq("sprint_id", sprintId);
    if (parentId !== undefined) {
      query = parentId === null
        ? query.is("parent_id", null)
        : query.eq("parent_id", parentId);
    }
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error("Gagal memuat items: " + error.message);
    return data || [];
  },

  /**
   * List items untuk satu board, urut by order_index.
   */
  async listByBoard(boardId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_items")
      .select("*")
      .eq("board_id", boardId)
      .order("order_index", { ascending: true });

    if (error) throw new Error("Gagal memuat items: " + error.message);
    return data || [];
  },

  /**
   * List subtasks for a parent item.
   */
  async listSubtasks(parentId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_items")
      .select("*")
      .eq("parent_id", parentId)
      .order("order_index", { ascending: true });

    if (error) throw new Error("Failed to load subtasks: " + error.message);
    return data || [];
  },

  /**
   * Buat item baru.
   */
  async create({ board_id, group_id, title, order_index = 0, data = {}, parent_id, sprint_id, description }) {
    const supabase = createClient();

    const insertData = { board_id, group_id: String(group_id), title, order_index, data };
    if (parent_id) insertData.parent_id = parent_id;
    if (sprint_id) insertData.sprint_id = sprint_id;
    if (description) insertData.description = description;

    const { data: item, error } = await supabase
      .from("board_items")
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error("Gagal membuat item: " + error.message);

    // Log activity
    activityApi.log({ item_id: item.id, action: "created", new_value: title }).catch(() => {});

    return item;
  },

  /**
   * Update item with activity logging.
   * Accepts optional `prevData` to compare old vs new values for logging.
   */
  async update(id, updates, prevItem) {
    const supabase = createClient();

    const clean = { ...updates };
    delete clean.id;
    delete clean.board_id;
    delete clean.created_at;

    const { data, error } = await supabase
      .from("board_items")
      .update(clean)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error("Gagal update item: " + error.message);

    // Log activity for changed fields
    if (prevItem) {
      const logPromises = [];

      // Check title change
      if (clean.title !== undefined && clean.title !== prevItem.title) {
        logPromises.push(
          activityApi.logFieldChange({
            item_id: id, field_name: "title",
            old_value: prevItem.title, new_value: clean.title,
          })
        );
      }

      // Check description change
      if (clean.description !== undefined && clean.description !== prevItem.description) {
        logPromises.push(
          activityApi.logFieldChange({
            item_id: id, field_name: "description",
            old_value: prevItem.description || "", new_value: clean.description,
          })
        );
      }

      // Check data field changes (status, priority, owner, etc.)
      if (clean.data) {
        for (const [key, newVal] of Object.entries(clean.data)) {
          const oldVal = prevItem.data?.[key];
          if (String(oldVal ?? "") !== String(newVal ?? "")) {
            logPromises.push(
              activityApi.logFieldChange({
                item_id: id, field_name: key,
                old_value: oldVal ?? "", new_value: newVal,
              })
            );
          }
        }
      }

      // Fire all logs in parallel (don't block the response)
      Promise.all(logPromises).catch(() => {});
    }

    return data;
  },

  /**
   * Hapus item.
   */
  async delete(id) {
    const supabase = createClient();

    // Log activity before deletion (we need the item title)
    const { data: item } = await supabase
      .from("board_items")
      .select("id, title")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("board_items").delete().eq("id", id);
    if (error) throw new Error("Gagal menghapus item: " + error.message);

    if (item) {
      activityApi.log({ item_id: id, action: "deleted", old_value: item.title }).catch(() => {});
    }
  },

  /**
   * Batch reorder — update order_index untuk banyak item sekaligus.
   */
  async reorder(groupId, orderedIds) {
    const supabase = createClient();
    const updates = orderedIds.map((id, index) =>
      supabase.from("board_items").update({ order_index: index }).eq("id", id)
    );
    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error).map((r) => r.error);
    if (errors.length > 0) {
      throw new Error("Gagal reorder items: " + errors.map((e) => e.message).join(", "));
    }
  },
};
