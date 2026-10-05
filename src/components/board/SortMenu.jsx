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
    <div className="absolute top-full left-0 mt-1 w-56 bg-card rounded-xl shadow-xl border border-border z-50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-foreground text-sm">Sort by</h4>
        <button
          onClick={onClose}
          className="text-subtle-foreground hover:text-foreground"
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
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted"
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
