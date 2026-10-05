"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AtSign, Check, Edit3, Send, Trash2, X } from "lucide-react";
import { commentsApi } from "@/lib/api/comments";
import { userApi } from "@/lib/api/user";
import { useBoardPeople } from "@/hooks/useBoardPeople";
import { extractMentionedUserIds, mentionHandle, splitMentions } from "@/lib/mentions";
import { avatarColor } from "@/components/board/cells/PeopleCell";
import { cn } from "@/lib/utils";

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function authorName(comment) {
  const p = comment.profiles;
  if (p?.full_name?.trim()) return p.full_name.trim();
  if (p?.email) return p.email.split("@")[0];
  return comment.user_id ? comment.user_id.slice(0, 8) : "Unknown";
}

function CommentBody({ content, handles, own }) {
  const segments = splitMentions(content, handles);
  return segments.map((segment, index) =>
    segment.mention ? (
      <span
        key={index}
        className={cn(
          "rounded px-0.5 font-medium",
          own ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
        )}
      >
        {segment.text}
      </span>
    ) : (
      <span key={index}>{segment.text}</span>
    )
  );
}

export default function CommentsTab({ task, userRole, board }) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [mention, setMention] = useState(null); // { filter, index } while typing "@…"
  const textareaRef = useRef(null);
  const commentsEndRef = useRef(null);

  const isViewer = userRole === "viewer";
  const isAdmin = userRole === "admin";

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUserId = currentUser?.id ?? null;

  const { people } = useBoardPeople(board);
  const mentionable = useMemo(
    () => people.filter((person) => person.id !== currentUserId),
    [people, currentUserId]
  );
  const handles = useMemo(() => people.map(mentionHandle), [people]);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", task?.id],
    queryFn: () => commentsApi.listByItem(task.id),
    enabled: Boolean(task?.id),
  });

  const createComment = useMutation({
    mutationFn: (text) =>
      commentsApi.create({
        item_id: task.id,
        content: text,
        mentioned_user_ids: extractMentionedUserIds(text, mentionable),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["comments", task.id], (old = []) =>
        old.some((c) => c.id === data.id) ? old : [...old, data]
      );
      setNewComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateComment = useMutation({
    mutationFn: ({ id, content }) => commentsApi.update(id, { content }),
    onSuccess: (data) => {
      queryClient.setQueryData(["comments", task.id], (old = []) =>
        old.map((c) => (c.id === data.id ? data : c))
      );
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteComment = useMutation({
    mutationFn: (id) => commentsApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["comments", task.id], (old = []) => old.filter((c) => c.id !== id));
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [comments.length]);

  const mentionOptions = mention
    ? mentionable
        .filter((person) => {
          const needle = mention.filter.toLowerCase();
          return (
            mentionHandle(person).includes(needle) ||
            (person.full_name || "").toLowerCase().includes(needle)
          );
        })
        .slice(0, 8)
    : [];

  const handleCommentInput = (event) => {
    const { value, selectionStart } = event.target;
    setNewComment(value);
    const match = value.slice(0, selectionStart).match(/(?:^|[\s(])@([\w.+-]*)$/);
    setMention(match ? { filter: match[1], index: 0 } : null);
  };

  const insertMention = (person) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? newComment.length;
    const before = newComment.slice(0, cursor);
    const after = newComment.slice(cursor);
    const atPos = before.lastIndexOf("@");
    const next = `${before.slice(0, atPos)}@${mentionHandle(person)} ${after.replace(/^\s+/, "")}`;
    setNewComment(next);
    setMention(null);
    requestAnimationFrame(() => {
      const position = atPos + mentionHandle(person).length + 2;
      textarea?.focus();
      textarea?.setSelectionRange(position, position);
    });
  };

  const submit = () => {
    const text = newComment.trim();
    if (text && !createComment.isPending) createComment.mutate(text);
  };

  const handleKeyDown = (event) => {
    if (mention && mentionOptions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMention((m) => ({ ...m, index: (m.index + 1) % mentionOptions.length }));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMention((m) => ({ ...m, index: (m.index - 1 + mentionOptions.length) % mentionOptions.length }));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(mentionOptions[mention.index] || mentionOptions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  // Wait for the user so comments don't jump between the left and right side.
  if (userLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6" role="status" aria-label="Loading comments">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 p-6">
        {comments.length === 0 && !isLoading && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Send className="h-5 w-5 text-subtle-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No comments yet</p>
            <p className="mt-1 text-xs text-subtle-foreground">Start the conversation — use @ to mention someone</p>
          </div>
        )}

        {comments.map((comment) => {
          const isEditing = editingId === comment.id;
          const isOwn = Boolean(currentUserId) && comment.user_id === currentUserId;
          const name = authorName(comment);
          const canDelete = isOwn || isAdmin;
          return (
            <div key={comment.id} className={cn("group flex gap-2", isOwn ? "justify-end" : "justify-start")}>
              {!isOwn && (
                <div
                  className="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: avatarColor(comment.profiles?.email || comment.user_id) }}
                  aria-hidden
                >
                  {name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className={cn("flex min-w-0 max-w-[75%] flex-col", isOwn ? "items-end" : "items-start")}>
                <div className={cn("mb-0.5 flex items-center gap-2 px-1", isOwn && "flex-row-reverse")}>
                  <span className={cn("truncate text-[11px] font-medium", isOwn ? "text-primary" : "text-muted-foreground")}>
                    {isOwn ? "You" : name}
                  </span>
                  <time dateTime={comment.created_at} className="shrink-0 text-[10px] text-subtle-foreground">
                    {formatTime(comment.created_at)}
                  </time>
                </div>

                {isEditing ? (
                  <div className="w-full space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      aria-label="Edit comment"
                      className="w-full resize-none rounded-lg border border-primary bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label="Save comment"
                        onClick={() => updateComment.mutate({ id: comment.id, content: editContent })}
                        className="rounded p-1.5 text-primary hover:bg-primary/10"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel editing"
                        onClick={() => setEditingId(null)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div
                      className={cn(
                        "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                        isOwn ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
                      )}
                    >
                      <CommentBody content={comment.content} handles={handles} own={isOwn} />
                    </div>
                    {!isViewer && (isOwn || canDelete) && (
                      <div
                        className={cn(
                          "absolute -top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                          isOwn ? "-left-1" : "-right-1"
                        )}
                      >
                        {isOwn && (
                          <button
                            type="button"
                            aria-label="Edit comment"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditContent(comment.content);
                            }}
                            className="rounded border border-border bg-card p-1 text-subtle-foreground shadow-sm hover:text-primary"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            aria-label="Delete comment"
                            onClick={() => {
                              if (window.confirm("Delete this comment?")) deleteComment.mutate(comment.id);
                            }}
                            className="rounded border border-border bg-card p-1 text-subtle-foreground shadow-sm hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
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

      {!isViewer && (
        <div className="shrink-0 border-t border-border p-4">
          <div className="relative">
            {mention && mentionOptions.length > 0 && (
              <div
                role="listbox"
                aria-label="Mention someone"
                className="absolute bottom-full left-0 z-10 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg scroll-themed animate-in fade-in-0 slide-in-from-bottom-1"
              >
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase text-muted-foreground">
                  <AtSign className="mr-1 inline h-3 w-3" />
                  People on this board
                </div>
                {mentionOptions.map((person, i) => (
                  <button
                    key={person.id}
                    type="button"
                    role="option"
                    aria-selected={i === mention.index}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertMention(person)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      i === mention.index ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: avatarColor(person.email) }}
                      aria-hidden
                    >
                      {(person.full_name || person.email).charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{person.full_name || mentionHandle(person)}</span>
                    <span className="text-xs text-muted-foreground">@{mentionHandle(person)}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleCommentInput}
              onKeyDown={handleKeyDown}
              onBlur={() => setMention(null)}
              placeholder="Write a comment… (use @ to mention)"
              aria-label="Write a comment"
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-subtle-foreground">Enter to send · Shift+Enter for a new line</span>
              <button
                type="button"
                aria-label="Send comment"
                onClick={submit}
                disabled={!newComment.trim() || createComment.isPending}
                className="rounded-lg bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
