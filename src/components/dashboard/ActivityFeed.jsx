import React from "react";
import { Clock, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const statusConfig = {
  done: { icon: CheckCircle2, bg: "bg-emerald-100", color: "text-emerald-600" },
  working: { icon: Clock, bg: "bg-amber-100", color: "text-amber-600" },
  stuck: { icon: AlertCircle, bg: "bg-red-100", color: "text-red-600" },
};

export default function ActivityFeed({ items, isLoading }) {
  const getConfig = (status) =>
    statusConfig[status?.toLowerCase()] || {
      icon: Clock,
      bg: "bg-slate-100",
      color: "text-slate-500",
    };

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Recent Activity
            </h3>
            <p className="text-xs text-slate-400">Latest updates</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="space-y-3 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-2 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Activity className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-xs text-slate-400">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item, index) => {
              const cfg = getConfig(item.data?.status);
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {format(
                        new Date(item.updated_at),
                        "MMM d, h:mm a"
                      )}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
