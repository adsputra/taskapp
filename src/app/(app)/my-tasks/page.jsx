"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import { userApi } from "@/lib/api/user";
import Link from "next/link";
import { CheckSquare, Clock, Calendar, ArrowRight, Folder } from "lucide-react";
import { motion } from "framer-motion";

export default function MyTasksPage() {
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 1000,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["my-tasks", user?.email],
    queryFn: () => itemsApi.listMyTasks(user?.email),
    enabled: !!user?.email,
  });

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "completed") return task.data?.status === "Done";
    if (filterStatus === "pending") return task.data?.status !== "Done";
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <CheckSquare className="w-8 h-8 text-blue-600" /> My Tasks
            </h1>
            <p className="text-slate-500 mt-2">View and manage all tasks assigned to you across different boards.</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {["all", "pending", "completed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${
                  filterStatus === f
                    ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">No tasks found</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                You don't have any tasks assigned to you right now. Take a break!
              </p>
            </div>
          ) : (
            filteredTasks.map((task, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={task.id} 
                className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow group flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${task.data?.status === "Done" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : task.data?.status === "Working on it" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                      {task.data?.status || "No Status"}
                    </span>
                    {task.data?.priority && (
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                        Priority: {task.data.priority}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{task.title}</h3>
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                    {task.board && (
                      <div className="flex items-center gap-1.5">
                        <Folder className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{task.board.title}</span>
                      </div>
                    )}
                    {task.data?.date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{task.data.date.split("T")[0]}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 mt-4 md:mt-0">
                  <Link href={`/board/${task.board_id}`}>
                    <button className="w-full md:w-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                      Go to Board <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </motion.div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
