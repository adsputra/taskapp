"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { itemsApi } from "@/lib/api/items";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Target, Clock, Folder, Activity, CheckCircle2 } from "lucide-react";
import { subDays, isAfter, isBefore } from "date-fns";
import { motion } from "framer-motion";

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

  const filteredBoards = selectedBoard === "all"
    ? boards
    : boards.filter((b) => b.id === selectedBoard);

  const totalTasks = filteredItems.length;
  const completedTasks = filteredItems.filter((item) => {
    const board = boards.find((b) => b.id === item.board_id);
    const statusCol = board?.columns?.find((c) => c.type === "status");
    return item.data?.[statusCol?.id] === "Done";
  }).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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

  if (isLoading) {
    return (
      <div className="p-6 bg-[#F5F6F8] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0073EA]" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#F5F6F8] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#323338]">Analytics Dashboard</h1>
            <p className="text-[#676879] mt-2">Insights across your boards and tasks</p>
          </div>
          <div className="flex gap-3">
            <Select value={selectedBoard} onValueChange={setSelectedBoard}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Boards</SelectItem>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-40">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Tasks", value: totalTasks, icon: Target, color: "from-blue-500 to-blue-600", sub: "Active tasks" },
            { label: "Completion Rate", value: `${completionRate}%`, icon: CheckCircle2, color: "from-green-500 to-green-600", sub: null, progress: completionRate },
            { label: "Overdue Tasks", value: overdueTasks, icon: Clock, color: "from-red-500 to-red-600", sub: "Need attention" },
            { label: "Active Boards", value: filteredBoards.length, icon: Folder, color: "from-purple-500 to-purple-600", sub: "Boards in use" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={`bg-gradient-to-r ${stat.color} text-white`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <stat.icon className="w-5 h-5" /> {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  {stat.progress !== undefined && <Progress value={stat.progress} className="mt-2 bg-white/30" />}
                  {stat.sub && <p className="text-white/70 text-sm">{stat.sub}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader><CardTitle><Activity className="w-5 h-5 inline mr-2" />Status Distribution</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(statusDistribution).map(([status, count]) => {
                const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{status}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm text-gray-600 w-12">{count}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle><TrendingUp className="w-5 h-5 inline mr-2" />Board Performance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {boardStats.map((board) => (
                <div key={board.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-lg" style={{ backgroundColor: board.color }} />
                    <div>
                      <h4 className="font-medium">{board.title}</h4>
                      <p className="text-sm text-gray-500">{board.completedTasks} of {board.totalTasks} done</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${board.completionRate}%` }} />
                    </div>
                    <Badge variant="outline">{board.completionRate}%</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
