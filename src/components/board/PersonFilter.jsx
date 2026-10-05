"use client";

import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

/** Emails in an item's owner cell — a single string or an array. */
export function itemAssignees(item) {
  const owner = item?.data?.owner;
  if (Array.isArray(owner)) return owner.filter((v) => typeof v === "string" && v);
  return typeof owner === "string" && owner ? [owner] : [];
}

export default function PersonFilter({
  items,
  selectedPeople,
  onChange,
  onClose,
}) {
  const uniquePeople = useMemo(() => {
    const people = new Set();
    items.forEach((item) => itemAssignees(item).forEach((email) => people.add(email)));
    return [...people].sort();
  }, [items]);

  const togglePerson = (person) => {
    const next = selectedPeople.includes(person)
      ? selectedPeople.filter((p) => p !== person)
      : [...selectedPeople, person];
    onChange(next);
  };

  return (
    <div className="absolute top-full left-0 mt-1 w-56 bg-card rounded-xl shadow-xl border border-border z-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-foreground text-sm">Filter by Person</h4>
        <button
          onClick={onClose}
          className="text-subtle-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {uniquePeople.length === 0 ? (
        <p className="text-sm text-subtle-foreground text-center py-4">
          No people assigned
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {uniquePeople.map((person) => (
            <label
              key={person}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1 py-1"
            >
              <Checkbox
                checked={selectedPeople.includes(person)}
                onCheckedChange={() => togglePerson(person)}
              />
              <span className="text-sm text-foreground">{person}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
