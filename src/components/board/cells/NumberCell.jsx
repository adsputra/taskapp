import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";

export default function NumberCell({ value, onUpdate }) {
  const [currentValue, setCurrentValue] = useState(value || 0);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setCurrentValue(value || 0);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const numericValue = parseFloat(currentValue) || 0;
    if (numericValue !== parseFloat(value) && onUpdate) {
      onUpdate(numericValue);
    }
    setCurrentValue(numericValue);
  };

  const handleChange = (e) => {
    setCurrentValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setCurrentValue(value || 0);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={currentValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-full w-full p-1 border-none focus:ring-1 focus:ring-blue-500 bg-transparent text-sm"
      />
    );
  }

  return (
    <div 
      onClick={() => onUpdate && setIsEditing(true)} 
      className={`w-full h-full flex items-center justify-center text-sm text-[#323338] rounded ${onUpdate ? 'cursor-pointer hover:bg-[#E1E5F3]/50' : ''}`}
    >
      {Number(currentValue).toLocaleString()}
    </div>
  );
}
