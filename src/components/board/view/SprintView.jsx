"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sprintsApi } from "@/lib/api/sprints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Target,
  Play,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Inbox,
  CalendarDays,
  MoreHorizontal,
  GripVertical,
  X,
} from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// --- Sprint Card (task item row) ---
const SprintItemRow = ({ item, index, board, onSelect }) => {
  const priorityColumn = board?.columns?.find((col) => col.type === "priority");
  const priorityValue = item.data?.[priorityColumn?.id];
  const priorityOption = priorityColumn?.options?.choices?.find((c) => c.value === priorityValue);

  const statusColumn = board?.columns?.find((col) => col.type === "status");
  const statusValue = item.data?.[statusColumn?.id];
  const statusOption = statusColumn?.options?.choices?.find((c) => c.label === statusValue);

  const ownerColumn = board?.columns?.find((col) => col.type === "people");
  const rawOwner = item.data?.[ownerColumn?.id];
  const ownerValue = Array.isArray(rawOwner) ? rawOwner[0] : rawOwner;

  return (
    <Draggable draggableId={`sprint-item-${item.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-[#E1E5F3] dark:border-slate-700 rounded-xl mb-2 hover:shadow-sm transition-all cursor-pointer group ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-[#0073EA]/30" : ""
          }`}
          style={provided.draggableProps.style}
          onClick={() => onSelect?.(item)}
        >
          <div
            {...provided.dragHandleProps}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4 text-[#676879] dark:text-slate-500" />
          </div>

          {/* Status dot */}
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusOption?.color || "#C4C4C4" }}
            title={statusValue || "No status"}
          />

          {/* Title */}
          <span className="text-sm font-medium text-[#323338] dark:text-slate-200 truncate flex-1">{item.title}</span>

          {/* Priority badge */}
          {priorityOption && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: `${priorityOption.color}20`,
                color: priorityOption.color,
                border: `1px solid ${priorityOption.color}40`,
              }}
            >
              {priorityOption.label}
            </span>
          )}

          {/* Owner */}
          {ownerValue && (
            <div
              className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              title={ownerValue}
            >
              {String(ownerValue).substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

// --- Sprint Section (collapsible group) ---
const SprintSection = ({
  sprint,
  items,
  board,
  isExpanded,
  onToggle,
  onSelectTask,
  onStartSprint,
  onCompleteSprint,
  onDeleteSprint,
  userRole,
}) => {
  const isActive = sprint?.status === "active";
  const isPlanning = sprint?.status === "planning";
  const isCompleted = sprint?.status === "completed";

  const statusColor = isActive ? "#00C875" : isPlanning ? "#FFCB00" : "#676879";
  const statusLabel = isActive ? "Active" : isPlanning ? "Planning" : "Completed";

  const completedItems = items.filter((i) => {
    const statusCol = board?.columns?.find((c) => c.type === "status");
    return i.data?.[statusCol?.id] === "Done";
  });
  const progress = items.length > 0 ? Math.round((completedItems.length / items.length) * 100) : 0;

  return (
    <div className="mb-6">
      {/* Sprint Header */}
      <div className="flex items-center gap-3 mb-3 px-2">
        <button onClick={onToggle} className="p-0.5 hover:bg-[#E1E5F3] dark:hover:bg-slate-700 rounded">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#676879] dark:text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#676879] dark:text-slate-400" />
          )}
        </button>

        <Target className="w-5 h-5" style={{ color: statusColor }} />

        <h3 className="text-base font-bold text-[#323338] dark:text-slate-100">{sprint.title}</h3>

        <Badge
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
            border: `1px solid ${statusColor}40`,
          }}
        >
          {statusLabel}
        </Badge>

        <span className="text-xs text-[#676879] dark:text-slate-400">
          {items.length} items · {progress}% done
        </span>

        {sprint.start_date && (
          <span className="text-xs text-[#676879] dark:text-slate-400 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(new Date(sprint.start_date), "MMM d")}
            {sprint.end_date && ` – ${format(new Date(sprint.end_date), "MMM d")}`}
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          {isPlanning && userRole === "admin" && (
            <>
              <Button
                size="sm"
                className="h-7 text-xs bg-[#00C875] hover:bg-[#00A86B] text-white rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartSprint?.(sprint.id);
                }}
              >
                <Play className="w-3 h-3 mr-1" /> Start
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#E2445C] hover:bg-[#E2445C]/10 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSprint?.(sprint.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {isActive && userRole === "admin" && (
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onCompleteSprint?.(sprint.id);
              }}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="h-1.5 bg-[#E1E5F3] dark:bg-slate-700 rounded-full mx-2 mb-3 overflow-hidden">
          <div
            className="h-full bg-[#00C875] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Items */}
      {isExpanded && (
        <Droppable droppableId={`sprint-${sprint.id}`} type="SPRINT_ITEM">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[60px] rounded-xl p-2 transition-colors ${
                snapshot.isDraggingOver ? "bg-[#0073EA]/5 border-2 border-dashed border-[#0073EA]/30" : ""
              }`}
            >
              {items.length === 0 && !snapshot.isDraggingOver && (
                <p className="text-sm text-[#676879] dark:text-slate-400 text-center py-4">No items in this sprint</p>
              )}
              {items.map((item, idx) => (
                <SprintItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  board={board}
                  onSelect={onSelectTask}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
};

// --- Main SprintView ---
export default function SprintView({ board, items, boardId, userRole, onSelectTask, onUpdateItem }) {
  const queryClient = useQueryClient();

  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ["sprints", boardId],
    queryFn: () => sprintsApi.listByBoard(boardId),
    enabled: !!boardId,
  });

  const [expandedSprints, setExpandedSprints] = useState(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSprintTitle, setNewSprintTitle] = useState("");
  const [newSprintEnd, setNewSprintEnd] = useState("");

  const toggleExpanded = (id) => {
    setExpandedSprints((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Mutations
  const createSprint = useMutation({
    mutationFn: (data) => sprintsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
      toast.success("Sprint created");
      setNewSprintTitle("");
      setNewSprintEnd("");
      setShowCreateForm(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const startSprint = useMutation({
    mutationFn: (id) => sprintsApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
      toast.success("Sprint started!");
    },
    onError: (err) => toast.error(err.message),
  });

  const completeSprint = useMutation({
    mutationFn: (id) => sprintsApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
      toast.success("Sprint completed!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSprint = useMutation({
    mutationFn: (id) => sprintsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      toast.success("Sprint deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const assignToSprint = useMutation({
    mutationFn: ({ sprintId, itemIds }) => sprintsApi.assignItems(sprintId, itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      toast.success("Item added to sprint");
    },
    onError: (err) => toast.error(err.message),
  });

  const unassignFromSprint = useMutation({
    mutationFn: (itemIds) => sprintsApi.unassignItems(itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      toast.success("Item moved to backlog");
    },
    onError: (err) => toast.error(err.message),
  });

  // Split items
  const backlogItems = items.filter((i) => !i.sprint_id && !i.parent_id);
  const activeSprint = sprints.find((s) => s.status === "active");
  const planningSprints = sprints.filter((s) => s.status === "planning");
  const completedSprints = sprints.filter((s) => s.status === "completed");

  const getSprintItems = (sprintId) => items.filter((i) => i.sprint_id === sprintId && !i.parent_id);

  // Drag & drop
  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const itemId = draggableId.replace("sprint-item-", "");

    // Moved to backlog
    if (destination.droppableId === "backlog") {
      const item = items.find((i) => i.id === itemId);
      if (item?.sprint_id) {
        unassignFromSprint.mutate([itemId]);
      }
      return;
    }

    // Moved to a sprint
    if (destination.droppableId.startsWith("sprint-")) {
      const sprintId = destination.droppableId.replace("sprint-", "");
      assignToSprint.mutate({ sprintId, itemIds: [itemId] });
    }
  };

  // Expand backlog + active sprint by default
  React.useEffect(() => {
    if (sprints.length > 0) {
      setExpandedSprints((prev) => {
        const next = new Set(prev);
        next.add("backlog");
        if (activeSprint) next.add(activeSprint.id);
        return next;
      });
    }
  }, [sprints.length, activeSprint?.id]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0073EA]" />
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-2xl border border-green-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">Sprint Board</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400">Manage sprints and track progress</p>
          </div>
        </div>

        {userRole === "admin" && (
          <Button
            className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> New Sprint
          </Button>
        )}
      </div>

      {/* Create sprint form */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-[#E1E5F3] dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Sprint name (e.g., Sprint 1)"
              value={newSprintTitle}
              onChange={(e) => setNewSprintTitle(e.target.value)}
              className="flex-1 h-10 rounded-lg"
            />
            <Input
              type="date"
              value={newSprintEnd}
              onChange={(e) => setNewSprintEnd(e.target.value)}
              className="w-44 h-10 rounded-lg"
              placeholder="End date"
            />
            <Button
              className="h-10 bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
              disabled={!newSprintTitle.trim()}
              onClick={() =>
                createSprint.mutate({
                  board_id: boardId,
                  title: newSprintTitle.trim(),
                  end_date: newSprintEnd || null,
                })
              }
            >
              Create
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg"
              onClick={() => setShowCreateForm(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Sprint List */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-2">
          {/* Backlog */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3 px-2">
              <button
                onClick={() => toggleExpanded("backlog")}
                className="p-0.5 hover:bg-[#E1E5F3] dark:hover:bg-slate-700 rounded"
              >
                {expandedSprints.has("backlog") ? (
                  <ChevronDown className="w-4 h-4 text-[#676879] dark:text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#676879] dark:text-slate-400" />
                )}
              </button>
              <Inbox className="w-5 h-5 text-[#676879] dark:text-slate-400" />
              <h3 className="text-base font-bold text-[#323338] dark:text-slate-100">Backlog</h3>
              <span className="text-xs text-[#676879] dark:text-slate-400">{backlogItems.length} items</span>
              <span className="text-xs text-[#676879] dark:text-slate-400 ml-2">
                Drag items here or to a sprint below
              </span>
            </div>

            {expandedSprints.has("backlog") && (
              <Droppable droppableId="backlog" type="SPRINT_ITEM">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[60px] rounded-xl p-2 transition-colors ${
                      snapshot.isDraggingOver
                        ? "bg-[#676879]/5 border-2 border-dashed border-[#676879]/30"
                        : ""
                    }`}
                  >
                    {backlogItems.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-sm text-[#676879] dark:text-slate-400 text-center py-4">
                        All items are assigned to sprints
                      </p>
                    )}
                    {backlogItems.map((item, idx) => (
                      <SprintItemRow
                        key={item.id}
                        item={item}
                        index={idx}
                        board={board}
                        onSelect={onSelectTask}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>

          {/* Active Sprint */}
          {activeSprint && (
            <SprintSection
              sprint={activeSprint}
              items={getSprintItems(activeSprint.id)}
              board={board}
              isExpanded={expandedSprints.has(activeSprint.id)}
              onToggle={() => toggleExpanded(activeSprint.id)}
              onSelectTask={onSelectTask}
              onStartSprint={(id) => startSprint.mutate(id)}
              onCompleteSprint={(id) => completeSprint.mutate(id)}
              onDeleteSprint={(id) => {
                if (window.confirm("Delete this sprint? Items will move to backlog.")) {
                  deleteSprint.mutate(id);
                }
              }}
              userRole={userRole}
            />
          )}

          {/* Planning Sprints */}
          {planningSprints.map((sprint) => (
            <SprintSection
              key={sprint.id}
              sprint={sprint}
              items={getSprintItems(sprint.id)}
              board={board}
              isExpanded={expandedSprints.has(sprint.id)}
              onToggle={() => toggleExpanded(sprint.id)}
              onSelectTask={onSelectTask}
              onStartSprint={(id) => startSprint.mutate(id)}
              onCompleteSprint={(id) => completeSprint.mutate(id)}
              onDeleteSprint={(id) => {
                if (window.confirm("Delete this sprint? Items will move to backlog.")) {
                  deleteSprint.mutate(id);
                }
              }}
              userRole={userRole}
            />
          ))}

          {/* Completed Sprints */}
          {completedSprints.length > 0 && (
            <div className="mt-8">
              <h4 className="text-sm font-semibold text-[#676879] dark:text-slate-400 uppercase tracking-wider mb-3 px-2">
                Completed Sprints
              </h4>
              {completedSprints.map((sprint) => (
                <SprintSection
                  key={sprint.id}
                  sprint={sprint}
                  items={getSprintItems(sprint.id)}
                  board={board}
                  isExpanded={expandedSprints.has(sprint.id)}
                  onToggle={() => toggleExpanded(sprint.id)}
                  onSelectTask={onSelectTask}
                  userRole={userRole}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {sprints.length === 0 && (
            <div className="text-center py-16">
              <Target className="w-16 h-16 text-[#E1E5F3] dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#323338] dark:text-slate-100 mb-2">No sprints yet</h3>
              <p className="text-sm text-[#676879] dark:text-slate-400 mb-4">
                Create your first sprint to start organizing work
              </p>
              {userRole === "admin" && (
                <Button
                  className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="w-4 h-4 mr-2" /> Create Sprint
                </Button>
              )}
            </div>
          )}
        </div>
      </DragDropContext>
    </div>
  );
}
