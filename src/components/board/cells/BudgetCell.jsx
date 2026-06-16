import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";

export default function BudgetCell({ value, onUpdate, options }) {
  const [currentValue, setCurrentValue] = useState(value || 0);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  const getCurrencyConfig = () => {
    const c = options?.currency;
    if (c === 'ILS') return { prefix: '₪', decimals: 2 };
    if (c === 'USD') return { prefix: '$', decimals: 2 };
    // Default to IDR (Rupiah)
    return { prefix: 'Rp ', decimals: 0 };
  };
  const { prefix, decimals } = getCurrencyConfig();

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
        step={decimals === 0 ? "1" : "0.01"}
      />
    );
  }

  return (
    <div 
      onClick={() => onUpdate && setIsEditing(true)} 
      className={`w-full h-full flex items-center justify-center text-sm text-[#323338] dark:text-slate-200 rounded ${onUpdate ? 'cursor-pointer hover:bg-[#E1E5F3]/50 dark:hover:bg-slate-700' : ''}`}
    >
      {prefix}{Number(currentValue).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </div>
  );
}
