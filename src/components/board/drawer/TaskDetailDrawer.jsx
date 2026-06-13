"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import { commentsApi } from "@/lib/api/comments";
import { activityApi } from "@/lib/api/activity";
import { attachmentsApi } from "@/lib/api/attachments";
import { timeApi } from "@/lib/api/time";
import { toast } from "sonner";
import {
  X, Trash2, FileText, MessageSquare, History,
  Paperclip, Clock, ChevronDown,
} from "lucide-react";
import DetailsTab from "./DetailsTab";
import CommentsTab from "./CommentsTab";
import ActivityTab from "./ActivityTab";
import FilesTab from "./FilesTab";
import TimeTab from "./TimeTab";

const TABS = [
  { id: "details", label: "Details", icon: FileText },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "activity", label: "Activity", icon: History },
  { id: "files", label: "Files", icon: Paperclip },
  { id: "time", label: "Time", icon: Clock },
];

export default function TaskDetailDrawer({
  task,
  board,
  boardId,
  userRole,
  onClose,
  onUpdate,
  onDelete,
  allItems,
}) {
  const [activeTab, setActiveTab] = useState("details");
  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (task) setTitle(task.title || "");
  }, [task?.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isEditingTitle) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isEditingTitle]);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (title.trim() && title !== task.title) {
      onUpdate(task.id, { title: title.trim() }, task);
    } else {
      setTitle(task.title || "");
    }
  };

  const isViewer = userRole === "viewer";

  if (!task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-white shadow-2xl z-[70] flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E1E5F3] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isEditingTitle && !isViewer ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleBlur();
                    if (e.key === "Escape") {
                      setTitle(task.title || "");
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full text-lg font-semibold text-[#323338] border border-[#0073EA] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                  autoFocus
                />
              ) : (
                <h2
                  className={`text-lg font-semibold text-[#323338] truncate ${!isViewer ? "cursor-pointer hover:text-[#0073EA]" : ""}`}
                  onClick={() => !isViewer && setIsEditingTitle(true)}
                  title={!isViewer ? "Click to edit" : ""}
                >
                  {task.title}
                </h2>
              )}
              <p className="text-xs text-[#676879] mt-1">
                Created {new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!isViewer && (
                <button
                  onClick={() => {
                    if (window.confirm("Delete this task?")) {
                      onDelete(task.id);
                      onClose();
                    }
                  }}
                  className="p-2 text-[#A0A0A0] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-[#A0A0A0] hover:text-[#323338] hover:bg-[#F5F6F8] rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 -mb-[1px]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                    isActive
                      ? "text-[#0073EA] border-[#0073EA] bg-[#0073EA]/5"
                      : "text-[#676879] border-transparent hover:text-[#323338] hover:bg-[#F5F6F8]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" && (
            <DetailsTab
              task={task}
              board={board}
              boardId={boardId}
              userRole={userRole}
              onUpdate={onUpdate}
              allItems={allItems}
            />
          )}
          {activeTab === "comments" && (
            <CommentsTab
              task={task}
              userRole={userRole}
              board={board}
            />
          )}
          {activeTab === "activity" && (
            <ActivityTab task={task} />
          )}
          {activeTab === "files" && (
            <FilesTab
              task={task}
              boardId={boardId}
              userRole={userRole}
            />
          )}
          {activeTab === "time" && (
            <TimeTab
              task={task}
              userRole={userRole}
            />
          )}
        </div>
      </div>
    </>
  );
}
