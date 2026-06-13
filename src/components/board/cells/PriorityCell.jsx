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
    <Select value={value || ""} onValueChange={handleValueChange}>
      <SelectTrigger className={`w-full p-0 border-none bg-transparent text-sm focus:ring-0 shadow-none h-auto justify-center ${!onUpdate ? 'cursor-default' : ''}`}>
        {selectedChoice ? (
          <Badge 
            style={{ 
              backgroundColor: selectedChoice.color ? `${selectedChoice.color}20` : '#e5e7eb', 
              color: selectedChoice.color || '#374151',
            }}
            className="font-normal text-xs px-2.5 py-0.5 border-none"
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
  );
}
