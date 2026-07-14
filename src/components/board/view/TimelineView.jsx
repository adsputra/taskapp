"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Filter, ArrowUpDown, Plus, LayoutGrid, Leaf, Check } from "lucide-react";
import {
  format, differenceInDays, isSameDay,
  startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, addMonths, subMonths,
  startOfMonth, endOfMonth, addDays, getMonth, getYear, isWeekend
} from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import MemberAvatars from "../MemberAvatars";

const ROW_H = 56;
const LEFT_W = 260;

const ZOOMS = {
  day: { dayW: 120, label: "Day" },
  week: { dayW: 60, label: "Week" },
  month: { dayW: 30, label: "Month" },
};

const GRADIENTS = [
  "linear-gradient(to right, #7966f2, #ed8fbb, #fdb579)",
  "linear-gradient(to right, #43e97b, #38f9d7)",
  "linear-gradient(to right, #fa709a, #fee140)",
  "linear-gradient(to right, #30cfd0, #330867)",
  "linear-gradient(to right, #a18cd1, #fbc2eb)",
];

const getPriorityColor = (item, board) => {
  const pc = board?.columns?.find((c) => c.type === "priority" || c.id === "priority");
  const pv = item.data?.[pc?.id];
  const map = { Critical: "#E2445C", High: "#FDAB3D", Medium: "#FFCB00", Low: "#00C875" };
  return map[pv] || null;
};

const getStatusColor = (item, board) => {
  const sc = board?.columns?.find((c) => c.type === "status");
  const sv = item.data?.[sc?.id];
  const opt = sc?.options?.choices?.find((c) => c.value === sv);
  return opt?.color || board?.color || "#0073EA";
};

function getAssignedEmails(item, board) {
  const pc = board?.columns?.find((c) => c.type === "people");
  if (!pc) return [];
  const val = item.data?.[pc.id];
  return Array.isArray(val) ? val : val ? [val] : [];
}

