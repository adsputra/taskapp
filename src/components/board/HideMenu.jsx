"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

export default function HideMenu({ columns, hiddenColumns, onChange, onClose }) {
  const toggleColumn = (colId) => {
    const next = new Set(hiddenColumns);
    if (next.has(colId)) {
      next.delete(colId);
    } else {
      next.add(colId);
    }
    onChange(next);
  };

  const hideableColumns = columns?.filter((col) => col.id !== "task") || [];

  return (
    <div className="absolute top-full left-0 mt-1 w-56 bg-card rounded-xl shadow-xl border border-border z-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-foreground text-sm">Hide Columns</h4>
        <button
          onClick={onClose}
          className="text-subtle-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {hideableColumns.map((col) => (
          <label
            key={col.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1 py-1"
          >
            <Checkbox
              checked={!hiddenColumns?.has(col.id)}
              onCheckedChange={() => toggleColumn(col.id)}
            />
            <span className="text-sm text-foreground">{col.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
