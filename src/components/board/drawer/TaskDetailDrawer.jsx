"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Trash2, FileText, MessageSquare, History, Paperclip, Clock } from "lucide-react";
import { commentsApi } from "@/lib/api/comments";
import { cn } from "@/lib/utils";
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

// How many comments of a task this browser has seen (unread dot).
function readSeen(key) {
  try {
    return parseInt(localStorage.getItem(key) || "0", 10);
  } catch {
    return 0;
  }
}

function writeSeen(key, count) {
  try {
    localStorage.setItem(key, String(count));
  } catch {
    // storage unavailable: the dot just stays
  }
}

/**
 * Side panel for one task. Sits at z-50 like Radix overlays, so menus and
 * popovers portalled from inside it (rendered later in <body>) stay on top. The parent renders it with key={task.id}, so
 * local state (tab, title draft) starts fresh for every task.
 */
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
  const [titleDraft, setTitleDraft] = useState(null); // null = not editing
  const [, markSeen] = useReducer((n) => n + 1, 0);
  const panelRef = useRef(null);

  const canEdit = userRole === "admin" || userRole === "editor";
  const canDelete = userRole === "admin";
  const seenKey = `comments_read_${task?.id}`;

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", task?.id],
    queryFn: () => commentsApi.listByItem(task.id),
    enabled: Boolean(task?.id),
    staleTime: 30_000,
  });
  const hasUnread = activeTab !== "comments" && comments.length > readSeen(seenKey);

  const selectTab = (tabId) => {
    // Opening or leaving the comments tab counts as having read them.
    if (tabId === "comments" || activeTab === "comments") {
      writeSeen(seenKey, comments.length);
      markSeen();
    }
    setActiveTab(tabId);
  };

  // Move focus into the panel; Escape closes it.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // A menu, popover or dialog on top already used this Escape
      // (Radix marks it with preventDefault) — only close the drawer when not.
      if (event.key === "Escape" && !event.defaultPrevented && titleDraft === null) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, titleDraft]);

  if (!task) return null;

  const commitTitle = () => {
    const next = (titleDraft || "").trim();
    if (next && next !== task.title) onUpdate(task.id, { title: next });
    setTitleDraft(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col bg-card shadow-2xl outline-none animate-in slide-in-from-right duration-300 ease-out"
      >
        <div className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {titleDraft !== null ? (
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle();
                    if (e.key === "Escape") setTitleDraft(null);
                  }}
                  aria-label="Task title"
                  className="w-full rounded border border-primary bg-card px-2 py-1 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  autoFocus
                />
              ) : (
                <h2 id="task-drawer-title" className="text-lg font-semibold text-foreground">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setTitleDraft(task.title || "")}
                      title="Click to edit"
                      className="block max-w-full truncate text-left transition-colors hover:text-primary"
                    >
                      {task.title}
                    </button>
                  ) : (
                    <span className="block truncate">{task.title}</span>
                  )}
                </h2>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Created{" "}
                {new Date(task.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Delete this task?")) {
                      onDelete(task.id);
                      onClose();
                    }
                  }}
                  className="rounded-lg p-2 text-subtle-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Delete task"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Close"
                aria-label="Close task details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div role="tablist" aria-label="Task sections" className="-mb-[1px] mt-4 flex gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`task-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls="task-tab-panel"
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="relative">
                    <Icon className="h-3.5 w-3.5" />
                    {tab.id === "comments" && hasUnread && (
                      <span
                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-warning ring-2 ring-card"
                        aria-label="Unread comments"
                      />
                    )}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="task-tab-panel"
          role="tabpanel"
          aria-labelledby={`task-tab-${activeTab}`}
          className="flex-1 overflow-y-auto scroll-themed"
        >
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
          {activeTab === "comments" && <CommentsTab task={task} userRole={userRole} board={board} />}
          {activeTab === "activity" && <ActivityTab task={task} />}
          {activeTab === "files" && <FilesTab task={task} boardId={boardId} userRole={userRole} />}
          {activeTab === "time" && <TimeTab task={task} userRole={userRole} />}
        </div>
      </div>
    </>
  );
}
