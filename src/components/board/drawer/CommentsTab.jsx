"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsApi } from "@/lib/api/comments";
import { activityApi } from "@/lib/api/activity";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send, Edit3, Trash2, X, Check, AtSign } from "lucide-react";

export default function CommentsTab({ task, userRole, board }) {
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef(null);
  const commentsEndRef = useRef(null);
  const queryClient = useQueryClient();

  const isViewer = userRole === "viewer";

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", task?.id],
    queryFn: () => commentsApi.listByItem(task.id),
    enabled: !!task?.id,
  });

  // Realtime — listen for new/edited/deleted comments from other users
  useEffect(() => {
    if (!task?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${task.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `item_id=eq.${task.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["comments", task.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [task?.id, queryClient]);

  const createComment = useMutation({
    mutationFn: (text) => commentsApi.create({ item_id: task.id, content: text }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["comments", task.id], (old = []) => {
        if (old.some((c) => c.id === data.id)) return old;
        return [...old, data];
      });
      setNewComment("");
      if (variables) {
        activityApi.log({
          item_id: task.id,
          action: "commented",
          new_value: String(variables).slice(0, 100),
        }).catch(() => {});
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const updateComment = useMutation({
    mutationFn: ({ id, content }) => commentsApi.update(id, { content }),
    onSuccess: (data) => {
      queryClient.setQueryData(["comments", task.id], (old = []) =>
        old.map((c) => (c.id === data.id ? data : c)),
      );
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteComment = useMutation({
    mutationFn: (id) => commentsApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["comments", task.id], (old = []) =>
        old.filter((c) => c.id !== id),
      );
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-scroll to bottom when new comment added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  // Get board members for @mention
  const members = board?.board_members || [];
  const filteredMembers = members.filter((m) =>
    m.email.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleCommentInput = (e) => {
    const value = e.target.value;
    setNewComment(value);

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member) => {
    const cursorPos = textareaRef.current?.selectionStart || newComment.length;
    const textBeforeCursor = newComment.slice(0, cursorPos);
    const textAfterCursor = newComment.slice(cursorPos);
    const atPos = textBeforeCursor.lastIndexOf("@");
    const beforeAt = textBeforeCursor.slice(0, atPos);
    const name = member.email.split("@")[0];
    const newText = `${beforeAt}@${name} ${textAfterCursor}`;
    setNewComment(newText);
    setShowMentions(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    if (showMentions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filteredMembers[mentionIndex]) {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (newComment.trim()) {
        createComment.mutate(newComment.trim());
      }
    }
  };

  const getUserInitial = (email) => email?.charAt(0).toUpperCase() || "?";

  const getUserColor = (email) => {
    const colors = ["#0073EA", "#00C875", "#FFCB00", "#E2445C", "#A25DDC", "#FDAB3D"];
    const hash = (email || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Comments List */}
      <div className="flex-1 p-6 space-y-4">
        {comments.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#F5F6F8] dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Send className="w-5 h-5 text-[#A0A0A0] dark:text-slate-600" />
            </div>
            <p className="text-sm text-[#676879] dark:text-slate-400">No comments yet</p>
            <p className="text-xs text-[#A0A0A0] dark:text-slate-600 mt-1">Start the conversation</p>
          </div>
        )}

        {comments.map((comment) => {
          const isEditing = editingId === comment.id;
          const email = comment.profiles?.full_name || comment.user_id;
          return (
            <div key={comment.id} className="flex gap-3 group">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: getUserColor(email) }}
              >
                {getUserInitial(email)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-[#323338] dark:text-slate-200 truncate">
                    {email}
                  </span>
                  <span className="text-[10px] text-[#A0A0A0] dark:text-slate-600">
                    {formatTime(comment.created_at)}
                  </span>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full rounded-lg border border-[#0073EA] dark:border-[#0073EA] bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA] resize-none"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateComment.mutate({ id: comment.id, content: editContent })}
                        className="p-1.5 text-[#0073EA] hover:bg-[#0073EA]/10 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-[#676879] hover:bg-[#F5F6F8] rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <p className="text-sm text-[#323338] dark:text-slate-300 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                    {/* Action buttons - visible on hover */}
                    {!isViewer && (
                      <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        <button
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="p-1 text-[#A0A0A0] hover:text-[#0073EA] hover:bg-white rounded shadow-sm"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Delete this comment?")) {
                              deleteComment.mutate(comment.id);
                            }
                          }}
                          className="p-1 text-[#A0A0A0] hover:text-red-500 hover:bg-white rounded shadow-sm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={commentsEndRef} />
      </div>

      {/* Comment Input */}
      {!isViewer && (
        <div className="shrink-0 border-t border-[#E1E5F3] dark:border-slate-800 p-4">
          <div className="relative">
            {/* Mention dropdown */}
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-800 border border-[#E1E5F3] dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                <div className="p-1.5 text-[10px] font-semibold text-[#676879] uppercase px-3">
                  <AtSign className="w-3 h-3 inline mr-1" />
                  Members
                </div>
                {filteredMembers.map((member, i) => (
                  <button
                    key={member.id}
                    onClick={() => insertMention(member)}
                    className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                      i === mentionIndex ? "bg-[#0073EA]/10 text-[#0073EA]" : "hover:bg-[#F5F6F8]"
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: getUserColor(member.email) }}
                    >
                      {getUserInitial(member.email)}
                    </div>
                    <span className="truncate">{member.email}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleCommentInput}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment... (use @ to mention)"
              rows={2}
              className="w-full rounded-lg border border-[#E1E5F3] dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-[#A0A0A0]">
                Press Enter to send, Shift+Enter for new line
              </span>
              <button
                onClick={() => newComment.trim() && createComment.mutate(newComment.trim())}
                disabled={!newComment.trim() || createComment.isPending}
                className="p-2 bg-[#0073EA] text-white rounded-lg hover:bg-[#0056B3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
