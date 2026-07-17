import { useState, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { itemsApi } from "@/lib/api/items";
import { userApi } from "@/lib/api/user";
import { toast } from "sonner";

// Helper to generate temporary IDs
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export function useBoardState(boardId) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // 1. Data Fetching (React Query)
  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => boardsApi.get(boardId),
    enabled: !!boardId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", boardId],
    queryFn: () => itemsApi.listByBoard(boardId),
    enabled: !!boardId,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = boardLoading || itemsLoading;

  // 2. Compute Role
  const userRole = useMemo(() => {
    if (!board || !currentUser) return null;
    if (board.user_id === currentUser.id) return "admin";
    const member = (board.board_members || []).find(
      (m) => m.user_id === currentUser.id && m.status === "active"
    );
    return member?.role || null;
  }, [board, currentUser]);

  // 3. Mutations
  const itemCreate = useMutation({
    mutationFn: (data) => itemsApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items", boardId] }),
    onError: (err) => toast.error(err.message),
  });

  const itemUpdate = useMutation({
    mutationFn: ({ id, updates, prevItem, columns }) => itemsApi.update(id, updates, prevItem, columns),
    onError: (err, variables, context) => {
      toast.error(err.message);
      // Revert optimistic update on error if needed
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    },
  });

  const itemDelete = useMutation({
    mutationFn: (id) => itemsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items", boardId] }),
    onError: (err) => toast.error(err.message),
  });

  const boardUpdate = useMutation({
    mutationFn: ({ id, updates }) => boardsApi.update(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
    onError: (err) => toast.error(err.message),
  });

  // 4. URL State Management
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
    // If it's a function (like previous state update), we need to resolve it
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

  // 5. Local State (Modals)
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
  const [selectedTask, setSelectedTask] = useState(null);

  // 6. Action Handlers
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
    // Optimistic update
    queryClient.setQueryData(["items", boardId], (old = []) =>
      old.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
    itemUpdate.mutate({ id: itemId, updates, prevItem, columns: board?.columns });
    if (selectedTask?.id === itemId) {
      setSelectedTask((prev) => prev ? { ...prev, ...updates } : prev);
    }
  }, [boardId, queryClient, itemUpdate, selectedTask, board?.columns]);

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
    } catch (err) {
      toast.error("Gagal reorder: " + err.message);
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    }
  }, [boardId, items, queryClient]);

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
    // Data
    board,
    items,
    isLoading,
    userRole,
    
    // URL States
    currentView, setCurrentView,
    searchQuery, setSearchQuery,
    sortBy, sortDirection, setSort,
    filters, setFilters,
    hiddenColumns, setHiddenColumns,

    // Local States
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

    // Actions
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
