import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, Minus, ArrowUp, Flame } from "lucide-react";

const PRIORITY_ICONS = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  critical: Flame,
};

export default function PriorityCell({ value, onUpdate, options }) {
  const choices = options?.choices || [
    { value: 'low', label: 'Low', color: '#787D80' },
    { value: 'medium', label: 'Medium', color: '#FFCB00' },
    { value: 'high', label: 'High', color: '#FDAB3D' },
    { value: 'critical', label: 'Critical', color: '#E2445C' }
  ];
  
  const selectedChoice = choices.find(c => c.value === value);

  const handleValueChange = (newValue) => {
    if (onUpdate) onUpdate(newValue);
  };

  const renderBadge = (choice) => {
    const IconComponent = PRIORITY_ICONS[choice.value] || Minus;
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border"
        style={{
          borderColor: `${choice.color}40`,
          backgroundColor: `${choice.color}10`,
        }}
      >
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: choice.color }}
        >
          <IconComponent className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
        </span>
        <span
          className="text-xs font-semibold leading-none"
          style={{ color: choice.color }}
        >
          {choice.label}
        </span>
      </div>
    );
  };

  return (
    <div className={`flex items-center justify-center w-full h-full ${!onUpdate ? 'pointer-events-none' : ''}`}>
      <Select value={value || ""} onValueChange={handleValueChange}>
        <SelectTrigger className="w-fit p-0 pr-1 border-none bg-transparent text-sm focus:ring-0 shadow-none h-auto">
          {selectedChoice ? (
            renderBadge(selectedChoice)
          ) : (
            <SelectValue placeholder="Set priority..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => {
            const IconComponent = PRIORITY_ICONS[choice.value] || Minus;
            return (
              <SelectItem key={choice.value} value={choice.value}>
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: choice.color }}
                  >
                    <IconComponent className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                  </span>
                  <span>{choice.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
