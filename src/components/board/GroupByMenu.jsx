"use client";

import React from "react";
import { X, Check } from "lucide-react";

const GROUP_OPTIONS = [
  { id: "group", label: "Group" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "people", label: "People" },
];

export default function GroupByMenu({ groupBy, columns, onChange, onClose }) {
  // Check which grouping options are available
  const hasStatus = columns?.some((col) => col.type === "status");
  const hasPriority = columns?.some((col) => col.type === "priority");
  const hasPeople = columns?.some((col) => col.type === "people");

  const availableOptions = GROUP_OPTIONS.filter((opt) => {
    if (opt.id === "group") return true;
    if (opt.id === "status") return hasStatus;
    if (opt.id === "priority") return hasPriority;
    if (opt.id === "people") return hasPeople;
    return false;
  });

  return (
    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-[#E1E5F3] z-50 p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <h4 className="font-semibold text-[#323338] text-sm">Group by</h4>
        <button
          onClick={onClose}
          className="text-[#A0A0A0] hover:text-[#323338]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-0.5">
        {availableOptions.map((opt) => {
          const isActive = groupBy === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[#0073EA]/10 text-[#0073EA] font-medium"
                  : "text-[#323338] hover:bg-[#F5F6F8]"
              }`}
            >
              {opt.label}
              {isActive && <Check className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
