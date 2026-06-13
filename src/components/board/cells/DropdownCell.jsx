"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DropdownCell({ value, column, onUpdate }) {
  const choices = column?.options?.choices || [];

  return (
    <Select value={value || ""} onValueChange={(v) => onUpdate && onUpdate(v)}>
      <SelectTrigger className={`w-full border-0 bg-transparent focus:ring-0 text-sm h-auto p-0 ${!onUpdate ? 'cursor-default' : ''}`}>
        <SelectValue placeholder="Pilih..." />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
