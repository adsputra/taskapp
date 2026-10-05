import { useState, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { itemsApi } from "@/lib/api/items";
import { userApi } from "@/lib/api/user";
import { toast } from "sonner";

// Ids for new columns/groups (entries inside boards.columns/groups).
const genId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export function useBoardState(boardId) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

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
  });

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = boardLoading || itemsLoading;

  // 2. Realtime: handled app-wide by <RealtimeSync /> (postgres_changes, RLS-filtered).

  // 3. Compute Role
  const userRole = useMemo(() => {
    if (!board || !currentUser) return null;
    if (board.user_id === currentUser.id) return "admin";
    const member = (board.board_members || []).find(
      (m) => m.user_id === currentUser.id && m.status === "active"
    );
    return member?.role || null;
  }, [board, currentUser]);
  // Mirrors RLS: editors create/edit tasks, admins also delete tasks and
  // change the board layout (columns, groups, automations).
  const canEdit = userRole === "admin" || userRole === "editor";
  const canAdmin = userRole === "admin";

  // 4. Mutations
  const itemCreate = useMutation({
    mutationFn: (data) => itemsApi.create(data),
    onSuccess: (newItem) => {
      queryClient.setQueryData(["items", boardId], (old = []) => {
        if (old.some((i) => i.id === newItem.id)) return old;
        return [...old, newItem];
      });
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    },
    onError: (err) => toast.error(err.message),
  });

  const itemUpdate = useMutation({
    mutationFn: ({ id, updates }) => itemsApi.update(id, updates),
    onError: (err) => {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    },
  });

  const itemDelete = useMutation({
    mutationFn: (id) => itemsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    },
    onError: (err) => toast.error(err.message),
  });

  // One column/group change at a time, merged by the database against the
  // latest board — concurrent edits by other people are never overwritten.
  const listPatch = useMutation({
    mutationFn: ({ list, op, entryId, value }) =>
      boardsApi.patchList(boardId, list, op, entryId, value),
    onSuccess: (updated, { list, op }) => {
      queryClient.setQueryData(["board", boardId], (old) =>
        old ? { ...old, columns: updated.columns, groups: updated.groups } : old
      );
      if (list === "groups" && op === "delete") {
        queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      }
    },
    onError: (err) => {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
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

  // The open task lives in the URL (?task=<id>) so it can be linked to from
  // notifications and the command palette, and survives a reload.
  const selectedTaskId = searchParams.get("task");

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
  const [showAutomations, setShowAutomations] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Selected task is always the live row from the items cache.
  const selectedTask = useMemo(
    () => (selectedTaskId ? items.find((i) => i.id === selectedTaskId) || null : null),
    [items, selectedTaskId]
  );

  const setSelectedTask = useCallback(
    (task) => updateUrlParams({ task: task?.id || null }),
    [updateUrlParams]
  );

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

  const handleUpdateItem = useCallback((itemId, updates) => {
    // Optimistic update locally; the drawer reads from the same cache.
    queryClient.setQueryData(["items", boardId], (old = []) =>
      old.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
    itemUpdate.mutate({ id: itemId, updates });
  }, [boardId, queryClient, itemUpdate]);

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
    const { id, ...rest } = colData;
    listPatch.mutate({
      list: "columns",
      op: "add",
      entryId: id || genId(),
      value: { ...rest, width: rest.width || 150 },
    });
    setShowNewColumnModal(false);
  }, [board, listPatch]);

  const handleUpdateColumn = useCallback((colId, data) => {
    if (!board) return;
    listPatch.mutate({ list: "columns", op: "update", entryId: colId, value: data });
  }, [board, listPatch]);

  const handleDeleteColumn = useCallback((colId) => {
    if (!board) return;
    listPatch.mutate({ list: "columns", op: "delete", entryId: colId });
  }, [board, listPatch]);

  const handleAddGroup = useCallback((groupData) => {
    if (!board) return;
    listPatch.mutate({
      list: "groups",
      op: "add",
      entryId: genId(),
      value: { ...groupData, collapsed: false },
    });
    setShowNewGroupModal(false);
  }, [board, listPatch]);

  const handleDeleteGroup = useCallback((groupId) => {
    if (!board || !window.confirm("Hapus group ini beserta semua task di dalamnya?")) return;
    // The RPC deletes the group's tasks in the same transaction.
    listPatch.mutate({ list: "groups", op: "delete", entryId: String(groupId) });
  }, [board, listPatch]);

  const handleHideColumnFromGroup = useCallback((groupId, colId) => {
    if (!board) return;
    const group = (board.groups || []).find((g) => g.id === groupId);
    if (!group) return;
    const visible = group.visible_columns || (board.columns || []).map((c) => c.id);
    listPatch.mutate({
      list: "groups",
      op: "update",
      entryId: groupId,
      value: { visible_columns: visible.filter((id) => id !== colId) },
    });
  }, [board, listPatch]);

  return {
    board,
    items,
    isLoading,
    userRole,
    canEdit,
    canAdmin,

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
