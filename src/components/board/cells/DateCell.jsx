import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

export default function DateCell({ value, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');

  const handleSave = () => {
    if (onUpdate) onUpdate(editValue);
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyPress}
        className="border-none bg-transparent p-0 h-auto focus:ring-0 text-[#323338]"
        autoFocus
      />
    );
  }

  if (!value) {
    return (
      <div
        className={`text-[#676879] px-2 py-1 -mx-2 transition-colors flex items-center gap-2 ${onUpdate ? 'cursor-pointer hover:bg-[#E1E5F3] hover:rounded' : ''}`}
        onClick={() => onUpdate && setIsEditing(true)}
      >
        <Calendar className="w-4 h-4" />
        <span>Set date</span>
      </div>
    );
  }

  const isOverdue = new Date(value) < new Date() && new Date(value).toDateString() !== new Date().toDateString();
  
  return (
    <div
      className={`px-2 py-1 -mx-2 rounded text-sm ${
        onUpdate ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      } ${
        isOverdue ? 'bg-[#E2445C]/10 text-[#E2445C]' : 'text-[#323338]'
      }`}
      onClick={() => onUpdate && setIsEditing(true)}
    >
      {format(new Date(value), 'MMM d')}
    </div>
  );
}