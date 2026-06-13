import React from "react";
import { Folder, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

const statItems = [
  {
    key: "boards",
    label: "Boards",
    icon: Folder,
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-600/10",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-600/10",
  },
  {
    key: "pending",
    label: "Pending",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-600/10",
  },
  {
    key: "rate",
    label: "Completion",
    icon: TrendingUp,
    color: "text-violet-600",
    bg: "bg-violet-50",
    ring: "ring-violet-600/10",
  },
];

export default function StatsOverview({ boards, items, isLoading }) {
  const completed = items.filter(
    (i) => i.data?.status?.toLowerCase() === "done" || i.data?.status?.toLowerCase() === "complete"
  ).length;
  const pending = items.filter(
    (i) => !i.data?.status || (i.data?.status?.toLowerCase() !== "done" && i.data?.status?.toLowerCase() !== "complete")
  ).length;
  const rate = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  const values = {
    boards: boards.length,
    completed,
    pending,
    rate: `${rate}%`,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((s, i) => (
        <motion.div
          key={s.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 * i }}
        >
          <div className="relative group bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg} ${s.color} ring-1 ${s.ring}`}
              >
                <s.icon className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {s.label}
              </p>
              {isLoading ? (
                <Skeleton className="h-7 w-16 rounded" />
              ) : (
                <p className={`text-2xl font-bold text-slate-800 tabular-nums`}>
                  {values[s.key]}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
