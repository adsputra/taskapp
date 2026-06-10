/**
 * Items API — semua operasi CRUD untuk board_items.
 */
import { createClient } from "@/lib/supabase/client";

export const itemsApi = {
  /**
   * List item untuk satu board atau semua board user.
   */
  async list({ boardId, sort = "-updated_at", limit } = {}) {
    const supabase = createClient();
    const isDesc = sort.startsWith("-");
    const field = isDesc ? sort.slice(1) : sort;

    let query = supabase.from("board_items").select("*").order(field, { ascending: !isDesc });

    if (boardId) query = query.eq("board_id", boardId);
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
   * Buat item baru.
   */
  async create({ board_id, group_id, title, order_index = 0, data = {} }) {
    const supabase = createClient();

    const { data: item, error } = await supabase
      .from("board_items")
      .insert({ board_id, group_id: String(group_id), title, order_index, data })
      .select()
      .single();

    if (error) throw new Error("Gagal membuat item: " + error.message);
    return item;
  },

  /**
   * Update item.
   */
  async update(id, updates) {
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
    return data;
  },

  /**
   * Hapus item.
   */
  async delete(id) {
    const supabase = createClient();
    const { error } = await supabase.from("board_items").delete().eq("id", id);
    if (error) throw new Error("Gagal menghapus item: " + error.message);
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
