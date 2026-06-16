import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";

// Format number with dots as thousand separator (Indonesian style)
const formatRupiah = (num) => {
  if (!num && num !== 0) return '0';
  return Number(num).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Strip non-digits and return clean number
const stripDots = (str) => str.replace(/\./g, '').replace(/[^0-9]/g, '');

export default function BudgetCell({ value, onUpdate, options }) {
  const [currentValue, setCurrentValue] = useState(value || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const inputRef = useRef(null);

  const getCurrencyConfig = () => {
    const c = options?.currency;
    if (c === 'ILS') return { prefix: '₪', decimals: 2, locale: undefined };
    if (c === 'USD') return { prefix: '$', decimals: 2, locale: undefined };
    // Default to IDR (Rupiah)
    return { prefix: 'Rp ', decimals: 0, locale: 'id-ID' };
  };
  const { prefix, decimals, locale } = getCurrencyConfig();

  useEffect(() => {
    setCurrentValue(value || 0);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Set initial display to formatted value
      setDisplayValue(formatRupiah(value || 0));
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const numericValue = parseInt(stripDots(displayValue)) || 0;
    if (numericValue !== parseFloat(value) && onUpdate) {
      onUpdate(numericValue);
    }
    setCurrentValue(numericValue);
  };

  const handleChange = (e) => {
    const raw = stripDots(e.target.value);
    // Limit to reasonable number
    const num = parseInt(raw) || 0;
    setDisplayValue(formatRupiah(num));
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
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-full w-full p-1 border-none focus:ring-1 focus:ring-blue-500 bg-transparent text-sm text-center"
      />
    );
  }

  const formattedValue = locale
    ? Number(currentValue).toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : Number(currentValue).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <div 
      onClick={() => onUpdate && setIsEditing(true)} 
      className={`w-full h-full flex items-center justify-center text-sm text-[#323338] dark:text-slate-200 rounded ${onUpdate ? 'cursor-pointer hover:bg-[#E1E5F3]/50 dark:hover:bg-slate-700' : ''}`}
    >
      {prefix}{formattedValue}
    </div>
  );
}
