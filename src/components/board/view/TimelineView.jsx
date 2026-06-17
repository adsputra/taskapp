"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  format, differenceInDays, isSameDay,
  startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, addMonths, subMonths,
  startOfMonth, endOfMonth, addDays,
} from "date-fns";

const ROW_H = 44;
const LEFT_W = 220;

const ZOOMS = {
  day:   { dayW: 120, label: "Day" },
  week:  { dayW: 48,  label: "Week" },
  month: { dayW: 16,  label: "Month" },
};

/* ── helpers ── */
const getStatusColor = (item, board) => {
  const sc = board?.columns?.find((c) => c.type === "status");
  const sv = item.data?.[sc?.id];
  const opt = sc?.options?.choices?.find((c) => c.value === sv);
  return opt?.color || board?.color || "#0073EA";
};

const getPriorityColor = (item, board) => {
  const pc = board?.columns?.find((c) => c.type === "priority" || c.id === "priority");
  const pv = item.data?.[pc?.id];
  const map = { Critical: "#E2445C", High: "#FDAB3D", Medium: "#FFCB00", Low: "#00C875" };
  return map[pv] || null;
};

/* ── Gantt Bar ── */
const GanttBar = ({ item, board, dStart, dEnd, timelineStart, dayW, onClick, isSingleDate }) => {
  const offDays = Math.max(0, differenceInDays(dStart, timelineStart));
  let dur = differenceInDays(dEnd, dStart) + 1;
  if (dStart < timelineStart) dur = differenceInDays(dEnd, timelineStart) + 1;
  dur = Math.max(1, dur);

  const left = offDays * dayW;
  const width = Math.max(dur * dayW - 4, dayW - 4);
  const color = getStatusColor(item, board);

  return (
    <div
      onClick={onClick}
      className={`absolute top-[8px] h-[28px] rounded-md flex items-center px-2.5 text-xs font-medium truncate cursor-pointer shadow-sm hover:shadow-md hover:brightness-110 transition-all ${
        isSingleDate ? 'opacity-70 border-2 border-dashed' : 'text-white'
      }`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: isSingleDate ? color + '20' : color,
        borderColor: isSingleDate ? color : 'transparent',
        color: isSingleDate ? color : 'white',
      }}
      title={`${item.title}\n${format(dStart, "MMM d")} – ${format(dEnd, "MMM d")}${isSingleDate ? ' (single date)' : ''}`}
    >
      <span className="truncate drop-shadow-sm">{item.title}</span>
    </div>
  );
};

