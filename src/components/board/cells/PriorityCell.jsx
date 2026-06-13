import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="flex items-center justify-center w-full h-full">
      <Select value={value || ""} onValueChange={handleValueChange}>
        <SelectTrigger className={`w-auto p-0 pr-1 border-none bg-transparent text-sm focus:ring-0 shadow-none h-auto ${!onUpdate ? 'cursor-default' : ''}`}>
          {selectedChoice ? (
            <Badge 
              style={{ 
                backgroundColor: selectedChoice.color ? `${selectedChoice.color}20` : '#e5e7eb', 
                color: selectedChoice.color || '#374151',
              }}
              className="font-medium text-xs px-3 py-1 border-none"
            >
              {selectedChoice.label}
            </Badge>
          ) : (
            <SelectValue placeholder="Set priority..." />
          )}
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
    </div>
  );
}
