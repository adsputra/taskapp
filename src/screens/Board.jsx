"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { itemsApi } from "@/lib/api/items";
import { userApi } from "@/lib/api/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Filter, Users, ArrowLeft,
  SortAsc, Eye, EyeOff, Group as GroupIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import BoardHeader from "../components/board/BoardHeader";
import GroupSection from "../components/board/GroupSection";
import NewTaskModal from "../components/board/NewTaskModal";
import FilterPanel from "../components/board/FilterPanel";
import SortMenu from "../components/board/SortMenu";
import PersonFilter from "../components/board/PersonFilter";
import HideMenu from "../components/board/HideMenu";
import GroupByMenu from "../components/board/GroupByMenu";
import NewColumnModal from "../components/board/NewColumnModal";
import NewGroupModal from "../components/board/NewGroupModal";
import KanbanView from "../components/board/view/KanbanView";
import CalendarView from "../components/board/view/CalendarView";
import TimelineView from "../components/board/view/TimelineView";
import SprintView from "../components/board/view/SprintView";
import AnalyticsPanel from "../components/board/analytics/AnalyticsPanel";
import IntegrationsPanel from "../components/board/intregations/IntegrationsPanel";
import AutomationsPanel from "../components/board/automations/AutomationsPanel";
import ShareBoardModal from "../components/board/ShareBoardModal";
import MemberAvatars from "../components/board/MemberAvatars";
import TaskDetailDrawer from "../components/board/drawer/TaskDetailDrawer";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function BoardPage({ boardId }) {
  const queryClient = useQueryClient();

  // --- Queries ---
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

  const isLoading = boardLoading || itemsLoading;

  // --- Current user & role ---
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 60 * 1000,
  });

  const userRole = useMemo(() => {
    if (!board || !currentUser) return null;
    // Owner is always admin
    if (board.user_id === currentUser.id) return "admin";
    // Check board_members
    const member = (board.board_members || []).find(
      (m) => m.user_id === currentUser.id && m.status === "active"
    );
    return member?.role || null;
  }, [board, currentUser]);

  // --- Mutations ---
  const itemCreate = useMutation({
    mutationFn: (data) => itemsApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items", boardId] }),
    onError: (err) => toast.error(err.message),
  });

  const itemUpdate = useMutation({
    mutationFn: ({ id, updates, prevItem }) => itemsApi.update(id, updates, prevItem),
    onError: (err) => toast.error(err.message),
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

  // --- Local state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [currentView, setCurrentView] = useState("table");
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
  const [filters, setFilters] = useState({ status: [], people: [], priority: [] });
  const [sortBy, setSortBy] = useState("order_index");
  const [sortDirection, setSortDirection] = useState("asc");
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  const [selectedTask, setSelectedTask] = useState(null);

  // --- Handlers ---
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
    itemUpdate.mutate({ id: itemId, updates, prevItem });
    // Also update selectedTask if it's the one being edited
    if (selectedTask?.id === itemId) {
      setSelectedTask((prev) => prev ? { ...prev, ...updates } : prev);
    }
  }, [boardId, queryClient, itemUpdate, selectedTask]);

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

    // Optimistic
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
    // Hapus semua item di group
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

  // --- Filter & sort ---
  const filteredItems = items.filter((item) => {
    // Hide subtasks from the main board view
    if (item.parent_id) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filters.status.length && !filters.status.includes(item.data?.status)) return false;
    if (filters.people.length && !filters.people.includes(item.data?.owner)) return false;
    if (filters.priority.length && !filters.priority.includes(item.data?.priority)) return false;
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    let aV = a[sortBy] ?? a.data?.[sortBy] ?? "";
    let bV = b[sortBy] ?? b.data?.[sortBy] ?? "";
    if (sortDirection === "desc") [aV, bV] = [bV, aV];
    return typeof aV === "string" ? String(aV).localeCompare(String(bV)) : (aV > bV ? 1 : -1);
  });

  const groupedItems = (board?.groups || []).reduce((acc, g) => {
    acc[g.id] = sortedItems.filter((i) => String(i.group_id) === String(g.id));
    return acc;
  }, {});

  const visibleColumns = (board?.columns || []).filter((c) => !hiddenColumns.has(c.id));

  // --- Render ---
  if (isLoading && !board) {
    return (
      <div className="p-8 bg-[#F5F6F8] dark:bg-slate-950 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0073EA]" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="p-8 bg-[#F5F6F8] dark:bg-slate-950 min-h-screen text-center py-16">
        <h2 className="text-2xl font-bold text-[#323338] dark:text-slate-200 mb-4">Board not found</h2>
        <Link href="/boards">
          <Button className="bg-[#0073EA] text-white rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Boards
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F6F8] dark:bg-slate-950 min-h-screen transition-colors duration-300">
      <div className="max-w-full">
        <div className="sticky top-0 z-20 bg-[#F5F6F8] dark:bg-slate-950 pb-4">
          <BoardHeader board={board} items={items} itemsCount={items.length}
            selectedCount={selectedItems.size} currentView={currentView}
            onViewChange={setCurrentView}
            onShowAnalytics={() => setShowAnalytics(true)}
            onShowIntegrations={() => setShowIntegrations(true)}
            onShowAutomations={() => setShowAutomations(true)}
            onShowShare={() => setShowShare(true)} />
        </div>

        <div className="px-3 sm:px-6 py-4 sm:py-6">
          {currentView === "table" && (
            <>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6 bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 shadow-sm dark:shadow-none border border-[#E1E5F3] dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 flex-1">
                  <Button
                    onClick={() => userRole === "admin" && setShowNewTaskModal(true)}
                    disabled={userRole !== "admin"}
                    title={userRole !== "admin" ? "Only admin can add tasks" : ""}
                    className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg h-10 px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">New Task</span><span className="sm:hidden">New</span>
                  </Button>
                  <div className="relative flex-1 sm:flex-none min-w-[120px] sm:min-w-0">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#676879] dark:text-slate-500" />
                    <Input placeholder="Search" value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-full sm:w-64 bg-[#F5F6F8] dark:bg-slate-800 dark:text-slate-200 border-none rounded-lg h-10" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-[#E1E5F3] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        onClick={() => setShowPersonFilter(!showPersonFilter)}>
                        <Users className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Person</span>
                        {filters.people.length > 0 && (
                          <Badge className="ml-2 bg-[#0073EA] text-white rounded-full w-5 h-5 text-xs p-0 flex items-center justify-center">
                            {filters.people.length}
                          </Badge>
                        )}
                      </Button>
                    {showPersonFilter && (
                      <PersonFilter items={items} selectedPeople={filters.people}
                        onChange={(p) => setFilters((f) => ({ ...f, people: p }))}
                        onClose={() => setShowPersonFilter(false)} />
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-[#E1E5F3] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => setShowFilterPanel(!showFilterPanel)}>
                      <Filter className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Filter</span>
                    </Button>
                    {showFilterPanel && (
                      <FilterPanel filters={filters} onChange={setFilters}
                        onClose={() => setShowFilterPanel(false)} board={board} />
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-[#E1E5F3] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => setShowSortMenu(!showSortMenu)}>
                      <SortAsc className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Sort</span>
                    </Button>
                    {showSortMenu && (
                      <SortMenu sortBy={sortBy} sortDirection={sortDirection}
                        columns={board.columns}
                        onChange={(f, d) => { setSortBy(f); setSortDirection(d); }}
                        onClose={() => setShowSortMenu(false)} />
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-[#E1E5F3] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => setShowHideMenu(!showHideMenu)}>
                      {hiddenColumns.size > 0 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} <span className="hidden sm:inline ml-2">Hide</span>
                    </Button>
                    {showHideMenu && (
                      <HideMenu columns={board.columns} hiddenColumns={hiddenColumns}
                        onChange={setHiddenColumns} onClose={() => setShowHideMenu(false)} />
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-[#E1E5F3] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => setShowGroupByMenu(!showGroupByMenu)}>
                      <GroupIcon className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Group by</span>
                    </Button>
                    {showGroupByMenu && (
                      <GroupByMenu columns={board.columns}
                        onChange={setShowGroupByMenu} onClose={() => setShowGroupByMenu(false)} />
                    )}
                  </div>
                  </div>
                </div>
                <MemberAvatars
                  members={board?.board_members}
                  boardOwnerId={board?.user_id}
                  className="hidden sm:block"
                />
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-none border border-[#E1E5F3] dark:border-slate-800">
                {(board.groups || []).map((group) => (
                  <GroupSection key={group.id} group={group}
                    items={groupedItems[group.id] || []} columns={visibleColumns}
                    onAddItem={handleAddItem} onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem} onReorderItems={handleReorderItems}
                    onUpdateColumn={handleUpdateColumn} onDeleteColumn={handleDeleteColumn}
                    onAddColumn={() => setShowNewColumnModal(true)}
                    isLoading={isLoading && items.length === 0}
                    selectedItems={selectedItems}
                    onSelectItem={(itemId, selected) => {
                      const next = new Set(selectedItems);
                      selected ? next.add(itemId) : next.delete(itemId);
                      setSelectedItems(next);
                    }}
                    onDeleteGroup={handleDeleteGroup}
                    onHideColumnFromGroup={handleHideColumnFromGroup}
                    boardId={boardId}
                    userRole={userRole}
                    onSelectTask={setSelectedTask} />
                ))}
                {(!board.groups || board.groups.length === 0) && !isLoading && (
                  <div className="p-8 text-center text-[#676879] dark:text-slate-400">
                    <h3 className="text-xl font-medium mb-2">No groups yet!</h3>
                    <p className="mb-4">Add your first group to organize tasks.</p>
                    <Button
                      onClick={() => userRole === "admin" && setShowNewGroupModal(true)}
                      disabled={userRole !== "admin"}
                      title={userRole !== "admin" ? "Only admin can add groups" : ""}
                      className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg h-10 px-4 disabled:opacity-50 disabled:cursor-not-allowed">
                      <Plus className="w-4 h-4 mr-2" /> Add First Group
                    </Button>
                  </div>
                )}
                <div className="p-4 border-t border-[#E1E5F3] dark:border-slate-800">
                  <Button
                    variant="outline"
                    onClick={() => userRole === "admin" && setShowNewGroupModal(true)}
                    disabled={userRole !== "admin"}
                    title={userRole !== "admin" ? "Only admin can add groups" : ""}
                    className="w-full border-dashed border-[#0073EA] text-[#0073EA] hover:bg-[#0073EA]/10 rounded-lg h-10 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4 mr-2" /> Add New Group
                  </Button>
                </div>
              </div>
            </>
          )}

          {currentView === "kanban" && (
            <KanbanView board={board} items={sortedItems}
              onAddItem={handleAddItem} onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem} onReorderItems={handleReorderItems}
              onSelectTask={setSelectedTask} />
          )}
          {currentView === "calendar" && (
            <CalendarView board={board} items={sortedItems}
              onAddItem={handleAddItem} onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem} />
          )}
          {currentView === "timeline" && (
            <TimelineView board={board} items={sortedItems}
              onAddItem={handleAddItem} onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem} />
          )}
          {currentView === "sprint" && (
            <SprintView board={board} items={sortedItems} boardId={boardId}
              userRole={userRole} onSelectTask={setSelectedTask}
              onUpdateItem={handleUpdateItem} />
          )}
        </div>

        {/* Modals */}
        <NewTaskModal isOpen={showNewTaskModal} onClose={() => setShowNewTaskModal(false)}
          board={board} onSubmit={handleAddItem} />
        <NewColumnModal isOpen={showNewColumnModal} onClose={() => setShowNewColumnModal(false)}
          onSubmit={handleAddColumn} />
        <NewGroupModal isOpen={showNewGroupModal} onClose={() => setShowNewGroupModal(false)}
          onSubmit={handleAddGroup} />

        {/* Panels */}
        {showAnalytics && <AnalyticsPanel board={board} items={items} onClose={() => setShowAnalytics(false)} />}
        {showIntegrations && <IntegrationsPanel board={board} onClose={() => setShowIntegrations(false)} />}
        {showAutomations && <AutomationsPanel board={board} onClose={() => setShowAutomations(false)} />}
        {showShare && <ShareBoardModal isOpen={showShare} onClose={() => setShowShare(false)} board={board} />}

        {/* Task Detail Drawer */}
        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            board={board}
            boardId={boardId}
            userRole={userRole}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdateItem}
            onDelete={(id) => {
              handleDeleteItem(id);
              setSelectedTask(null);
            }}
            allItems={items}
          />
        )}
      </div>
    </div>
  );
}
