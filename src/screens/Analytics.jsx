"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { itemsApi } from "@/lib/api/items";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  Folder,
  Activity,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { subDays, isAfter, isBefore } from "date-fns";
import { motion } from "framer-motion";
import Link from "next/link";

export default function AnalyticsPage() {
  const [selectedBoard, setSelectedBoard] = useState("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState("30");

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: () => boardsApi.list(),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "all"],
    queryFn: () => itemsApi.list(),
  });

  const isLoading = boardsLoading || itemsLoading;

  const filteredItems = items.filter((item) => {
    if (selectedBoard !== "all" && item.board_id !== selectedBoard) return false;
    const cutoffDate = subDays(new Date(), parseInt(selectedTimeRange));
    return isAfter(new Date(item.updated_at), cutoffDate);
  });

  const filteredBoards =
    selectedBoard === "all" ? boards : boards.filter((b) => b.id === selectedBoard);

  const totalTasks = filteredItems.length;
  const completedTasks = filteredItems.filter((item) => {
    const board = boards.find((b) => b.id === item.board_id);
    const statusCol = board?.columns?.find((c) => c.type === "status");
    return item.data?.[statusCol?.id] === "Done";
  }).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const overdueTasks = filteredItems.filter((item) => {
    const board = boards.find((b) => b.id === item.board_id);
    const dateCol = board?.columns?.find((c) => c.type === "date");
    const statusCol = board?.columns?.find((c) => c.type === "status");
    const dueDate = item.data?.[dateCol?.id];
    if (!dueDate || item.data?.[statusCol?.id] === "Done") return false;
    return isBefore(new Date(dueDate), new Date());
  }).length;

  const boardStats = filteredBoards.map((board) => {
    const boardItems = filteredItems.filter((i) => i.board_id === board.id);
    const statusCol = board.columns?.find((c) => c.type === "status");
    const done = boardItems.filter((i) => i.data?.[statusCol?.id] === "Done").length;
    return {
      ...board,
      totalTasks: boardItems.length,
      completedTasks: done,
      completionRate: boardItems.length > 0 ? Math.round((done / boardItems.length) * 100) : 0,
    };
  });

  const statusDistribution = {};
  filteredItems.forEach((item) => {
    const board = boards.find((b) => b.id === item.board_id);
    const col = board?.columns?.find((c) => c.type === "status");
    const status = item.data?.[col?.id] || "Not Started";
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  });

  const statusColors = {
    Done: "#00C875",
    "In Progress": "#0073EA",
    "Stuck": "#E2445C",
    "Working on it": "#FFCB00",
  };

  const statCards = [
    {
      label: "Total Tasks",
      value: totalTasks,
      icon: Target,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      ring: "ring-indigo-600/10",
    },
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      ring: "ring-emerald-600/10",
    },
    {
      label: "Overdue",
      value: overdueTasks,
      icon: Clock,
      color: "text-rose-600",
      bg: "bg-rose-50",
      ring: "ring-rose-600/10",
    },
    {
      label: "Active Boards",
      value: filteredBoards.length,
      icon: Folder,
      color: "text-violet-600",
      bg: "bg-violet-50",
      ring: "ring-violet-600/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* ── Hero Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 rounded-full bg-indigo-500" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                  Analytics
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Insights across your boards and tasks
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedBoard} onValueChange={setSelectedBoard}>
              <SelectTrigger className="w-44 h-10 rounded-xl border-slate-200 bg-white text-sm">
                <SelectValue placeholder="Select board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Boards</SelectItem>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-40 h-10 rounded-xl border-slate-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 * i }}
            >
              <div className="relative group bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg} ${s.color} ring-1 ${s.ring}`}
                  >
                    <s.icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-800 tabular-nums">
                    {s.value}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Charts Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Status Distribution</h3>
              </div>

              {Object.keys(statusDistribution).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No data yet for the selected period
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(statusDistribution).map(([status, count]) => {
                    const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                    const barColor = statusColors[status] || "#A0A0A0";
                    return (
                      <div key={status} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-slate-700">{status}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 tabular-nums">
                              {count}
                            </span>
                            <span className="text-xs text-slate-400 w-9 text-right tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: barColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Board Performance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Board Performance</h3>
              </div>

              {boardStats.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No boards found
                </p>
              ) : (
                <div className="space-y-3">
                  {boardStats.map((board) => (
                    <div
                      key={board.id}
                      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-md flex-shrink-0"
                        style={{ backgroundColor: board.color || "#0073EA" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold text-slate-800 truncate">
                            {board.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className="text-xs font-medium border-slate-200 text-slate-600"
                          >
                            {board.completionRate}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${board.completionRate}%` }}
                              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {board.completedTasks}/{board.totalTasks}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
