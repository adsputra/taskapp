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
   * List my tasks across all accessible boards.
   */
  async listMyTasks(userEmail) {
    const supabase = createClient();
    
    // RLS automatically handles board access
    const { data, error } = await supabase
      .from("board_items")
      .select("*, board:boards(title, color)")
      .order("updated_at", { ascending: false });

    if (error) throw new Error("Gagal memuat tugas saya: " + error.message);
    if (!data) return [];

    // Filter by assignee
    return data.filter(item => {
      const owner = item.data?.owner;
      if (!owner) return false;
      if (Array.isArray(owner)) {
        return owner.includes(userEmail);
      }
      return owner === userEmail;
    });
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
   * @param {string} id - item ID
   * @param {object} updates - fields to update
   * @param {object} prevItem - previous item data (for diff logging)
   * @param {Array}  columns - board column definitions (for readable field names)
   */
  async update(id, updates, prevItem, columns) {
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

    // Build column title lookup from column definitions
    const colTitleMap = {};
    if (columns) {
      for (const col of columns) {
        colTitleMap[col.id] = col.title || col.id;
      }
    }

    const getFieldLabel = (key) => {
      // Check built-in fields first
      const builtins = {
        title: "Title",
        description: "Description",
        order_index: "Order",
        group_id: "Group",
      };
      if (builtins[key]) return builtins[key];
      // Use column title if available
      if (colTitleMap[key]) return colTitleMap[key];
      // Fallback: format the key
      return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const formatValue = (val) => {
      if (val === null || val === undefined || val === "") return "empty";
      if (Array.isArray(val)) return val.join(", ") || "empty";
      if (typeof val === "object") return JSON.stringify(val);
      if (typeof val === "boolean") return val ? "Yes" : "No";
      return String(val);
    };

    // Log activity for changed fields
    if (prevItem) {
      const logPromises = [];

      // Check title change
      if (clean.title !== undefined && clean.title !== prevItem.title) {
        logPromises.push(
          activityApi.logFieldChange({
            item_id: id, field_name: "Title",
            old_value: formatValue(prevItem.title),
            new_value: formatValue(clean.title),
          })
        );
      }

      // Check description change
      if (clean.description !== undefined && clean.description !== prevItem.description) {
        logPromises.push(
          activityApi.logFieldChange({
            item_id: id, field_name: "Description",
            old_value: formatValue(prevItem.description),
            new_value: formatValue(clean.description),
          })
        );
      }

      // Check group change
      if (clean.group_id !== undefined && clean.group_id !== prevItem.group_id) {
        logPromises.push(
          activityApi.logFieldChange({
            item_id: id, field_name: "Group",
            old_value: formatValue(prevItem.group_id),
            new_value: formatValue(clean.group_id),
          })
        );
      }

      // Check data field changes (status, priority, owner, etc.)
      if (clean.data) {
        for (const [key, newVal] of Object.entries(clean.data)) {
          const oldVal = prevItem.data?.[key];
          if (formatValue(oldVal) !== formatValue(newVal)) {
            logPromises.push(
              activityApi.logFieldChange({
                item_id: id,
                field_name: getFieldLabel(key),
                old_value: formatValue(oldVal),
                new_value: formatValue(newVal),
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
