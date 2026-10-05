/**
 * Board automations — switches for the recipes implemented by database
 * triggers (supabase/schema.sql §9b). Only board admins can change them.
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { AUTOMATION_RECIPES, requireEnum, requireUuid } from "@/lib/validation";

export const automationsApi = {
  async list(boardId) {
    requireUuid(boardId, "Board ID");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_automations")
      .select("recipe, enabled, updated_at, updated_by")
      .eq("board_id", boardId);

    if (error) throw apiError(error, "Gagal memuat automations.");
    return data || [];
  },

  async set(boardId, recipe, enabled) {
    requireUuid(boardId, "Board ID");
    requireEnum(recipe, AUTOMATION_RECIPES, "Automation");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_board_automation", {
      p_board_id: boardId,
      p_recipe: recipe,
      p_enabled: Boolean(enabled),
    });

    if (error) {
      throw apiError(error, "Gagal mengubah automation.", {
        "42501": "Hanya admin board yang bisa mengubah automations.",
      });
    }
    return data;
  },

  /** { cron: boolean } — whether scheduled recipes can run. */
  async capabilities() {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_automation_capabilities");
    if (error) throw apiError(error, "Gagal memuat kemampuan automation.");
    return data || { cron: false };
  },
};