/* ── Milestone (single date) ── */
const GanttMilestone = ({ item, board, date, timelineStart, dayW, onClick }) => {
  const offDays = Math.max(0, differenceInDays(date, timelineStart));
  const left = offDays * dayW + dayW / 2;
  const color = getStatusColor(item, board);

  return (
    <div
      onClick={onClick}
      className="absolute top-[10px] cursor-pointer group/ms"
      style={{ left: `${left}px` }}
      title={`${item.title}\n${format(date, "MMM d, yyyy")}`}
    >
      <div
        className="w-[20px] h-[20px] rounded-sm rotate-45 -translate-x-1/2 shadow-sm group-hover/ms:scale-125 transition-transform"
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

/* ── Main ── */
export default function TimelineView({ board, items, onSelectTask }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoom, setZoom] = useState("week");
  const [dateColId, setDateColId] = useState(null);
  const [endColId, setEndColId] = useState(null);

  const dayW = ZOOMS[zoom].dayW;

  // Detect date columns
  useEffect(() => {
    if (!board?.columns) return;
    const dCols = board.columns.filter((c) => c.type === "date");
    if (dCols.length >= 2) {
      setDateColId(dCols[0].id);
      setEndColId(dCols[1].id);
    } else if (dCols.length === 1) {
      setDateColId(dCols[0].id);
      setEndColId(null);
    } else {
      const s = board.columns.find(
        (c) => c.id === "startDate" || c.id === "start_date" || c.title?.toLowerCase().includes("start")
      );
      const e = board.columns.find(
        (c) =>
          c.id === "endDate" || c.id === "end_date" || c.id === "due_date" ||
          c.title?.toLowerCase().includes("due") || c.title?.toLowerCase().includes("end")
      );
      setDateColId(s?.id || e?.id || null);
      setEndColId(e?.id || null);
    }
  }, [board]);

  // Timeline range
  const { start: tStart, end: tEnd, days } = useMemo(() => {
    let s, e;
    if (zoom === "day") {
      s = startOfWeek(currentDate, { weekStartsOn: 1 });
      e = addDays(s, 6);
    } else if (zoom === "week") {
      s = startOfWeek(currentDate, { weekStartsOn: 1 });
      e = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      s = startOfMonth(currentDate);
      e = endOfMonth(currentDate);
    }
    return { start: s, end: e, days: eachDayOfInterval({ start: s, end: e }) };
  }, [currentDate, zoom]);

  const nav = (dir) => {
    if (zoom === "month") setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
  };

  const headerLabel = () => {
    if (zoom === "day") return `${format(tStart, "MMM d")} – ${format(tEnd, "MMM d, yyyy")}`;
    if (zoom === "week") return `Week of ${format(tStart, "MMM d, yyyy")}`;
    return format(currentDate, "MMMM yyyy");
  };

  // Items with dates
  const displayItems = useMemo(() => {
    if (!dateColId) return [];
    const ec = endColId || dateColId;
    return items
      .map((item) => {
        const sStr = item.data?.[dateColId];
        const eStr = item.data?.[ec] || sStr;
        if (!sStr && !eStr) return null;
        const s = sStr ? new Date(sStr) : new Date(eStr);
        const e = eStr ? new Date(eStr) : s;
        if (isNaN(s.getTime())) return null;
        const ve = isNaN(e.getTime()) ? s : e;
        const ds = s > ve ? ve : s;
        const de = s > ve ? s : ve;

        // Determine if it's a real range or single date
        const hasTwoCols = !!endColId && !!sStr && !!item.data?.[ec];
        const isTrueRange = hasTwoCols && !isSameDay(s, ve);

        // For single-date items, create a 3-day bar ending on the date
        let barStart = ds;
        let barEnd = de;
        if (!isTrueRange) {
          barStart = addDays(ds, -2); // 3 days wide ending on the date
          barEnd = ds;
        }

        return { item, dStart: barStart, dEnd: barEnd, isRange: true, isSingleDate: !isTrueRange };
      })
      .filter(Boolean);
  }, [items, dateColId, endColId]);

  // Today
  const today = new Date();
  const todayOff = differenceInDays(today, tStart);
  const showToday = todayOff >= 0 && todayOff < days.length;

  if (!board) return null;

  if (!dateColId) {
    return (
      <div className="p-12 text-center">
        <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">No date column found</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          Add a Date-type column to your board to use the Timeline view.
        </p>
      </div>
    );
  }

  const totalW = days.length * dayW;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#E1E5F3] dark:border-slate-700 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E1E5F3] dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <h3 className="text-sm font-semibold text-[#323338] dark:text-slate-100">{headerLabel()}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E1E5F3] dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Today
          </button>
          <button onClick={() => nav(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex ml-2 border border-[#E1E5F3] dark:border-slate-600 rounded-lg overflow-hidden">
            {Object.entries(ZOOMS).map(([k, z]) => (
              <button
                key={k}
                onClick={() => setZoom(k)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  zoom === k
                    ? "bg-[#0073EA] text-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${LEFT_W + totalW}px` }}>
          {/* Day headers */}
          <div className="flex border-b border-[#E1E5F3] dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-[5]">
            <div
              className="flex-shrink-0 flex items-center px-4 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-r border-[#E1E5F3] dark:border-slate-700"
              style={{ width: `${LEFT_W}px`, height: "48px" }}
            >
              Task
            </div>
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-[#E1E5F3]/40 dark:border-slate-700/40 ${
                    isToday ? "bg-blue-50 dark:bg-blue-900/20" : isWeekend ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                  }`}
                  style={{ width: `${dayW}px`, height: "48px" }}
                >
                  <span className={`text-[9px] uppercase tracking-wide ${isToday ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-400 dark:text-slate-500"}`}>
                    {format(day, "EEE").charAt(0)}
                  </span>
                  <span
                    className={`text-xs font-medium leading-none mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-[#0073EA] text-white"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {displayItems.map(({ item, dStart, dEnd, isRange, isSingleDate }) => {
            const priColor = getPriorityColor(item, board);
            return (
              <div
                key={item.id}
                className="flex border-b border-[#E1E5F3]/50 dark:border-slate-700/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                style={{ height: `${ROW_H}px` }}
              >
                {/* Task name + priority dot */}
                <div
                  className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-[#E1E5F3] dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  style={{ width: `${LEFT_W}px` }}
                  onClick={() => onSelectTask?.(item)}
                  title={item.title}
                >
                  {priColor && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: priColor }}
                    />
                  )}
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.title}
                  </span>
                </div>

                {/* Timeline area */}
                <div className="flex-grow relative h-full">
                  {/* Weekend / today column bg */}
                  {days.map((day, i) => {
                    const isToday = isSameDay(day, today);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    if (!isToday && !isWeekend) return null;
                    return (
                      <div
                        key={day.toISOString()}
                        className={`absolute top-0 bottom-0 ${
                          isToday ? "bg-blue-50/40 dark:bg-blue-900/10" : "bg-slate-50/40 dark:bg-slate-800/20"
                        }`}
                        style={{ left: `${i * dayW}px`, width: `${dayW}px` }}
                      />
                    );
                  })}

                  {/* Today line */}
                  {showToday && (
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-[#E2445C] z-10"
                      style={{ left: `${todayOff * dayW + dayW / 2}px` }}
                    />
                  )}

                  {/* Bar */}
                  <GanttBar
                    item={item} board={board}
                    dStart={dStart} dEnd={dEnd}
                    timelineStart={tStart} dayW={dayW}
                    isSingleDate={isSingleDate}
                    onClick={() => onSelectTask?.(item)}
                  />
                </div>
              </div>
            );
          })}

          {displayItems.length === 0 && (
            <div className="p-12 text-center">
              <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No tasks with dates to display.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Set a due date on your tasks to see them on the timeline.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
