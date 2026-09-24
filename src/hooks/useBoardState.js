import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { itemsApi } from "@/lib/api/items";
import { userApi } from "@/lib/api/user";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// Helper to generate temporary IDs
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export function useBoardState(boardId) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Unique client session ID to prevent reacting to self-broadcasts
  const clientIdRef = useRef(null);
  useEffect(() => {
    if (!clientIdRef.current && typeof window !== "undefined") {
      clientIdRef.current = window.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
    }
  }, []);

  const channelRef = useRef(null);

  // Broadcast helper function for instant peer-to-peer websocket notification
  const broadcastChange = useCallback((payload) => {
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "board_change",
          payload: { ...payload, senderId: clientIdRef.current },
        });
      }
    } catch (e) {
      console.warn("Failed to broadcast board change:", e);
    }
  }, []);

  // 1. Data Fetching (React Query with smart caching & window focus refetch)
  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => boardsApi.get(boardId),
    enabled: !!boardId,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", boardId],
    queryFn: () => itemsApi.listByBoard(boardId),
    enabled: !!boardId,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchInterval: 15000, // Background heartbeat polling fallback
  });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = boardLoading || itemsLoading;

  // 2. Realtime Subscription (Supabase Broadcast + Postgres Changes)
  useEffect(() => {
    if (!boardId) return;

    const supabase = createClient();
    const channel = supabase.channel(`board-realtime:${boardId}`, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    // A. Broadcast from other users (ultra-fast peer sync <50ms)
    channel.on(
      "broadcast",
      { event: "board_change" },
      ({ payload }) => {
        if (!payload || (clientIdRef.current && payload.senderId === clientIdRef.current)) return;

        if (payload.type === "items") {
          if (payload.action === "create" && payload.item) {
            queryClient.setQueryData(["items", boardId], (old = []) => {
              if (old.some((i) => i.id === payload.item.id)) return old;
              return [...old, payload.item];
            });
          } else if (payload.action === "update" && payload.item) {
            queryClient.setQueryData(["items", boardId], (old = []) =>
              old.map((i) => (i.id === payload.item.id ? { ...i, ...payload.item } : i))
            );
          } else if (payload.action === "delete" && payload.itemId) {
            queryClient.setQueryData(["items", boardId], (old = []) =>
              old.filter((i) => i.id !== payload.itemId)
            );
          }
          // Invalidate to guarantee full sync with server
          queryClient.invalidateQueries({ queryKey: ["items", boardId] });
        } else if (payload.type === "board") {
          queryClient.invalidateQueries({ queryKey: ["board", boardId] });
        }
      }
    );

    // B. Postgres changes (database-level CDC events)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "board_items",
        filter: `board_id=eq.${boardId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT" && payload.new) {
          queryClient.setQueryData(["items", boardId], (old = []) => {
            if (old.some((i) => i.id === payload.new.id)) return old;
            return [...old, payload.new];
          });
        }
        queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "boards",
        filter: `id=eq.${boardId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "board_members",
        filter: `board_id=eq.${boardId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
        queryClient.invalidateQueries({ queryKey: ["board-members", boardId] });
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, queryClient]);

  // 3. Compute Role
  const userRole = useMemo(() => {
    if (!board || !currentUser) return null;
    if (board.user_id === currentUser.id) return "admin";
    const member = (board.board_members || []).find(
      (m) => m.user_id === currentUser.id && m.status === "active"
    );
    return member?.role || null;
  }, [board, currentUser]);

  // 4. Mutations
  const itemCreate = useMutation({
    mutationFn: (data) => itemsApi.create(data),
    onSuccess: (newItem) => {
      queryClient.setQueryData(["items", boardId], (old = []) => {
        if (old.some((i) => i.id === newItem.id)) return old;
        return [...old, newItem];
      });
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      broadcastChange({ type: "items", action: "create", item: newItem });
    },
    onError: (err) => toast.error(err.message),
  });

  const itemUpdate = useMutation({
    mutationFn: ({ id, updates, prevItem, columns }) => itemsApi.update(id, updates, prevItem, columns),
    onSuccess: (updatedItem) => {
      broadcastChange({ type: "items", action: "update", item: updatedItem });
    },
    onError: (err) => {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    },
  });

  const itemDelete = useMutation({
    mutationFn: (id) => itemsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      broadcastChange({ type: "items", action: "delete", itemId: deletedId });
    },
    onError: (err) => toast.error(err.message),
  });

  const boardUpdate = useMutation({
    mutationFn: ({ id, updates }) => boardsApi.update(id, updates),
    onSuccess: (updatedBoard) => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      broadcastChange({ type: "board", action: "update", board: updatedBoard });
    },
    onError: (err) => toast.error(err.message),
  });

  // 5. URL State Management
  const updateUrlParams = useCallback((updates) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        params.delete(key);
      } else if (Array.isArray(value)) {
        if (value.length === 0) params.delete(key);
        else params.set(key, value.join(","));
      } else {
        params.set(key, value);
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  const currentView = searchParams.get("view") || "table";
  const searchQuery = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "order_index";
  const sortDirection = searchParams.get("dir") || "asc";
  
  const filters = useMemo(() => ({
    status: searchParams.get("status") ? searchParams.get("status").split(",") : [],
    people: searchParams.get("people") ? searchParams.get("people").split(",") : [],
    priority: searchParams.get("priority") ? searchParams.get("priority").split(",") : [],
  }), [searchParams]);

  const hiddenColumns = useMemo(() => {
    const hideParam = searchParams.get("hide");
    return new Set(hideParam ? hideParam.split(",") : []);
  }, [searchParams]);

  // Setters that update URL
  const setCurrentView = (view) => updateUrlParams({ view });
  const setSearchQuery = (search) => updateUrlParams({ search });
  const setSort = (sort, dir) => updateUrlParams({ sort, dir });
  const setFilters = (newFilters) => {
    if (typeof newFilters === "function") {
      newFilters = newFilters(filters);
    }
    updateUrlParams({
      status: newFilters.status,
      people: newFilters.people,
      priority: newFilters.priority,
    });
  };
  const setHiddenColumns = (newHiddenSet) => updateUrlParams({ hide: Array.from(newHiddenSet) });

  // 6. Local State (Modals)
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showPersonFilter, setShowPersonFilter] = useState(false);
  const [showHideMenu, setShowHideMenu] = useState(false);
  const [showGroupByMenu, setShowGroupByMenu] = useState(false);
  const [showNewColumnModal, setShowNewColumnModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Selected task state automatically synced with latest items data
  const [selectedTaskRaw, setSelectedTaskRaw] = useState(null);
  const selectedTask = useMemo(() => {
    if (!selectedTaskRaw) return null;
    const fromItems = items.find((i) => i.id === selectedTaskRaw.id);
    return fromItems ? { ...selectedTaskRaw, ...fromItems } : selectedTaskRaw;
  }, [items, selectedTaskRaw]);

  const setSelectedTask = useCallback((taskOrUpdater) => {
    if (typeof taskOrUpdater === "function") {
      setSelectedTaskRaw((prev) => taskOrUpdater(prev));
    } else {
      setSelectedTaskRaw(taskOrUpdater);
    }
  }, []);

  // 7. Action Handlers
  const handleAddItem = useCallback(async (groupId, title) => {
    if (!boardId || !board) return;
    const maxOrder = Math.max(0, ...items
      .filter((i) => i.group_id === String(groupId))
      .map((i) => i.order_index || 0));

    const defaultData = {};
    (board.columns || []).forEach((col) => {
      if (col.id === "task") return;
      switch (col.type) {
        case "status": defaultData[col.id] = col.options?.choices?.[0]?.label || null; break;
        case "priority": defaultData[col.id] = col.options?.choices?.[0]?.value || null; break;
        case "dropdown": defaultData[col.id] = col.options?.choices?.[0]?.value || null; break;
        case "checkbox": defaultData[col.id] = false; break;
        case "tags": defaultData[col.id] = []; break;
        case "number": defaultData[col.id] = null; break;
        default: defaultData[col.id] = null;
      }
    });

    itemCreate.mutate({
      board_id: boardId,
      group_id: String(groupId),
      title,
      order_index: maxOrder + 1,
      data: defaultData,
    });
  }, [boardId, board, items, itemCreate]);

  const handleUpdateItem = useCallback((itemId, updates, prevItem) => {
    // Optimistic update locally
    queryClient.setQueryData(["items", boardId], (old = []) =>
      old.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
    itemUpdate.mutate({ id: itemId, updates, prevItem, columns: board?.columns });
    if (selectedTask?.id === itemId) {
      setSelectedTask((prev) => prev ? { ...prev, ...updates } : prev);
    }
    // Instant peer broadcast
    broadcastChange({ type: "items", action: "update", item: { id: itemId, ...updates } });
  }, [boardId, queryClient, itemUpdate, selectedTask, board?.columns, broadcastChange, setSelectedTask]);

  const handleDeleteItem = useCallback((itemId) => {
    itemDelete.mutate(itemId);
  }, [itemDelete]);

  const handleReorderItems = useCallback(async (groupId, sourceIdx, destIdx) => {
    const groupItems = items
      .filter((i) => i.group_id === String(groupId))
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    if (sourceIdx < 0 || sourceIdx >= groupItems.length ||
        destIdx < 0 || destIdx >= groupItems.length) return;

    const [moved] = groupItems.splice(sourceIdx, 1);
    groupItems.splice(destIdx, 0, moved);

    const reordered = groupItems.map((item, idx) => ({
      ...item,
      order_index: idx,
    }));

    queryClient.setQueryData(["items", boardId], (old = []) => {
      const other = old.filter((i) => i.group_id !== String(groupId));
      return [...other, ...reordered].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    });

    try {
      await itemsApi.reorder(groupId, reordered.map((i) => i.id));
      broadcastChange({ type: "items", action: "reorder", groupId });
    } catch (err) {
      toast.error("Gagal reorder: " + err.message);
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    }
  }, [boardId, items, queryClient, broadcastChange]);

  const handleAddColumn = useCallback((colData) => {
    if (!board) return;
    const newCol = { ...colData, id: colData.id || genId(), width: colData.width || 150 };
    const updated = [...(board.columns || []), newCol];
    boardUpdate.mutate({ id: board.id, updates: { columns: updated } });
    setShowNewColumnModal(false);
  }, [board, boardUpdate]);

  const handleUpdateColumn = useCallback((colId, data) => {
    if (!board) return;
    const updated = (board.columns || []).map((c) =>
      c.id === colId ? { ...c, ...data } : c
    );
    boardUpdate.mutate({ id: board.id, updates: { columns: updated } });
  }, [board, boardUpdate]);

  const handleDeleteColumn = useCallback((colId) => {
    if (!board) return;
    const updated = (board.columns || []).filter((c) => c.id !== colId);
    boardUpdate.mutate({ id: board.id, updates: { columns: updated } });
  }, [board, boardUpdate]);

  const handleAddGroup = useCallback((groupData) => {
    if (!board) return;
    const newGroup = { ...groupData, id: genId(), collapsed: false };
    boardUpdate.mutate({ id: board.id, updates: { groups: [...(board.groups || []), newGroup] } });
    setShowNewGroupModal(false);
  }, [board, boardUpdate]);

  const handleDeleteGroup = useCallback((groupId) => {
    if (!board || !window.confirm("Hapus group ini beserta semua task di dalamnya?")) return;
    const updated = (board.groups || []).filter((g) => g.id !== groupId);
    boardUpdate.mutate({ id: board.id, updates: { groups: updated } });
    items.filter((i) => i.group_id === String(groupId)).forEach((i) => itemDelete.mutate(i.id));
  }, [board, boardUpdate, items, itemDelete]);

  const handleHideColumnFromGroup = useCallback((groupId, colId) => {
    if (!board) return;
    const updated = (board.groups || []).map((g) => {
      if (g.id !== groupId) return g;
      const visible = g.visible_columns || (board.columns || []).map((c) => c.id);
      return { ...g, visible_columns: visible.filter((id) => id !== colId) };
    });
    boardUpdate.mutate({ id: board.id, updates: { groups: updated } });
  }, [board, boardUpdate]);

  return {
    board,
    items,
    isLoading,
    userRole,
    
    currentView, setCurrentView,
    searchQuery, setSearchQuery,
    sortBy, sortDirection, setSort,
    filters, setFilters,
    hiddenColumns, setHiddenColumns,

    selectedItems, setSelectedItems,
    showNewTaskModal, setShowNewTaskModal,
    showFilterPanel, setShowFilterPanel,
    showSortMenu, setShowSortMenu,
    showPersonFilter, setShowPersonFilter,
    showHideMenu, setShowHideMenu,
    showGroupByMenu, setShowGroupByMenu,
    showNewColumnModal, setShowNewColumnModal,
    showNewGroupModal, setShowNewGroupModal,
    showAnalytics, setShowAnalytics,
    showIntegrations, setShowIntegrations,
    showAutomations, setShowAutomations,
    showShare, setShowShare,
    selectedTask, setSelectedTask,

    handleAddItem,
    handleUpdateItem,
    handleDeleteItem,
    handleReorderItems,
    handleAddColumn,
    handleUpdateColumn,
    handleDeleteColumn,
    handleAddGroup,
    handleDeleteGroup,
    handleHideColumnFromGroup,
  };
}
