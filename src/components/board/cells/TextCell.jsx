import React, { useState } from 'react';
import { Input } from "@/components/ui/input";

export default function TextCell({ value, onUpdate }) {
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
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyPress}
        className="border-none bg-transparent p-0 h-auto focus:ring-0 text-[#323338] font-medium"
        autoFocus
      />
    );
  }

  return (
    <div
      className={`text-[#323338] font-medium px-2 py-1 -mx-2 transition-colors ${onUpdate ? 'cursor-pointer hover:bg-[#E1E5F3] hover:rounded' : ''}`}
      onClick={() => onUpdate && setIsEditing(true)}
    >
      {value || 'Enter text...'}
    </div>
  );
}
