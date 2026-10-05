"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlarmClock,
  ArrowRightLeft,
  AtSign,
  Bell,
  CheckCheck,
  CheckCircle2,
  MessageSquare,
  Share2,
  UserPlus,
} from "lucide-react";
import { notificationsApi } from "@/lib/api/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Types written by the database triggers (supabase/schema.sql §9b).
const TYPE_CONFIG = {
  assigned: { icon: UserPlus, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  comment: { icon: MessageSquare, tone: "bg-primary/10 text-primary" },
  mention: { icon: AtSign, tone: "bg-warning/15 text-warning" },
  status_changed: { icon: ArrowRightLeft, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  task_done: { icon: CheckCircle2, tone: "bg-success/10 text-success" },
  due_soon: { icon: AlarmClock, tone: "bg-destructive/10 text-destructive" },
  invite_accepted: { icon: Share2, tone: "bg-success/10 text-success" },
  share_accepted: { icon: Share2, tone: "bg-success/10 text-success" },
};
const DEFAULT_CONFIG = { icon: Bell, tone: "bg-muted text-muted-foreground" };

function notificationHref(notification) {
  if (!notification.board_id) return null;
  const base = `/boards/${notification.board_id}`;
  return notification.item_id ? `${base}?task=${notification.item_id}` : base;
}

export default function NotificationBell({ className, align = "end" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Realtime (RealtimeSync) refreshes this on every new row; the slow
  // poll only covers a dropped socket.
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list({ limit: 30 }),
    refetchInterval: 120000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onMutate: (id) =>
      queryClient.setQueryData(["notifications"], (old = []) =>
        old.map((n) => (n.id === id ? { ...n, read: true } : n))
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: () =>
      queryClient.setQueryData(["notifications"], (old = []) => old.map((n) => ({ ...n, read: true }))),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleSelect = (notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    setOpen(false);
    const href = notificationHref(notification);
    if (href) router.push(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            className
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg text-xs text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto scroll-themed">
          {notifications.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Bell className="mx-auto mb-2 h-9 w-9 text-subtle-foreground" />
              <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assignments, comments and mentions show up here.
              </p>
            </div>
          ) : (
            <ul role="list">
              {notifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type] || DEFAULT_CONFIG;
                const Icon = config.icon;
                const actor = notification.actor?.full_name;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(notification)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        !notification.read && "bg-primary/5"
                      )}
                    >
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", config.tone)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-tight text-foreground">
                          {notification.title}
                        </span>
                        {notification.message && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {notification.message}
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-subtle-foreground">
                          {actor ? `${actor} · ` : ""}
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </span>
                      {!notification.read && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
