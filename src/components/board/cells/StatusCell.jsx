import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function StatusCell({ value, options, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  
  const choices = options?.choices || [
    { label: 'Not Started', color: '#C4C4C4' },
    { label: 'Working on it', color: '#FFCB00' },
    { label: 'Done', color: '#00C875' },
    { label: 'Stuck', color: '#E2445C' }
  ];
  
  const currentChoice = choices.find(choice => 
    choice.label.toLowerCase() === (value || '').toLowerCase()
  ) || choices[0];

  if (isEditing) {
    return (
      <Select
        value={currentChoice.label}
        onValueChange={(newValue) => {
          onUpdate(newValue);
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
            <SelectItem key={choice.label} value={choice.label}>
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
    <Badge
      className="cursor-pointer border-none text-white font-medium px-3 py-1 hover:opacity-80 transition-opacity"
      style={{ backgroundColor: currentChoice.color }}
      onClick={() => setIsEditing(true)}
    >
      {currentChoice.label}
    </Badge>
  );
}