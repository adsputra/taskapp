"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { timeApi } from "@/lib/api/time";
import { toast } from "sonner";
import { Play, Square, Plus, Trash2, Clock, Timer } from "lucide-react";

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatTimer = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function TimeTab({ task, userRole }) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [showManual, setShowManual] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const queryClient = useQueryClient();
  const isViewer = userRole === "viewer";

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["timeEntries", task?.id],
    queryFn: () => timeApi.listByItem(task.id),
    enabled: !!task?.id,
  });

  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

  const createEntry = useMutation({
    mutationFn: ({ duration_minutes, description }) =>
      timeApi.create({ item_id: task.id, duration_minutes, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeEntries", task.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteEntry = useMutation({
    mutationFn: (id) => timeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeEntries", task.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    setIsTimerRunning(true);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    createEntry.mutate({ duration_minutes: minutes, description: "Timer session" });
    setElapsed(0);
    toast.success(`Logged ${formatDuration(minutes)}`);
  };

  const handleManualAdd = () => {
    const mins = parseInt(manualMinutes);
    if (!mins || mins <= 0) return;
    createEntry.mutate({
      duration_minutes: mins,
      description: manualDesc || "Manual entry",
    });
    setManualMinutes("");
    setManualDesc("");
    setShowManual(false);
    toast.success(`Logged ${formatDuration(mins)}`);
  };

  return (
    <div className="p-6">
      {/* Total + Timer */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-[#676879] dark:text-slate-500 font-medium">Total Time</p>
          <p className="text-2xl font-bold text-[#323338] dark:text-slate-100">{formatDuration(totalMinutes)}</p>
        </div>

        {!isViewer && (
          <div className="flex items-center gap-2">
            {isTimerRunning ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-bold text-[#0073EA] tabular-nums">
                  {formatTimer(elapsed)}
                </span>
                <button
                  onClick={stopTimer}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#E2445C] text-white rounded-lg text-sm font-medium hover:bg-[#C73A4E] transition-colors"
                >
                  <Square className="w-3.5 h-3.5" fill="white" />
                  Stop
                </button>
              </div>
            ) : (
              <button
                onClick={startTimer}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#0073EA] text-white rounded-lg text-sm font-medium hover:bg-[#0056B3] transition-colors"
              >
                <Play className="w-3.5 h-3.5" fill="white" />
                Start Timer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Manual Entry */}
      {!isViewer && (
        <div className="mb-6">
          {!showManual ? (
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-2 text-sm text-[#0073EA] hover:text-[#0056B3] font-medium"
            >
              <Plus className="w-4 h-4" />
              Add manual time entry
            </button>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-[#676879] dark:text-slate-500 mb-1 block">Minutes</label>
                <input
                  type="number"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  placeholder="30"
                  min="1"
                  className="w-full rounded-lg border border-[#E1E5F3] dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#676879] dark:text-slate-500 mb-1 block">Description</label>
                <input
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                  placeholder="What did you work on?"
                  className="w-full rounded-lg border border-[#E1E5F3] dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                />
              </div>
              <button
                onClick={handleManualAdd}
                disabled={!manualMinutes || parseInt(manualMinutes) <= 0}
                className="px-3 py-2 bg-[#0073EA] text-white rounded-lg text-sm hover:bg-[#0056B3] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowManual(false); setManualMinutes(""); setManualDesc(""); }}
                className="px-3 py-2 text-[#676879] dark:text-slate-400 hover:bg-[#F5F6F8] dark:hover:bg-slate-800 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Entries List */}
      {entries.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-[#F5F6F8] dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <Timer className="w-5 h-5 text-[#A0A0A0] dark:text-slate-600" />
          </div>
          <p className="text-sm text-[#676879] dark:text-slate-400">No time entries yet</p>
          <p className="text-xs text-[#A0A0A0] dark:text-slate-600 mt-1">Start the timer or add a manual entry</p>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const userName = entry.profiles?.full_name || entry.user_id?.slice(0, 8);
          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#F5F6F8] dark:hover:bg-slate-800 group transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#0073EA]/10 dark:bg-[#0073EA]/20 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[#0073EA]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#323338] dark:text-slate-200">{entry.description || "Time entry"}</p>
                <p className="text-[10px] text-[#A0A0A0]">
                  {userName} · {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <span className="text-sm font-medium text-[#323338] dark:text-slate-200 shrink-0">
                {formatDuration(entry.duration_minutes)}
              </span>
              {!isViewer && (
                <button
                  onClick={() => {
                    if (window.confirm("Delete this time entry?")) {
                      deleteEntry.mutate(entry.id);
                    }
                  }}
                  className="p-1.5 text-[#A0A0A0] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
