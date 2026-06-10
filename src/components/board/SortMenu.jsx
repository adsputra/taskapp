"use client";

import React from "react";
import { X, ArrowUpDown } from "lucide-react";

export default function SortMenu({
  sortBy,
  sortDirection,
  columns,
  onChange,
  onClose,
}) {
  const sortableColumns = columns?.filter(
    (col) => col.type !== "checkbox" && col.type !== "tags"
  ) || [];

  return (
    <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-[#E1E5F3] z-50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-[#323338] text-sm">Sort by</h4>
        <button
          onClick={onClose}
          className="text-[#A0A0A0] hover:text-[#323338]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1">
        {sortableColumns.map((col) => {
          const isActive = sortBy === col.id;
          return (
            <button
              key={col.id}
              onClick={() => {
                const newDirection =
                  isActive && sortDirection === "asc" ? "desc" : "asc";
                onChange(col.id, newDirection);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[#0073EA]/10 text-[#0073EA] font-medium"
                  : "text-[#323338] hover:bg-[#F5F6F8]"
              }`}
            >
              <span>{col.title}</span>
              {isActive && (
                <ArrowUpDown
                  className={`w-3.5 h-3.5 ${
                    sortDirection === "desc" ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
