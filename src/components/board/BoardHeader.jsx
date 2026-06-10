"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  LayoutGrid,
  Calendar,
  BarChart3,
  Activity,
  Zap,
  Puzzle,
  Eye,
  Columns,
  Table,
  Share2,
} from "lucide-react";

const viewOptions = [
  { id: "table", label: "Table", icon: Table },
  { id: "kanban", label: "Kanban", icon: Columns },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "timeline", label: "Timeline", icon: Activity },
];

export default function BoardHeader({
  board,
  items,
  itemsCount,
  selectedCount,
  currentView,
  onViewChange,
  onShowAnalytics,
  onShowIntegrations,
  onShowAutomations,
  onShowShare,
}) {
  if (!board) return null;

  return (
    <div className="px-6 pt-6">
      {/* Top Row: Back + Title */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/boards">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-[#E1E5F3] text-[#676879]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: board.color || "#0073EA" }}
          >
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#323338]">{board.title}</h1>
            <p className="text-sm text-[#676879]">
              {itemsCount} items
              {selectedCount > 0 && ` · ${selectedCount} selected`}
            </p>
          </div>
        </div>
        <div className="flex-1" />
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-lg h-9 px-3 border-[#E1E5F3] text-sm text-[#323338] hover:bg-[#F5F6F8]"
            onClick={onShowShare}
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            Share
          </Button>
          <Button
            variant="outline"
            className="rounded-lg h-9 px-3 border-[#E1E5F3] text-sm text-[#323338] hover:bg-[#F5F6F8]"
            onClick={onShowAutomations}
          >
            <Zap className="w-4 h-4 mr-1.5" />
            Automations
          </Button>
          <Button
            variant="outline"
            className="rounded-lg h-9 px-3 border-[#E1E5F3] text-sm text-[#323338] hover:bg-[#F5F6F8]"
            onClick={onShowIntegrations}
          >
            <Puzzle className="w-4 h-4 mr-1.5" />
            Integrations
          </Button>
          <Button
            variant="outline"
            className="rounded-lg h-9 px-3 border-[#E1E5F3] text-sm text-[#323338] hover:bg-[#F5F6F8]"
            onClick={onShowAnalytics}
          >
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Analytics
          </Button>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center gap-1 bg-[#F5F6F8] rounded-lg p-1 w-fit">
        {viewOptions.map((view) => {
          const Icon = view.icon;
          const isActive = currentView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-[#0073EA] shadow-sm"
                  : "text-[#676879] hover:text-[#323338] hover:bg-white/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {view.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
