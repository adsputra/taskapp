"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Filter, Users, ArrowLeft,
  SortAsc, Eye, EyeOff, Group as GroupIcon,
} from "lucide-react";
import Link from "next/link";
import { useBoardState } from "@/hooks/useBoardState";

import BoardHeader from "../components/board/BoardHeader";
import GroupSection from "../components/board/GroupSection";
import NewTaskModal from "../components/board/NewTaskModal";
import FilterPanel from "../components/board/FilterPanel";
import SortMenu from "../components/board/SortMenu";
import PersonFilter, { itemAssignees } from "../components/board/PersonFilter";
import HideMenu from "../components/board/HideMenu";
import GroupByMenu from "../components/board/GroupByMenu";
import NewColumnModal from "../components/board/NewColumnModal";
import NewGroupModal from "../components/board/NewGroupModal";
import KanbanView from "../components/board/view/KanbanView";
import CalendarView from "../components/board/view/CalendarView";
import TimelineView from "../components/board/view/TimelineView";
import SprintView from "../components/board/view/SprintView";
import AnalyticsPanel from "../components/board/analytics/AnalyticsPanel";
import AutomationsPanel from "../components/board/automations/AutomationsPanel";
import ShareBoardModal from "../components/board/ShareBoardModal";
import MemberAvatars from "../components/board/MemberAvatars";
import TaskDetailDrawer from "../components/board/drawer/TaskDetailDrawer";

export default function BoardPage({ boardId }) {
  const {
    board, items, isLoading, userRole, canEdit, canAdmin,
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
    handleAddItem, handleUpdateItem, handleDeleteItem, handleReorderItems,
    handleAddColumn, handleUpdateColumn, handleDeleteColumn,
    handleAddGroup, handleDeleteGroup, handleHideColumnFromGroup,
  } = useBoardState(boardId);

  // --- Filter & sort ---
  const filteredItems = items.filter((item) => {
    // Hide subtasks from the main board view
    if (item.parent_id) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filters.status.length && !filters.status.includes(item.data?.status)) return false;
    if (filters.people.length && !itemAssignees(item).some((email) => filters.people.includes(email))) return false;
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
      <div className="p-8 bg-background min-h-screen flex items-center justify-center" role="status" aria-label="Loading board">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="p-8 bg-background min-h-screen text-center py-16">
        <h2 className="text-2xl font-bold text-foreground mb-4">Board not found</h2>
        <Link href="/boards">
          <Button className="bg-primary text-white rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Boards
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-full">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-4">
          <BoardHeader board={board} items={items} itemsCount={items.length}
            selectedCount={selectedItems.size} currentView={currentView}
            onViewChange={setCurrentView}
            onShowAnalytics={() => setShowAnalytics(true)}
            onShowAutomations={() => setShowAutomations(true)}
            onShowShare={() => setShowShare(true)} />
        </div>

        <div className="px-3 sm:px-6 py-4 sm:py-6">
          {currentView === "table" && (
            <>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6 bg-card rounded-xl p-3 sm:p-4 shadow-sm dark:shadow-none border border-border">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 flex-1">
                  <Button
                    onClick={() => canEdit && setShowNewTaskModal(true)}
                    disabled={!canEdit}
                    title={!canEdit ? "Viewers cannot add tasks" : undefined}
                    className="bg-primary hover:bg-primary/90 text-white rounded-lg h-10 px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">New Task</span><span className="sm:hidden">New</span>
                  </Button>
                  <div className="relative flex-1 sm:flex-none min-w-[120px] sm:min-w-0">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search" value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-full sm:w-64 bg-muted dark:text-slate-200 border-none rounded-lg h-10" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-border dark:text-slate-300 dark:hover:bg-slate-800"
                        onClick={() => setShowPersonFilter(!showPersonFilter)}>
                        <Users className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Person</span>
                        {filters.people.length > 0 && (
                          <Badge className="ml-2 bg-primary text-white rounded-full w-5 h-5 text-xs p-0 flex items-center justify-center">
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
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-border dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => setShowFilterPanel(!showFilterPanel)}>
                      <Filter className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Filter</span>
                    </Button>
                    {showFilterPanel && (
                      <FilterPanel filters={filters} onChange={setFilters}
                        onClose={() => setShowFilterPanel(false)} board={board} />
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-border dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => setShowSortMenu(!showSortMenu)}>
                      <SortAsc className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Sort</span>
                    </Button>
                    {showSortMenu && (
                      <SortMenu sortBy={sortBy} sortDirection={sortDirection}
                        columns={board.columns}
                        onChange={setSort}
                        onClose={() => setShowSortMenu(false)} />
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-border dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => setShowHideMenu(!showHideMenu)}>
                      {hiddenColumns.size > 0 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} <span className="hidden sm:inline ml-2">Hide</span>
                    </Button>
                    {showHideMenu && (
                      <HideMenu columns={board.columns} hiddenColumns={hiddenColumns}
                        onChange={setHiddenColumns} onClose={() => setShowHideMenu(false)} />
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="outline" className="rounded-lg h-10 px-3 sm:px-4 border-border dark:text-slate-300 dark:hover:bg-slate-800"
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

              <div className="bg-card rounded-xl shadow-sm dark:shadow-none border border-border">
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
                  <div className="p-8 text-center text-muted-foreground">
                    <h3 className="text-xl font-medium mb-2">No groups yet!</h3>
                    <p className="mb-4">Add your first group to organize tasks.</p>
                    <Button
                      onClick={() => canAdmin && setShowNewGroupModal(true)}
                      disabled={!canAdmin}
                      title={!canAdmin ? "Only admins can add groups" : undefined}
                      className="bg-primary hover:bg-primary/90 text-white rounded-lg h-10 px-4 disabled:opacity-50 disabled:cursor-not-allowed">
                      <Plus className="w-4 h-4 mr-2" /> Add First Group
                    </Button>
                  </div>
                )}
                <div className="p-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => canAdmin && setShowNewGroupModal(true)}
                    disabled={!canAdmin}
                    title={!canAdmin ? "Only admins can add groups" : undefined}
                    className="w-full border-dashed border-primary text-primary hover:bg-primary/10 rounded-lg h-10 disabled:opacity-50 disabled:cursor-not-allowed">
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
              onDeleteItem={handleDeleteItem} onSelectTask={setSelectedTask} />
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
        {showAutomations && (
          <AutomationsPanel board={board} canAdmin={canAdmin} onClose={() => setShowAutomations(false)} />
        )}
        {showShare && <ShareBoardModal isOpen={showShare} onClose={() => setShowShare(false)} board={board} />}

        {/* Task Detail Drawer */}
        {selectedTask && (
          <TaskDetailDrawer
            key={selectedTask.id}
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
