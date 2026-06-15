import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Diamond } from "lucide-react";
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, isSameDay, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const ROW_HEIGHT = 40; // px per item row
const HEADER_HEIGHT = 48;

const ZOOM_CONFIG = {
  day:   { dayWidth: 120, label: 'Day',   navUnit: 'week'  },
  week:  { dayWidth: 44,  label: 'Week',  navUnit: 'week'  },
  month: { dayWidth: 14,  label: 'Month', navUnit: 'month' },
};

/* ─── Timeline Bar (range) ─── */
const TimelineBar = ({ item, board, displayStart, displayEnd, timelineStartDate, dayWidth, onClick }) => {
  const offsetDays = Math.max(0, differenceInDays(displayStart, timelineStartDate));
  let durationDays = differenceInDays(displayEnd, displayStart) + 1;

  if (displayStart < timelineStartDate) {
    durationDays = differenceInDays(displayEnd, timelineStartDate) + 1;
  }
  durationDays = Math.max(1, durationDays);

  const left = offsetDays * dayWidth;
  const width = Math.max(durationDays * dayWidth - 4, dayWidth - 4);

  const statusCol = board?.columns?.find(c => c.type === 'status');
  const statusVal = item.data?.[statusCol?.id];
  const statusOption = statusCol?.options?.choices?.find(c => c.value === statusVal);
  const barColor = statusOption?.color || board?.color || '#0073EA';

  return (
    <div
      onClick={onClick}
      className="absolute h-[28px] rounded-lg flex items-center px-2.5 text-white text-xs font-semibold truncate cursor-pointer transition-all hover:brightness-110 hover:shadow-md group/bar"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: '6px',
        backgroundColor: barColor,
      }}
      title={`${item.title}\n${format(displayStart, 'MMM d')} – ${format(displayEnd, 'MMM d')}`}
    >
      <span className="truncate">{item.title}</span>
    </div>
  );
};

/* ─── Milestone (single-date) ─── */
const TimelineMilestone = ({ item, board, date, timelineStartDate, dayWidth, onClick }) => {
  const offsetDays = Math.max(0, differenceInDays(date, timelineStartDate));
  const left = offsetDays * dayWidth + dayWidth / 2 - 10;

  const statusCol = board?.columns?.find(c => c.type === 'status');
  const statusVal = item.data?.[statusCol?.id];
  const statusOption = statusCol?.options?.choices?.find(c => c.value === statusVal);
  const color = statusOption?.color || board?.color || '#0073EA';

  return (
    <div
      onClick={onClick}
      className="absolute cursor-pointer transition-transform hover:scale-125"
      style={{ left: `${left}px`, top: '4px' }}
      title={`${item.title}\n${format(date, 'MMM d, yyyy')}`}
    >
      <Diamond className="w-5 h-5 drop-shadow-sm" style={{ color, fill: color + '40' }} />
    </div>
  );
};

