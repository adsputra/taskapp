"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  UserPlus,
  AtSign,
  Target,
  ArrowRightLeft,
  Trash2,
  Share2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_CONFIG = {
  assigned: { icon: UserPlus, color: "#6C5CE7", label: "Assigned" },
  comment: { icon: MessageSquare, color: "#0073EA", label: "Comment" },
  mention: { icon: AtSign, color: "#FFCB00", label: "Mention" },
  sprint_start: { icon: Target, color: "#00C875", label: "Sprint Started" },
  sprint_complete: { icon: Target, color: "#0073EA", label: "Sprint Complete" },
  status_change: { icon: ArrowRightLeft, color: "#FFCB00", label: "Status Changed" },
  share_accepted: { icon: Share2, color: "#00C875", label: "Board Shared" },
};

const DEFAULT_CONFIG = { icon: Bell, color: "#676879", label: "Notification" };

export default function NotificationBell({ onSelectTask, boardId }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list({ limit: 30 }),
    refetchInterval: 30000, // poll every 30s
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Mutations
  const markRead = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.read) {
      markRead.mutate(notification.id);
    }

    // Close dropdown
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-[#E1E5F3] transition-colors"
      >
        <Bell className="w-5 h-5 text-[#676879]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#E2445C] text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-[#E1E5F3] z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E1E5F3]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#323338]">Notifications</h3>
              {unreadCount > 0 && (
                <Badge className="bg-[#0073EA] text-white text-xs rounded-full px-2 py-0.5">
                  {unreadCount}
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#0073EA] hover:bg-[#0073EA]/10 rounded-lg"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-[#E1E5F3] mx-auto mb-2" />
                <p className="text-sm text-[#676879]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type] || DEFAULT_CONFIG;
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#F5F6F8] ${
                      !notification.read ? "bg-[#0073EA]/5" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#323338] leading-tight">
                        <span className="font-medium">{notification.title}</span>
                      </p>
                      {notification.message && (
                        <p className="text-xs text-[#676879] mt-0.5 truncate">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-[#676879] mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="w-2 h-2 bg-[#0073EA] rounded-full mt-2 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
