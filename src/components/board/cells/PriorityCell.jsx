import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PriorityCell({ value, onUpdate, column }) {
  const [isEditing, setIsEditing] = useState(false);

  const choices = column?.options?.choices || [
    { value: 'low', label: 'Low', color: '#C4C4C4' },
    { value: 'medium', label: 'Medium', color: '#FFCB00' },
    { value: 'high', label: 'High', color: '#FDAB3D' },
    { value: 'critical', label: 'Critical', color: '#E2445C' }
  ];

  const currentChoice = choices.find(c => 
    c.value?.toLowerCase() === (value || '').toLowerCase() ||
    c.label?.toLowerCase() === (value || '').toLowerCase()
  );

  if (isEditing) {
    return (
      <Select
        value={currentChoice?.value || ""}
        onValueChange={(newValue) => {
          if (onUpdate) onUpdate(newValue);
          setIsEditing(false);
        }}
        onOpenChange={(open) => {
          if (!open) setIsEditing(false);
        }}
        open={true}
      >
        <SelectTrigger className="w-full border-none p-0 h-auto focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: choice.color }}
                />
                <span>{choice.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${onUpdate ? 'cursor-pointer' : ''}`}
      onClick={() => onUpdate && setIsEditing(true)}
    >
      {currentChoice ? (
        <Badge
          className={`border-none text-white font-medium px-3 py-1 rounded-full text-xs ${onUpdate ? 'hover:opacity-80 transition-opacity' : ''}`}
          style={{ backgroundColor: currentChoice.color }}
        >
          {currentChoice.label}
        </Badge>
      ) : (
        <Badge
          className={`border-none text-white font-medium px-3 py-1 rounded-full text-xs bg-[#C4C4C4] ${onUpdate ? 'hover:opacity-80 transition-opacity' : ''}`}
        >
          Set priority...
        </Badge>
      )}
    </div>
  );
}
