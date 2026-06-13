"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Check, Circle, ChevronDown, ChevronRight, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

export default function DetailsTab({
  task,
  board,
  boardId,
  userRole,
  onUpdate,
  allItems,
}) {
  const [description, setDescription] = useState(task?.description || "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showDependencies, setShowDependencies] = useState(false);
  const queryClient = useQueryClient();

  const isViewer = userRole === "viewer";

  // Load subtasks
  const { data: subtasks = [] } = useQuery({
    queryKey: ["subtasks", task?.id],
    queryFn: () => itemsApi.listSubtasks(task.id),
    enabled: !!task?.id,
  });

  const createSubtask = useMutation({
    mutationFn: (title) =>
      itemsApi.create({
        board_id: boardId,
        group_id: task.group_id,
        title,
        parent_id: task.id,
        data: task.data ? Object.fromEntries(
          (board?.columns || [])
            .filter((c) => c.id !== "task")
            .map((c) => {
              if (c.type === "checkbox") return [c.id, false];
              if (c.type === "tags") return [c.id, []];
              return [c.id, null];
            })
        ) : {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", task.id] });
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      setNewSubtaskTitle("");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ id, data }) => itemsApi.update(id, { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", task.id] });
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setDescription(task?.description || "");
  }, [task?.id]);

  const handleDescriptionBlur = () => {
    if (description !== (task?.description || "") && !isViewer) {
      onUpdate(task.id, { description }, task);
    }
  };

  const editableColumns = (board?.columns || []).filter((col) => col.id !== "task");

  const handleFieldChange = (columnId, value) => {
    if (isViewer) return;
    onUpdate(task.id, { data: { ...task.data, [columnId]: value } }, task);
  };

  // Subtask completion stats
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((s) => {
    const statusCol = board?.columns?.find((c) => c.type === "status");
    return statusCol && s.data?.[statusCol.id] === "Done";
  }).length;
  const subtaskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Other tasks for dependency selector (exclude self and current subtasks)
  const subtaskIds = new Set(subtasks.map((s) => s.id));
  const otherTasks = (allItems || []).filter(
    (i) => i.id !== task.id && !subtaskIds.has(i.id) && !i.parent_id
  );

  const renderField = (column) => {
    const value = task.data?.[column.id];

    switch (column.type) {
      case "text":
      case "number":
        return (
          <input
            value={value || ""}
            onChange={(e) =>
              handleFieldChange(
                column.id,
                column.type === "number" ? Number(e.target.value) : e.target.value
              )
            }
            placeholder={column.title}
            disabled={isViewer}
            className="w-full rounded-lg border border-[#E1E5F3] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] disabled:opacity-60 disabled:cursor-not-allowed"
          />
        );
      case "status":
      case "priority":
      case "dropdown":
        return (
          <select
            value={value || ""}
            onChange={(e) => handleFieldChange(column.id, e.target.value)}
            disabled={isViewer}
            className="w-full rounded-lg border border-[#E1E5F3] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] disabled:opacity-60 disabled:cursor-not-allowed bg-white"
          >
            <option value="">{`Select ${column.title}`}</option>
            {column.options?.choices?.map((choice) => (
              <option key={choice.value || choice.label} value={choice.value || choice.label}>
                {choice.label}
              </option>
            ))}
          </select>
        );
      case "date":
        return (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(column.id, e.target.value)}
            disabled={isViewer}
            className="w-full rounded-lg border border-[#E1E5F3] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] disabled:opacity-60 disabled:cursor-not-allowed"
          />
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(column.id, e.target.checked)}
              disabled={isViewer}
              className="w-4 h-4 rounded border-gray-300 text-[#0073EA] focus:ring-[#0073EA]"
            />
            <span className="text-sm text-[#323338]">{column.title}</span>
          </label>
        );
      default:
        return (
          <input
            value={value || ""}
            onChange={(e) => handleFieldChange(column.id, e.target.value)}
            placeholder={column.title}
            disabled={isViewer}
            className="w-full rounded-lg border border-[#E1E5F3] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] disabled:opacity-60 disabled:cursor-not-allowed"
          />
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Description */}
      <div>
        <label className="text-xs font-semibold text-[#676879] uppercase tracking-wide mb-2 block">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Add a description..."
          disabled={isViewer}
          rows={4}
          className="w-full rounded-lg border border-[#E1E5F3] px-3 py-2 text-sm text-[#323338] focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] disabled:opacity-60 disabled:cursor-not-allowed resize-none"
        />
      </div>

      {/* Subtasks */}
      <div>
        <button
          onClick={() => setShowSubtasks(!showSubtasks)}
          className="flex items-center gap-2 text-xs font-semibold text-[#676879] uppercase tracking-wide mb-2 hover:text-[#323338]"
        >
          {showSubtasks ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Subtasks
          {totalSubtasks > 0 && (
            <span className="text-[#0073EA] normal-case font-medium">
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
        </button>

        {showSubtasks && (
          <div className="space-y-2">
            {totalSubtasks > 0 && (
              <div className="mb-2">
                <Progress value={subtaskProgress} className="h-1.5" />
                <p className="text-[10px] text-[#676879] mt-1">{subtaskProgress}% complete</p>
              </div>
            )}

            {subtasks.map((subtask) => {
              const statusCol = board?.columns?.find((c) => c.type === "status");
              const isDone = statusCol && subtask.data?.[statusCol.id] === "Done";
              return (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#F5F6F8] group"
                >
                  <button
                    onClick={() => {
                      if (!isViewer && statusCol) {
                        toggleSubtask.mutate({
                          id: subtask.id,
                          data: {
                            ...subtask.data,
                            [statusCol.id]: isDone ? "Not Started" : "Done",
                          },
                        });
                      }
                    }}
                    disabled={isViewer}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? "bg-[#00C875] border-[#00C875] text-white"
                        : "border-[#C4C4C4] hover:border-[#0073EA]"
                    }`}
                  >
                    {isDone && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <span className={`text-sm ${isDone ? "text-[#676879] line-through" : "text-[#323338]"}`}>
                    {subtask.title}
                  </span>
                </div>
              );
            })}

            {!isViewer && (
              <div className="flex gap-2 mt-2">
                <input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSubtaskTitle.trim()) {
                      createSubtask.mutate(newSubtaskTitle.trim());
                    }
                  }}
                  placeholder="Add subtask..."
                  className="flex-1 rounded-lg border border-[#E1E5F3] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA]"
                />
                <Button
                  onClick={() => newSubtaskTitle.trim() && createSubtask.mutate(newSubtaskTitle.trim())}
                  disabled={!newSubtaskTitle.trim()}
                  size="sm"
                  className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg h-8 px-3 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fields */}
      <div>
        <label className="text-xs font-semibold text-[#676879] uppercase tracking-wide mb-3 block">
          Fields
        </label>
        <div className="space-y-3">
          {editableColumns.map((column) => (
            <div key={column.id}>
              <label className="text-xs font-medium text-[#676879] mb-1 block">
                {column.title}
              </label>
              {renderField(column)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
