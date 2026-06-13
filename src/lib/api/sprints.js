/**
 * Sprints API — CRUD for sprints + moving items between sprints.
 */
import { createClient } from "@/lib/supabase/client";

export const sprintsApi = {
  /**
   * List all sprints for a board, newest first.
   */
  async listByBoard(boardId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to load sprints: " + error.message);
    return data || [];
  },

  /**
   * Get the active sprint for a board.
   */
  async getActive(boardId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .select("*")
      .eq("board_id", boardId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error("Failed to load active sprint: " + error.message);
    return data;
  },

  /**
   * Create a new sprint.
   */
  async create({ board_id, title, start_date, end_date }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .insert({ board_id, title, start_date, end_date })
      .select()
      .single();

    if (error) throw new Error("Failed to create sprint: " + error.message);
    return data;
  },

  /**
   * Update a sprint (title, dates, status).
   */
  async update(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error("Failed to update sprint: " + error.message);
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
   * Delete a sprint. Items in this sprint will have sprint_id set to null.
   */
  async delete(id) {
    const supabase = createClient();

    // Unassign items from this sprint first
    await supabase
      .from("board_items")
      .update({ sprint_id: null })
      .eq("sprint_id", id);

    const { error } = await supabase.from("sprints").delete().eq("id", id);
    if (error) throw new Error("Failed to delete sprint: " + error.message);
  },

  /**
   * Move items into a sprint.
   */
  async assignItems(sprintId, itemIds) {
    const supabase = createClient();
    const updates = itemIds.map((itemId) =>
      supabase
        .from("board_items")
        .update({ sprint_id: sprintId })
        .eq("id", itemId)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error).map((r) => r.error);
    if (errors.length > 0) {
      throw new Error("Failed to assign items: " + errors.map((e) => e.message).join(", "));
    }
  },

  /**
   * Remove items from a sprint (back to backlog).
   */
  async unassignItems(itemIds) {
    const supabase = createClient();
    const updates = itemIds.map((itemId) =>
      supabase
        .from("board_items")
        .update({ sprint_id: null })
        .eq("id", itemId)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error).map((r) => r.error);
    if (errors.length > 0) {
      throw new Error("Failed to unassign items: " + errors.map((e) => e.message).join(", "));
    }
  },
};
