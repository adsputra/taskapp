/**
 * Analytics API — server-side aggregation via the get_analytics RPC.
 * No task rows are shipped to the browser; the database computes counts.
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { requireUuid } from "@/lib/validation";

const EMPTY_SUMMARY = {
  totals: {
    totalTasks: 0,
    completedTasks: 0,
    completionRate: 0,
    overdueTasks: 0,
    activeBoards: 0,
  },
  statusDistribution: [],
  boardStats: [],
};

export const analyticsApi = {
  /**
   * @param {{ boardId?: string|null, days?: number }} params
   */
  async summary({ boardId = null, days = 30 } = {}) {
    const safeDays = Math.min(Math.max(Number(days) || 30, 1), 3650);
    if (boardId) requireUuid(boardId, "Board ID");

    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_analytics", {
      p_board_id: boardId,
      p_days: safeDays,
    });

    if (error) throw apiError(error, "Gagal memuat analytics.");

    return {
      ...EMPTY_SUMMARY,
      ...(data || {}),
      totals: { ...EMPTY_SUMMARY.totals, ...(data?.totals || {}) },
    };
  },
};
