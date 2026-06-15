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

  // ── Unread comments tracking ──
  const storageKey = task?.id ? `comments_read_${task.id}` : null;
  const getSeenCount = () => {
    if (!storageKey) return 0;
    return parseInt(localStorage.getItem(storageKey) || "0", 10);
  };
  const [seenCount, setSeenCount] = useState(getSeenCount);

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", task?.id],
    queryFn: () => commentsApi.listByItem(task.id),
    enabled: !!task?.id,
    staleTime: 30_000,
  });

  const totalComments = comments.length;
  const hasUnread = totalComments > seenCount;

  // Mark as read when user opens comments tab
  useEffect(() => {
    if (activeTab === "comments" && storageKey) {
      const current = comments.length;
      localStorage.setItem(storageKey, String(current));
      setSeenCount(current);
    }
  }, [activeTab, comments.length, storageKey]);

  // Reset seen count when task changes
  useEffect(() => {
    setSeenCount(getSeenCount());
  }, [task?.id]);

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
      <div className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-white dark:bg-slate-900 shadow-2xl z-[70] flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E1E5F3] dark:border-slate-800 px-6 py-4">
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
                  className="w-full text-lg font-semibold text-[#323338] dark:text-slate-100 border border-[#0073EA] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0073EA] bg-white dark:bg-slate-800"
                  autoFocus
                />
              ) : (
                <h2
                  className={`text-lg font-semibold text-[#323338] dark:text-slate-100 truncate ${!isViewer ? "cursor-pointer hover:text-[#0073EA] dark:hover:text-blue-400" : ""}`}
                  onClick={() => !isViewer && setIsEditingTitle(true)}
                  title={!isViewer ? "Click to edit" : ""}
                >
                  {task.title}
                </h2>
              )}
              <p className="text-xs text-[#676879] dark:text-slate-500 mt-1">
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
                  className="p-2 text-[#A0A0A0] dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-[#A0A0A0] dark:text-slate-500 hover:text-[#323338] dark:hover:text-slate-200 hover:bg-[#F5F6F8] dark:hover:bg-slate-800 rounded-lg transition-colors"
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
                      ? "text-[#0073EA] border-[#0073EA] bg-[#0073EA]/5 dark:bg-[#0073EA]/10"
                      : "text-[#676879] dark:text-slate-500 border-transparent hover:text-[#323338] dark:hover:text-slate-300 hover:bg-[#F5F6F8] dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-3.5 h-3.5" />
                    {tab.id === "comments" && hasUnread && activeTab !== "comments" && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto dark:bg-slate-900">
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
