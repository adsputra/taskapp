"use client";

import React, { useState, useRef } from "react";
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
import { toast } from "sonner";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import StatsOverview from "../components/dashboard/StatsOverview";
import RecentBoards from "../components/dashboard/RecentBoards";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import QuickActions from "../components/dashboard/QuickActions";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const containerRef = useRef(null);

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
    staleTime: 0,
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

  // GSAP Stagger Animation for Dashboard Cards
  useGSAP(() => {
    gsap.fromTo(".stagger-item", 
      { opacity: 0, y: 30, scale: 0.98 },
      { 
        opacity: 1, 
        y: 0, 
        scale: 1, 
        duration: 0.7, 
        stagger: 0.1, 
        ease: "power3.out",
        delay: 0.15, // slight delay so it flows after the global template transition
        clearProps: "all"
      }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50/80 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* ── Greeting ── */}
        <div className="space-y-2 stagger-item">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 rounded-full bg-blue-500" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                {getGreeting()},{" "}
                <span className="text-blue-600">
                  {user?.full_name?.split(" ")[0] || "there"}
                </span>
                !
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {today} &middot;{" "}
                {pendingTasks > 0
                  ? `${pendingTasks} task${pendingTasks > 1 ? "s" : ""} waiting`
                  : "All caught up!"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="stagger-item">
          <StatsOverview boards={boards} items={items} isLoading={isLoading} />
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            {/* Recent Boards */}
            <div className="stagger-item">
              <RecentBoards
                boards={ownedBoards}
                sharedBoards={sharedBoards}
                isLoading={isLoading}
                onCreateBoard={(data) => createBoard.mutateAsync(data)}
              />
            </div>
          </div>

          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="stagger-item">
              <QuickActions
                onCreateBoard={(data) => createBoard.mutateAsync(data)}
              />
            </div>

            {/* Activity */}
            <div className="stagger-item">
              <ActivityFeed items={items.slice(0, 5)} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
