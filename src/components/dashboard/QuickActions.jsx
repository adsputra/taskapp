import React, { useState } from "react";
import { Plus, Users, Calendar, BarChart3, Zap, ArrowRight } from "lucide-react";
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
    shadowColor: "shadow-blue-200/50",
  },
  {
    title: "Invite Team",
    desc: "Add collaborators",
    icon: Users,
    gradient: "from-emerald-500 to-teal-600",
    shadowColor: "shadow-emerald-200/50",
  },
  {
    title: "Calendar",
    desc: "View deadlines",
    icon: Calendar,
    gradient: "from-amber-500 to-orange-600",
    shadowColor: "shadow-amber-200/50",
  },
  {
    title: "Analytics",
    desc: "View insights",
    icon: BarChart3,
    gradient: "from-violet-500 to-purple-600",
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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm shadow-rose-200/50">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Quick Actions
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Get things done</p>
            </div>
          </div>
        </div>

        {/* Action list */}
        <div className="p-2 space-y-1">
          {actions.map((a) => (
            <div
              key={a.title}
              onClick={() => handleClick(a)}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {a.link ? (
                <Link href={a.link} className="contents">
                  <ActionItemContent a={a} />
                </Link>
              ) : (
                <ActionItemContent a={a} />
              )}
            </div>
          ))}
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

function ActionItemContent({ a }) {
  return (
    <>
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-sm ${a.shadowColor} shrink-0`}>
        <a.icon className="w-4 h-4 text-white" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          {a.title}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
          {a.desc}
        </p>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 shrink-0" />
    </>
  );
}