/* ─── Main Component ─── */
export default function TimelineView({ board, items, onSelectTask }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState('week');
  const [dateColId, setDateColId] = useState(null);
  const [endDateColId, setEndDateColId] = useState(null);

  const dayWidth = ZOOM_CONFIG[zoomLevel].dayWidth;

  // Detect date columns
  useEffect(() => {
    if (!board?.columns) return;
    const dateCols = board.columns.filter(col => col.type === 'date');
    if (dateCols.length >= 2) {
      setDateColId(dateCols[0].id);
      setEndDateColId(dateCols[1].id);
    } else if (dateCols.length === 1) {
      setDateColId(dateCols[0].id);
      setEndDateColId(null);
    } else {
      // Fallback: look for columns with date-like IDs
      const sDate = board.columns.find(c => c.id === 'startDate' || c.id === 'start_date' || c.title?.toLowerCase().includes('start'));
      const eDate = board.columns.find(c => c.id === 'endDate' || c.id === 'end_date' || c.id === 'due_date' || c.title?.toLowerCase().includes('due') || c.title?.toLowerCase().includes('end'));
      setDateColId(sDate?.id || eDate?.id || null);
      setEndDateColId(eDate?.id || null);
    }
  }, [board]);

  // Calculate timeline range
  const { timelineStartDate, timelineEndDate, daysHeader } = useMemo(() => {
    let start, end;
    if (zoomLevel === 'day') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 6);
    } else if (zoomLevel === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    return { timelineStartDate: start, timelineEndDate: end, daysHeader: eachDayOfInterval({ start, end }) };
  }, [currentDate, zoomLevel]);

  const handlePrev = () => {
    if (zoomLevel === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };
  const handleNext = () => {
    if (zoomLevel === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const getHeaderLabel = () => {
    if (zoomLevel === 'day') return `${format(timelineStartDate, 'MMM d')} – ${format(timelineEndDate, 'MMM d, yyyy')}`;
    if (zoomLevel === 'week') return `Week of ${format(timelineStartDate, 'MMM d, yyyy')}`;
    return format(currentDate, 'MMMM yyyy');
  };

  // Determine which items have dates
  const displayItems = useMemo(() => {
    if (!dateColId) return [];
    const effectiveEndCol = endDateColId || dateColId;
    return items
      .map(item => {
        const startStr = item.data?.[dateColId];
        const endStr = item.data?.[effectiveEndCol] || startStr;
        if (!startStr && !endStr) return null;

        const start = startStr ? new Date(startStr) : new Date(endStr);
        const end = endStr ? new Date(endStr) : start;

        if (isNaN(start.getTime())) return null;
        const validEnd = isNaN(end.getTime()) ? start : end;

        const dStart = start > validEnd ? validEnd : start;
        const dEnd = start > validEnd ? start : validEnd;
        const isRange = endDateColId && startStr && item.data?.[effectiveEndCol] && !isSameDay(start, validEnd);

        return { item, dStart, dEnd, isRange };
      })
      .filter(Boolean);
  }, [items, dateColId, endDateColId]);

  // Check if today is in view
  const today = new Date();
  const todayOffset = differenceInDays(today, timelineStartDate);
  const showTodayLine = todayOffset >= 0 && todayOffset < daysHeader.length;

  if (!board) return <div className="p-8 text-center text-gray-500 dark:text-slate-400">Board data not available.</div>;

  if (!dateColId) {
    return (
      <div className="p-12 text-center">
        <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">No date column found</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Add a Date-type column to your board to use the Timeline view.</p>
      </div>
    );
  }

  const totalWidth = daysHeader.length * dayWidth;

  return (
    <Card className="shadow-lg border-[#E1E5F3] dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <CardHeader className="p-3 border-b border-[#E1E5F3] dark:border-slate-700 flex flex-row items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
        <CardTitle className="text-base font-semibold text-[#323338] dark:text-slate-100">
          {getHeaderLabel()}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 dark:border-slate-600 dark:text-slate-300" onClick={handlePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 dark:border-slate-600 dark:text-slate-300" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 dark:border-slate-600 dark:text-slate-300" onClick={handleNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="flex ml-2 border border-[#E1E5F3] dark:border-slate-600 rounded-lg overflow-hidden">
            {Object.entries(ZOOM_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setZoomLevel(key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  zoomLevel === key
                    ? 'bg-[#0073EA] text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      {/* Timeline Body */}
      <CardContent className="p-0 overflow-x-auto">
        <div style={{ minWidth: `${200 + totalWidth}px` }}>
          {/* Day Header Row */}
          <div className="flex sticky top-0 bg-white dark:bg-slate-900 z-[5] border-b border-[#E1E5F3] dark:border-slate-700">
            <div className="w-[200px] flex-shrink-0 p-2.5 border-r border-[#E1E5F3] dark:border-slate-700 font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Task
            </div>
            {daysHeader.map((day, i) => {
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={day.toString()}
                  className={`flex-shrink-0 text-center py-1.5 border-r border-[#E1E5F3]/50 dark:border-slate-700/50 ${
                    isToday ? 'bg-blue-50 dark:bg-blue-900/20' : isWeekend ? 'bg-slate-50 dark:bg-slate-800/50' : ''
                  }`}
                  style={{ width: `${dayWidth}px` }}
                >
                  <div className={`text-[10px] uppercase ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-sm font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Item Rows */}
          <div className="relative">
            {displayItems.map(({ item, dStart, dEnd, isRange }, index) => (
              <div
                key={item.id}
                className="flex border-b border-[#E1E5F3]/60 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                {/* Task name */}
                <div
                  className="w-[200px] flex-shrink-0 px-3 flex items-center border-r border-[#E1E5F3] dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 truncate cursor-pointer hover:text-[#0073EA] dark:hover:text-blue-400 transition-colors"
                  title={item.title}
                  onClick={() => onSelectTask?.(item)}
                >
                  {item.title}
                </div>
                {/* Timeline area */}
                <div className="flex-grow relative h-full">
                  {/* Weekend / today column highlights */}
                  {daysHeader.map((day, i) => {
                    const isToday = isSameDay(day, today);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    if (!isToday && !isWeekend) return null;
                    return (
                      <div
                        key={day.toString()}
                        className={`absolute top-0 bottom-0 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-slate-50/50 dark:bg-slate-800/20'}`}
                        style={{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }}
                      />
                    );
                  })}

                  {/* Today line */}
                  {showTodayLine && (
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-blue-500 z-10"
                      style={{ left: `${todayOffset * dayWidth + dayWidth / 2}px` }}
                    />
                  )}

                  {/* Bar or Milestone */}
                  {isRange ? (
                    <TimelineBar
                      item={item}
                      board={board}
                      displayStart={dStart}
                      displayEnd={dEnd}
                      timelineStartDate={timelineStartDate}
                      dayWidth={dayWidth}
                      onClick={() => onSelectTask?.(item)}
                    />
                  ) : (
                    <TimelineMilestone
                      item={item}
                      board={board}
                      date={dStart}
                      timelineStartDate={timelineStartDate}
                      dayWidth={dayWidth}
                      onClick={() => onSelectTask?.(item)}
                    />
                  )}
                </div>
              </div>
            ))}

            {displayItems.length === 0 && (
              <div className="p-12 text-center">
                <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No tasks with dates to display.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Set a due date on your tasks to see them on the timeline.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
