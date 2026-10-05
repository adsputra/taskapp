/**
 * Workspace search for the command palette. Runs as the caller, so RLS
 * limits results to boards and tasks they can read.
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { clampLimit } from "@/lib/validation";

export const MIN_SEARCH_LENGTH = 2;

export const searchApi = {
  async search(query, { limit } = {}) {
    const term = typeof query === "string" ? query.trim().slice(0, 100) : "";
    if (term.length < MIN_SEARCH_LENGTH) return { boards: [], items: [] };

    const supabase = createClient();
    const { data, error } = await supabase.rpc("search_workspace", {
      p_query: term,
      p_limit: clampLimit(limit, { defaultLimit: 8, maxLimit: 25 }),
    });

    if (error) throw apiError(error, "Pencarian gagal.");
    return { boards: data?.boards || [], items: data?.items || [] };
  },
};
