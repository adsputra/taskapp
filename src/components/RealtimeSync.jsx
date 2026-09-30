"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * App-wide realtime: one Supabase channel listening to postgres_changes on
 * every table the UI reads, mapped to the React Query caches they feed.
 *
 * postgres_changes is filtered by each table's SELECT policy, so a client
 * only hears about rows it may read. (Broadcast is not — never send row
 * data over broadcast.)
 *
 * Keys are prefixes: ["items"] also refreshes ["items", boardId] and
 * ["items", "recent"]. Only mounted (active) queries refetch.
 */
const TABLE_QUERY_KEYS = {
  boards: [["boards"], ["board"], ["profile-boards"], ["analytics"]],
  board_items: [["items"], ["my-tasks"], ["subtasks"], ["analytics"]],
  board_members: [["boards"], ["board"], ["board-members"]],
  sprints: [["sprints"]],
  notifications: [["notifications"]],
  task_comments: [["comments"]],
  task_activity: [["activity"]],
  task_attachments: [["attachments"]],
  task_time_entries: [["timeEntries"]],
  profiles: [["user"], ["board-members"], ["comments"], ["activity"], ["attachments"], ["timeEntries"]],
};

// Coalesces bursts (a reorder touches many rows) into one refetch per key.
const FLUSH_DELAY_MS = 300;

export default function RealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const pendingKeys = new Map();
    let flushTimer = null;
    let hasSubscribed = false;

    const flush = () => {
      flushTimer = null;
      // Refetching while a local write is in flight could replace its
      // optimistic update with pre-write data; wait for it to settle.
      if (queryClient.isMutating() > 0) {
        flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
        return;
      }
      for (const queryKey of pendingKeys.values()) {
        queryClient.invalidateQueries({ queryKey });
      }
      pendingKeys.clear();
    };

    const scheduleInvalidation = (tables) => {
      for (const table of tables) {
        for (const queryKey of TABLE_QUERY_KEYS[table]) {
          pendingKeys.set(queryKey.join("/"), queryKey);
        }
      }
      if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
    };

    const channel = supabase.channel("app-realtime");
    for (const table of Object.keys(TABLE_QUERY_KEYS)) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () =>
        scheduleInvalidation([table])
      );
    }

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // Events are not replayed after a dropped connection: resync once.
      if (hasSubscribed) scheduleInvalidation(Object.keys(TABLE_QUERY_KEYS));
      hasSubscribed = true;
    });

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
