"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export default function TaskEditModal({
  isOpen,
  onClose,
  task,
  board,
  onUpdate,
  onDelete,
}) {
  const [title, setTitle] = useState("");
  const [data, setData] = useState({});

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setData(task.data || {});
    }
  }, [task]);

  if (!task) return null;

  const handleSave = () => {
    onUpdate(task.id, { title: title.trim(), data });
    onClose();
  };

  const handleFieldChange = (columnId, value) => {
    setData((prev) => ({ ...prev, [columnId]: value }));
  };

  const renderField = (column) => {
    if (column.id === "task") return null;
    const value = data[column.id];

    switch (column.type) {
      case "text":
      case "number":
        return (
          <Input
            value={value || ""}
            onChange={(e) =>
              handleFieldChange(
                column.id,
                column.type === "number" ? Number(e.target.value) : e.target.value
              )
            }
            placeholder={column.title}
            className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
          />
        );
      case "status":
      case "priority":
      case "dropdown":
        return (
          <Select
            value={value || ""}
            onValueChange={(v) => handleFieldChange(column.id, v)}
          >
            <SelectTrigger className="rounded-lg border-[#E1E5F3]">
              <SelectValue placeholder={`Select ${column.title}`} />
            </SelectTrigger>
            <SelectContent>
              {column.options?.choices?.map((choice) => (
                <SelectItem key={choice.label || choice.value} value={choice.value || choice.label}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "date":
        return (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(column.id, e.target.value)}
            className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
          />
        );
      case "people":
        return (
          <Input
            value={value || ""}
            onChange={(e) => handleFieldChange(column.id, e.target.value)}
            placeholder="Assign person..."
            className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
          />
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(column.id, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#0073EA] focus:ring-[#0073EA]"
            />
            <span className="text-sm text-[#323338]">{column.title}</span>
          </label>
        );
      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) => handleFieldChange(column.id, e.target.value)}
            placeholder={column.title}
            className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
          />
        );
    }
  };

  const editableColumns = board?.columns?.filter((col) => col.id !== "task") || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#323338]">Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-[#323338] mb-1.5 block">
              Task Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
              autoFocus
            />
          </div>
          {editableColumns.map((column) => (
            <div key={column.id}>
              <label className="text-sm font-medium text-[#323338] mb-1.5 block">
                {column.title}
              </label>
              {renderField(column)}
            </div>
          ))}
          <div className="flex items-center justify-between pt-4 border-t border-[#E1E5F3]">
            <Button
              variant="ghost"
              onClick={() => {
                if (
                  window.confirm("Are you sure you want to delete this task?")
                ) {
                  onDelete(task.id);
                }
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-lg border-[#E1E5F3]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!title.trim()}
                className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
