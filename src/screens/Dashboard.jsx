"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { itemsApi } from "@/lib/api/items";
import { userApi } from "@/lib/api/user";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  LayoutDashboard,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import StatsOverview from "../components/dashboard/StatsOverview";
import RecentBoards from "../components/dashboard/RecentBoards";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import QuickActions from "../components/dashboard/QuickActions";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["boards", "my"],
    queryFn: () => boardsApi.list({ limit: 10 }),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "recent"],
    queryFn: () => itemsApi.list({ limit: 20 }),
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
    staleTime: 0, // Selalu fetch fresh — hindari stale data setelah login/signup
  });

  const isLoading = boardsLoading || itemsLoading;
  const ownedBoards = user
    ? boards.filter((b) => b.user_id === user.id)
    : boards;
  const sharedBoards = user
    ? boards.filter((b) => b.user_id !== user.id)
    : [];

  const createBoard = useMutation({
    mutationFn: (data) => boardsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Board created!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create board.");
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const pendingTasks = items.filter(
    (item) => !item.data?.status || item.data?.status !== "Done"
  ).length;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* ── Greeting ── */}
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
                  {getGreeting()},{" "}
                  <span className="text-indigo-600">
                    {user?.full_name?.split(" ")[0] || "there"}
                  </span>
                  !
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {today} &middot;{" "}
                  {pendingTasks > 0
                    ? `${pendingTasks} task${pendingTasks > 1 ? "s" : ""} waiting`
                    : "All caught up!"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <StatsOverview boards={boards} items={items} isLoading={isLoading} />
        </motion.div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            {/* Recent Boards */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <RecentBoards
                boards={ownedBoards}
                sharedBoards={sharedBoards}
                isLoading={isLoading}
                onCreateBoard={(data) => createBoard.mutate(data)}
              />
            </motion.div>
          </div>

          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <QuickActions
                onCreateBoard={(data) => createBoard.mutate(data)}
              />
            </motion.div>

            {/* Activity */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <ActivityFeed items={items.slice(0, 5)} isLoading={isLoading} />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
