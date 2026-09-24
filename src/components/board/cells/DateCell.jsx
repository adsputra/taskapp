"use client";

import React, { useState, useMemo } from 'react';
import {
  format,
  parseISO,
  isValid,
  isToday,
  isPast,
  startOfDay,
  addDays,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseSafeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isValid(val) ? val : null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      const dObj = new Date(y, m - 1, d);
      return isValid(dObj) ? dObj : null;
    }
    const isoParsed = parseISO(trimmed);
    if (isValid(isoParsed)) return isoParsed;
    const directDate = new Date(trimmed);
    if (isValid(directDate)) return directDate;
  }
  return null;
}

export default function DateCell({ value, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const parsedDate = useMemo(() => parseSafeDate(value), [value]);

  // Current viewing month for the calendar
  const [viewingMonth, setViewingMonth] = useState(() => parsedDate || new Date());

  const handleOpenChange = (open) => {
    if (!onUpdate) return;
    if (open) {
      setViewingMonth(parsedDate || new Date());
    }
    setIsOpen(open);
  };

  const handleSelectDate = (date) => {
    if (!onUpdate) return;
    const formatted = format(date, 'yyyy-MM-dd');
    onUpdate(formatted);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    if (onUpdate) onUpdate(null);
    setIsOpen(false);
  };

  // Calendar dates generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewingMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [viewingMonth]);

  // Urgency states
  const isOverdue = parsedDate && isPast(startOfDay(parsedDate)) && !isToday(parsedDate);
  const isDueToday = parsedDate && isToday(parsedDate);
  const isDueTomorrow = parsedDate && isSameDay(parsedDate, addDays(new Date(), 1));

  const displayDateText = useMemo(() => {
    if (!parsedDate) return null;
    if (isDueToday) return 'Today';
    if (isDueTomorrow) return 'Tomorrow';
    const isThisYear = parsedDate.getFullYear() === new Date().getFullYear();
    return format(parsedDate, isThisYear ? 'MMM d' : 'MMM d, yyyy');
  }, [parsedDate, isDueToday, isDueTomorrow]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div className="w-full h-full flex items-center justify-center">
          {!parsedDate ? (
            <button
              type="button"
              disabled={!onUpdate}
              className={cn(
                "group inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150",
                "text-[#676879] dark:text-slate-400 bg-[#F5F6F8] hover:bg-[#E1E5F3] dark:bg-slate-800 dark:hover:bg-slate-700",
                "border border-dashed border-[#D0D4E4] hover:border-[#0073EA] dark:border-slate-700 dark:hover:border-blue-500",
                "hover:text-[#0073EA] dark:hover:text-blue-400 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95",
                !onUpdate && "cursor-default opacity-60 pointer-events-none"
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#676879] group-hover:text-[#0073EA] dark:text-slate-400 dark:group-hover:text-blue-400 transition-colors shrink-0" />
              <span className="whitespace-nowrap">Set date</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!onUpdate}
              className={cn(
                "group relative inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95",
                isOverdue
                  ? "bg-[#E2445C]/10 text-[#E2445C] border border-[#E2445C]/30 hover:bg-[#E2445C]/20 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50"
                  : isDueToday
                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
                  : isDueTomorrow
                  ? "bg-[#0073EA]/10 text-[#0073EA] border border-[#0073EA]/30 hover:bg-[#0073EA]/20 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50"
                  : "bg-slate-100/90 text-[#323338] border border-slate-200/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700",
                !onUpdate && "cursor-default opacity-80 pointer-events-none"
              )}
            >
              {isOverdue && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#E2445C] shrink-0 animate-pulse" />
              )}
              {isDueToday && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              )}
              {!isOverdue && !isDueToday && (
                <CalendarIcon className="w-3.5 h-3.5 text-[#676879] dark:text-slate-400 shrink-0" />
              )}
              <span className="whitespace-nowrap">{displayDateText}</span>

              {onUpdate && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClear(e);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 -mr-1 ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all text-[#676879] hover:text-[#E2445C] dark:text-slate-400"
                  title="Clear date"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[280px] p-3 bg-white dark:bg-slate-900 border border-[#E1E5F3] dark:border-slate-800 rounded-xl shadow-xl z-50 text-slate-800 dark:text-slate-100"
        align="center"
        sideOffset={6}
      >
        {/* Quick Presets */}
        <div className="grid grid-cols-4 gap-1 mb-2.5 pb-2.5 border-b border-[#E1E5F3] dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSelectDate(new Date())}
            className="px-1.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-[#0073EA] hover:text-white dark:bg-slate-800 dark:hover:bg-[#0073EA] text-slate-700 dark:text-slate-300 transition-colors text-center"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleSelectDate(addDays(new Date(), 1))}
            className="px-1.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-[#0073EA] hover:text-white dark:bg-slate-800 dark:hover:bg-[#0073EA] text-slate-700 dark:text-slate-300 transition-colors text-center"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => handleSelectDate(addDays(new Date(), 7))}
            className="px-1.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-[#0073EA] hover:text-white dark:bg-slate-800 dark:hover:bg-[#0073EA] text-slate-700 dark:text-slate-300 transition-colors text-center"
          >
            +1 Week
          </button>
          <button
            type="button"
            onClick={() => handleSelectDate(addDays(new Date(), 14))}
            className="px-1.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-[#0073EA] hover:text-white dark:bg-slate-800 dark:hover:bg-[#0073EA] text-slate-700 dark:text-slate-300 transition-colors text-center"
          >
            +2 Weeks
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-2 px-0.5">
          <button
            type="button"
            onClick={() => setViewingMonth(subMonths(viewingMonth, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#676879] dark:text-slate-300 transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-[#323338] dark:text-slate-100">
            {format(viewingMonth, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={() => setViewingMonth(addMonths(viewingMonth, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#676879] dark:text-slate-300 transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-[10px] font-semibold text-[#676879] dark:text-slate-400 py-0.5">
              {day}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const isSelected = parsedDate && isSameDay(day, parsedDate);
            const isTodayDate = isToday(day);
            const isCurrentMonth = isSameMonth(day, viewingMonth);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleSelectDate(day)}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all mx-auto",
                  isSelected
                    ? "bg-[#0073EA] text-white font-semibold shadow-xs hover:bg-[#0060c0]"
                    : isTodayDate
                    ? "ring-1.5 ring-[#0073EA] text-[#0073EA] dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    : isCurrentMonth
                    ? "text-[#323338] dark:text-slate-200 hover:bg-[#E1E5F3]/70 dark:hover:bg-slate-800"
                    : "text-[#A2A4B2] dark:text-slate-600 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-2.5 pt-2 border-t border-[#E1E5F3] dark:border-slate-800 flex items-center justify-between text-xs">
          {parsedDate ? (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#E2445C] hover:bg-[#E2445C]/10 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear date</span>
            </button>
          ) : (
            <span className="text-[11px] text-[#676879] dark:text-slate-400 pl-1">
              Select date
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 text-xs font-medium text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
