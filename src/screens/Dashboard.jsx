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
    queryFn: () => boardsApi.listMyBoards({ limit: 10 }),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "recent"],
    queryFn: () => itemsApi.list({ limit: 20 }),
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 60 * 1000,
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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 p-6 sm:p-8">
            {/* decorative blobs */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-xl" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-xl" />
            <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-sky-300/10 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-sm">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {getGreeting()},{" "}
                      <span className="text-sky-200">
                        {user?.full_name?.split(" ")[0] || "there"}
                      </span>
                      !
                    </h1>
                    <p className="text-sm text-sky-200/90 mt-0.5">
                      {today} &middot;{" "}
                      {pendingTasks > 0
                        ? `${pendingTasks} task${pendingTasks > 1 ? "s" : ""} waiting`
                        : "All caught up!"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link href="/boards">
                  <Button className="h-10 px-5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 text-white hover:bg-white/30 hover:text-white shadow-sm transition-all font-medium text-sm gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Boards
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button className="h-10 px-5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition-all font-medium text-sm gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Analytics
                  </Button>
                </Link>
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
