"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

export default function FilterPanel({ filters, onChange, onClose, board }) {
  const statusColumn = board?.columns?.find((col) => col.type === "status");
  const priorityColumn = board?.columns?.find((col) => col.type === "priority");
  const statusOptions = statusColumn?.options?.choices || [];
  const priorityOptions = priorityColumn?.options?.choices || [];

  const toggleStatus = (value) => {
    const current = filters.status || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, status: next });
  };

  const togglePriority = (value) => {
    const current = filters.priority || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, priority: next });
  };

  const clearAll = () => {
    onChange({ status: [], people: [], priority: [] });
  };

  const activeCount =
    (filters.status?.length || 0) + (filters.priority?.length || 0);

  return (
    <div className="absolute top-full left-0 mt-1 w-64 bg-card rounded-xl shadow-xl border border-border z-50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-foreground text-sm">Filter</h4>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-primary hover:underline"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="text-subtle-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statusOptions.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Status
          </h5>
          <div className="space-y-2">
            {statusOptions.map((option) => {
              const isChecked = filters.status?.includes(option.label);
              return (
                <label
                  key={option.label}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1 py-1"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleStatus(option.label)}
                  />
                  <span className="text-sm text-foreground">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {priorityOptions.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Priority
          </h5>
          <div className="space-y-2">
            {priorityOptions.map((option) => {
              const isChecked = filters.priority?.includes(option.label);
              return (
                <label
                  key={option.label}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1 py-1"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => togglePriority(option.label)}
                  />
                  <span className="text-sm text-foreground">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
