"use client";

import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

export default function PersonFilter({
  items,
  selectedPeople,
  onChange,
  onClose,
}) {
  const uniquePeople = useMemo(() => {
    const people = new Set();
    items.forEach((item) => {
      const owner = item.data?.owner;
      if (owner) people.add(owner);
    });
    return [...people].sort();
  }, [items]);

  const togglePerson = (person) => {
    const next = selectedPeople.includes(person)
      ? selectedPeople.filter((p) => p !== person)
      : [...selectedPeople, person];
    onChange(next);
  };

  return (
    <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-[#E1E5F3] z-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-[#323338] text-sm">Filter by Person</h4>
        <button
          onClick={onClose}
          className="text-[#A0A0A0] hover:text-[#323338]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {uniquePeople.length === 0 ? (
        <p className="text-sm text-[#A0A0A0] text-center py-4">
          No people assigned
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {uniquePeople.map((person) => (
            <label
              key={person}
              className="flex items-center gap-2 cursor-pointer hover:bg-[#F5F6F8] rounded px-1 py-1"
            >
              <Checkbox
                checked={selectedPeople.includes(person)}
                onCheckedChange={() => togglePerson(person)}
              />
              <span className="text-sm text-[#323338]">{person}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
