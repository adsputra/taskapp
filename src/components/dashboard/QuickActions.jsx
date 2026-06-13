import React, { useState } from "react";
import { Plus, Users, Calendar, BarChart3, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

import CreateBoardModal from "../boards/CreateBoardModal";
import InviteTeamModal from "./InviteTeamModal";
import CalendarModal from "./CalendarModal";

const actions = [
  {
    title: "Create Board",
    desc: "Start a new project",
    icon: Plus,
    gradient: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    shadowColor: "shadow-blue-200/50",
  },
  {
    title: "Invite Team",
    desc: "Add collaborators",
    icon: Users,
    gradient: "from-emerald-500 to-teal-600",
    lightBg: "bg-emerald-50",
    shadowColor: "shadow-emerald-200/50",
  },
  {
    title: "Calendar",
    desc: "View deadlines",
    icon: Calendar,
    gradient: "from-amber-500 to-orange-600",
    lightBg: "bg-amber-50",
    shadowColor: "shadow-amber-200/50",
  },
  {
    title: "Analytics",
    desc: "View insights",
    icon: BarChart3,
    gradient: "from-violet-500 to-purple-600",
    lightBg: "bg-violet-50",
    shadowColor: "shadow-violet-200/50",
    link: "/analytics",
  },
];

export default function QuickActions({ onCreateBoard }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const handleClick = (a) => {
    if (a.link) return;
    if (a.title === "Create Board") setShowCreate(true);
    if (a.title === "Invite Team") setShowInvite(true);
    if (a.title === "Calendar") setShowCalendar(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm shadow-rose-200/50">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Quick Actions
              </h3>
              <p className="text-xs text-slate-400">Get things done</p>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-2.5">
          {actions.map((a, i) => {
            const content = (
              <div className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-white to-slate-50/80 border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">
                {/* Hover gradient accent */}
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-xl"
                     style={{ background: `linear-gradient(to bottom, var(--tw-gradient-stops))` }}
                />
                
                <div className="relative flex items-center gap-3.5 px-4 py-3.5">
                  {/* Icon with gradient bg */}
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-sm ${a.shadowColor} group-hover:scale-110 transition-transform duration-200`}>
                    <a.icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
                      {a.title}
                    </p>
                    <p className="text-xs text-slate-400 group-hover:text-slate-500 transition-colors truncate">
                      {a.desc}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );

            return (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i }}
              >
                {a.link ? (
                  <Link href={a.link}>{content}</Link>
                ) : (
                  <div onClick={() => handleClick(a)}>{content}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <CreateBoardModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (data) => {
          if (onCreateBoard) await onCreateBoard(data);
          setShowCreate(false);
        }}
      />
      <InviteTeamModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
      />
      <CalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
      />
    </>
  );
}