const AVATAR_COLORS = ["#0073EA", "#00C875", "#E2445C", "#FF9900", "#7F63FF", "#00B5D8"];
function getUserColor(email) {
  let hash = 0;
  for (let i = 0; i < (email || "").length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getUserInitial(email) {
  return email ? email.charAt(0).toUpperCase() : "?";
}

/* ── Gantt Bar (Range) ── */
const GanttBar = ({ item, board, dStart, dEnd, timelineStart, dayW, onClick }) => {
  const offDays = Math.max(0, differenceInDays(dStart, timelineStart));
  let dur = differenceInDays(dEnd, dStart) + 1;
  if (dStart < timelineStart) dur = differenceInDays(dEnd, timelineStart) + 1;
  dur = Math.max(1, dur);

  const left = offDays * dayW;
  const width = Math.max(dur * dayW - 12, dayW - 12);
  const emails = getAssignedEmails(item, board);
  
  // Use item id hash for deterministic gradient
  let idHash = 0;
  for(let i=0; i<(item.id||"").length; i++) idHash += item.id.charCodeAt(i);
  const gradient = GRADIENTS[idHash % GRADIENTS.length];

  return (
    <div
      onClick={onClick}
      className="absolute top-[8px] h-[40px] rounded-r-xl rounded-l-xl flex items-center shadow-sm cursor-pointer hover:shadow-md transition-shadow group overflow-hidden"
      style={{
        left: `${left + 6}px`,
        width: `${width}px`,
        background: gradient,
      }}
      title={`${item.title}\n${format(dStart, "MMM d")} – ${format(dEnd, "MMM d")}`}
    >
      {/* Left handle */}
      <div className="w-4 h-full flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-0.5 h-3 bg-white/50 rounded-full mb-0.5" />
        <div className="w-0.5 h-3 bg-white/50 rounded-full" />
      </div>

      <div className="flex-1 min-w-0 pl-1 pr-2 flex items-center gap-1.5 h-full text-white">
        <div className="w-4 flex-shrink-0 flex justify-center">
           <Leaf className="w-3.5 h-3.5 text-white/90" />
        </div>
        <span className="text-xs font-medium truncate drop-shadow-sm pb-0.5">
          {item.title}
        </span>
      </div>

      {/* Avatars */}
      {emails.length > 0 && (
        <div className="flex items-center px-2 mr-1">
          <div className="flex -space-x-1.5">
            {emails.slice(0, 3).map((email, i) => (
              <span
                key={i}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-white/50 shrink-0 shadow-sm"
                style={{ backgroundColor: getUserColor(email), zIndex: 10 - i }}
                title={email}
              >
                {getUserInitial(email)}
              </span>
            ))}
            {emails.length > 3 && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-white/30 text-white ring-1 ring-white/50 shrink-0 backdrop-blur-sm" style={{ zIndex: 0 }}>
                +{emails.length - 3}
              </span>
            )}
          </div>
          <button className="w-5 h-5 ml-1 rounded-full border border-white/40 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Right handle */}
      <div className="w-4 h-full flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-0.5 h-3 bg-white/50 rounded-full mb-0.5" />
        <div className="w-0.5 h-3 bg-white/50 rounded-full" />
      </div>
    </div>
  );
};

/* ── Milestone (single date) ── */
const GanttMilestone = ({ item, board, date, timelineStart, dayW, onClick }) => {
  const offDays = Math.max(0, differenceInDays(date, timelineStart));
  const left = offDays * dayW;
  const emails = getAssignedEmails(item, board);
  const color = getStatusColor(item, board);

  return (
    <div
      onClick={onClick}
      className="absolute top-[8px] h-[40px] bg-white dark:bg-slate-800 rounded-r-xl rounded-l-sm flex items-center pr-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none dark:border dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow whitespace-nowrap"
      style={{ left: `${left + dayW/2}px`, borderLeft: `4px solid ${color}` }}
      title={`${item.title}\n${format(date, "MMM d, yyyy")}`}
    >
      <div className="pl-3 pr-2 flex items-center gap-1.5 h-full">
        <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
          {item.title}
        </span>
      </div>

      {emails.length > 0 && (
        <div className="flex items-center -space-x-1.5 ml-2 border-l border-slate-100 dark:border-slate-700 pl-2">
          {emails.slice(0, 3).map((email, i) => (
            <span
              key={i}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-white dark:border-slate-800 shrink-0"
              style={{ backgroundColor: getUserColor(email), zIndex: 10 - i }}
              title={email}
            >
              {getUserInitial(email)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main ── */
export default function TimelineView({ board, items, onSelectTask }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoom, setZoom] = useState("week");
  const [dateColId, setDateColId] = useState(null);
  const [endColId, setEndColId] = useState(null);
  const [showDone, setShowDone] = useState(false);

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
      e = addDays(s, 13); // 2 weeks
    } else if (zoom === "week") {
      s = subWeeks(startOfWeek(currentDate, { weekStartsOn: 1 }), 1);
      e = addWeeks(s, 4); // 4 weeks total
    } else {
      s = startOfMonth(currentDate);
      e = endOfMonth(addMonths(currentDate, 2)); // 3 months
    }
    return { start: s, end: e, days: eachDayOfInterval({ start: s, end: e }) };
  }, [currentDate, zoom]);

  const nav = (dir) => {
    if (zoom === "month") setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (zoom === "week") setCurrentDate(dir > 0 ? addWeeks(currentDate, 2) : subWeeks(currentDate, 2));
    else setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
  };

  const navLabel = () => {
    if (isSameDay(tStart, tEnd)) return format(tStart, "d MMM yyyy");
    if (getYear(tStart) === getYear(tEnd) && getMonth(tStart) === getMonth(tEnd)) {
      return `${format(tStart, "d")} - ${format(tEnd, "d MMM yyyy")}`;
    }
    if (getYear(tStart) === getYear(tEnd)) {
      return `${format(tStart, "d MMM")} - ${format(tEnd, "d MMM yyyy")}`;
    }
    return `${format(tStart, "d MMM yyyy")} - ${format(tEnd, "d MMM yyyy")}`;
  };

  // Group days by month for headers
  const monthsData = useMemo(() => {
    const res = [];
    if (days.length === 0) return res;
    let currentM = getMonth(days[0]);
    let currentY = getYear(days[0]);
    let count = 0;
    
    days.forEach(d => {
      const m = getMonth(d);
      const y = getYear(d);
      if (m === currentM && y === currentY) {
        count++;
      } else {
        res.push({ month: currentM, year: currentY, count, label: format(new Date(currentY, currentM), "MMMM yyyy") });
        currentM = m;
        currentY = y;
        count = 1;
      }
    });
    res.push({ month: currentM, year: currentY, count, label: format(new Date(currentY, currentM), "MMMM yyyy") });
    return res;
  }, [days]);

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

        const hasTwoCols = !!endColId && !!sStr && !!item.data?.[ec];
        const isTrueRange = hasTwoCols && !isSameDay(s, ve);

        return { item, dStart: ds, dEnd: de, isRange: isTrueRange, isSingleDate: !isTrueRange };
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
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#E1E5F3] dark:border-slate-800 overflow-hidden flex flex-col h-full">
      {/* ── Top Header ── */}
      <div className="p-5 sm:p-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">Timeline</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Detailed, visual representation of a project's journey, highlighting key milestones, progress updates, and upcoming tasks.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MemberAvatars members={board?.board_members} boardOwnerId={board?.user_id} />
            <Button variant="outline" size="sm" className="w-8 h-8 rounded-full p-0 flex items-center justify-center border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 gap-4">
          <div className="flex items-center gap-4">
            {/* View Toggles */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              {Object.entries(ZOOMS).map(([k, z]) => (
                <button
                  key={k}
                  onClick={() => setZoom(k)}
                  className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                    zoom === k
                      ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm shadow-sm font-medium text-slate-700 dark:text-slate-200">
              <button onClick={() => nav(-1)} className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="min-w-[110px] text-center text-xs">{navLabel()}</span>
              <button onClick={() => nav(1)} className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Show done</span>
              <Switch checked={showDone} onCheckedChange={setShowDone} className="scale-90" />
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </div>
      </div>

      {/* ── Timeline Grid ── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#FAFBFC] dark:bg-slate-900/50">
        <div style={{ minWidth: `${LEFT_W + totalW}px` }} className="pb-12">
          {/* Timeline Headers */}
          <div className="sticky top-0 z-[5] bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 pt-2 shadow-sm">
            {/* Month/Year Row */}
            <div className="flex pl-[260px]">
              {monthsData.map((m, i) => (
                <div key={i} className="text-xs font-semibold text-slate-800 dark:text-slate-200 pb-2 pl-4" style={{ width: `${m.count * dayW}px` }}>
                  {m.label}
                </div>
              ))}
            </div>
            
            {/* Days Row */}
            <div className="flex">
              <div
                className="flex-shrink-0 flex items-end pb-3 px-4 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                style={{ width: `${LEFT_W}px` }}
              >
                Task
              </div>
              {days.map((day) => {
                const isTodayDate = isSameDay(day, today);
                const weekend = isWeekend(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`flex-shrink-0 flex items-center justify-center border-l border-slate-100/60 dark:border-slate-800/60 pt-1 pb-3 relative ${
                      weekend ? "bg-slate-50/50 dark:bg-slate-800/20" : ""
                    }`}
                    style={{ width: `${dayW}px` }}
                  >
                    <span className={`text-[10px] font-semibold flex items-center gap-1 ${isTodayDate ? "text-[#7F63FF]" : weekend ? "text-slate-400" : "text-slate-600 dark:text-slate-300"}`}>
                      {zoom !== "month" && <span className="uppercase opacity-60 tracking-tighter">{format(day, "EEE").charAt(0)}</span>}
                      <span>{format(day, "d")}</span>
                    </span>
                    {isTodayDate && (
                      <div className="absolute bottom-0 w-8 h-0.5 bg-[#7F63FF] rounded-t-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid Background & Rows */}
          <div className="relative">
            {/* Background Grid Lines (Absolute behind everything) */}
            <div className="absolute inset-0 flex pl-[260px] pointer-events-none">
              {days.map((day, i) => {
                const weekend = isWeekend(day);
                return (
                  <div
                    key={i}
                    className={`border-l border-slate-200/50 dark:border-slate-800/50 h-full ${
                      weekend ? "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.02)_6px,rgba(0,0,0,0.02)_12px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.02)_6px,rgba(255,255,255,0.02)_12px)]" : ""
                    }`}
                    style={{ width: `${dayW}px` }}
                  />
                );
              })}
            </div>

            {/* Today Line */}
            {showToday && (
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-[#7F63FF] z-10 pointer-events-none shadow-[0_0_8px_rgba(127,99,255,0.4)]"
                style={{ left: `${LEFT_W + todayOff * dayW + dayW / 2}px` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#7F63FF] ring-4 ring-white dark:ring-slate-900" />
              </div>
            )}

            {/* Rows */}
            <div className="relative z-[2]">
              {displayItems.map(({ item, dStart, dEnd, isRange, isSingleDate }) => {
                return (
                  <div
                    key={item.id}
                    className="flex border-b border-slate-200/30 dark:border-slate-800/30 hover:bg-slate-100/40 dark:hover:bg-slate-800/20 transition-colors"
                    style={{ height: `${ROW_H}px` }}
                  >
                    {/* Task Title Cell */}
                    <div
                      className="flex-shrink-0 flex flex-col justify-center px-4 border-r border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm relative z-10 cursor-pointer"
                      style={{ width: `${LEFT_W}px` }}
                      onClick={() => onSelectTask?.(item)}
                    >
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate mt-0.5 opacity-80 hover:opacity-100">
                        View details
                      </span>
                    </div>

                    {/* Timeline area */}
                    <div className="flex-grow relative h-full">
                      {isRange ? (
                        <GanttBar
                          item={item} board={board}
                          dStart={dStart} dEnd={dEnd}
                          timelineStart={tStart} dayW={dayW}
                          onClick={() => onSelectTask?.(item)}
                        />
                      ) : (
                        <GanttMilestone
                          item={item} board={board}
                          date={dStart} timelineStart={tStart} dayW={dayW}
                          onClick={() => onSelectTask?.(item)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {displayItems.length === 0 && (
                <div className="p-16 text-center text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No tasks with dates in this range.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
