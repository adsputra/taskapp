"use client";

import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { activityApi } from "@/lib/api/activity";
import {
  Edit3, Plus, Trash2, Paperclip,
  ArrowRightLeft, UserCheck, CircleDot,
} from "lucide-react";

const ACTION_CONFIG = {
  created: { icon: Plus, color: "text-[#00C875]", bg: "bg-[#00C875]/10", label: "created task" },
  updated: { icon: Edit3, color: "text-[#0073EA]", bg: "bg-[#0073EA]/10", label: "updated" },
  deleted: { icon: Trash2, color: "text-[#E2445C]", bg: "bg-[#E2445C]/10", label: "deleted task" },
  attached: { icon: Paperclip, color: "text-[#FDAB3D]", bg: "bg-[#FDAB3D]/10", label: "attached file" },
  status_changed: { icon: CircleDot, color: "text-[#FFCB00]", bg: "bg-[#FFCB00]/10", label: "changed status" },
  assigned: { icon: UserCheck, color: "text-[#0073EA]", bg: "bg-[#0073EA]/10", label: "assigned" },
};

const FIELD_LABELS = {
  title: "Title",
  description: "Description",
  status: "Status",
  priority: "Priority",
  owner: "Owner",
  due_date: "Due Date",
  start_date: "Start Date",
  end_date: "End Date",
  budget: "Salary",
  salary: "Salary",
  tags: "Tags",
  people: "People",
  number: "Number",
  checkbox: "Checkbox",
  dropdown: "Dropdown",
  subtask: "Subtask",
};

export default function ActivityTab({ task }) {
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activity", task?.id],
    queryFn: () => activityApi.listByItem(task.id),
    enabled: !!task?.id,
  });

  // Listen for real-time activity updates and refetch
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.itemId === task?.id) {
        queryClient.invalidateQueries({ queryKey: ["activity", task.id] });
      }
    };
    window.addEventListener("activity-updated", handler);
    return () => window.removeEventListener("activity-updated", handler);
  }, [task?.id, queryClient]);

  // Filter out comments — they have their own tab
  const filtered = activities.filter((a) => a.action !== "commented");

  // Group activities by date
  const grouped = filtered.reduce((acc, activity) => {
    const date = new Date(activity.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let group;
    if (date.toDateString() === today.toDateString()) {
      group = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = "Yesterday";
    } else {
      group = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    }

    if (!acc[group]) acc[group] = [];
    acc[group].push(activity);
    return acc;
  }, {});

  const getUserInitial = (email) => email?.charAt(0).toUpperCase() || "?";
  const getUserColor = (name) => {
    const colors = ["#0073EA", "#00C875", "#FFCB00", "#E2445C", "#A25DDC", "#FDAB3D"];
    const hash = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatFieldName = (name) => {
    if (!name) return "Field";
    // Already formatted (new entries from API)
    const lower = name.toLowerCase().replace(/ /g, "_");
    if (FIELD_LABELS[lower]) return FIELD_LABELS[lower];
    if (FIELD_LABELS[name]) return FIELD_LABELS[name];
    // Fallback: capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <div className="p-6">
      {activities.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-[#F5F6F8] dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <ArrowRightLeft className="w-5 h-5 text-[#A0A0A0] dark:text-slate-600" />
          </div>
          <p className="text-sm text-[#676879] dark:text-slate-400">No activity yet</p>
          <p className="text-xs text-[#A0A0A0] dark:text-slate-600 mt-1">Changes to this task will appear here</p>
        </div>
      )}

      {Object.entries(grouped).map(([dateGroup, items]) => (
        <div key={dateGroup} className="mb-6 last:mb-0">
          <h4 className="text-xs font-semibold text-[#676879] dark:text-slate-500 uppercase tracking-wide mb-3">
            {dateGroup}
          </h4>
          <div className="space-y-0">
            {items.map((activity, idx) => {
              const config = ACTION_CONFIG[activity.action] || ACTION_CONFIG.updated;
              const Icon = config.icon;
              const userName = activity.profiles?.full_name || activity.user_id?.slice(0, 8);

              return (
                <div key={activity.id} className="flex gap-3 relative">
                  {/* Timeline line */}
                  {idx < items.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-[#E1E5F3] dark:bg-slate-800" />
                  )}

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${config.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-sm font-medium text-[#323338] dark:text-slate-200">{userName}</span>
                      <span className="text-xs text-[#676879] dark:text-slate-500">{config.label}</span>
                      {activity.field_name && (
                        <span className="text-xs font-medium text-[#323338] dark:text-slate-300">
                          {formatFieldName(activity.field_name)}
                        </span>
                      )}
                    </div>

                    {/* Old -> New values */}
                    {(activity.old_value || activity.new_value) && (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        {activity.old_value && (
                          <span className="px-2 py-0.5 bg-[#E2445C]/10 text-[#E2445C] rounded line-through">
                            {activity.old_value}
                          </span>
                        )}
                        {(activity.old_value && activity.new_value) && (
                          <ArrowRightLeft className="w-3 h-3 text-[#A0A0A0] shrink-0" />
                        )}
                        {activity.new_value && (
                          <span className="px-2 py-0.5 bg-[#00C875]/10 text-[#00C875] rounded">
                            {activity.new_value}
                          </span>
                        )}
                      </div>
                    )}

                    <span className="text-[10px] text-[#A0A0A0] dark:text-slate-600 mt-1 block">
                      {formatTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
