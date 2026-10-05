"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  LayoutGrid,
  Calendar,
  BarChart3,
  Activity,
  Zap,
  Columns,
  Table,
  Share2,
  Target,
} from "lucide-react";

const viewOptions = [
  { id: "table", label: "Table", icon: Table },
  { id: "kanban", label: "Kanban", icon: Columns },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "timeline", label: "Timeline", icon: Activity },
  { id: "sprint", label: "Sprint", icon: Target },
];

export default function BoardHeader({
  board,
  itemsCount,
  selectedCount,
  currentView,
  onViewChange,
  onShowAnalytics,
  onShowAutomations,
  onShowShare,
}) {
  if (!board) return null;

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6">
      {/* Top Row: Back + Title */}
      <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground"
        >
          <Link href="/boards" aria-label="Back to boards">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: board.color || "#2563EB" }}
          >
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{board.title}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {itemsCount} items
              {selectedCount > 0 && ` · ${selectedCount} selected`}
            </p>
          </div>
        </div>
        {/* Action Buttons — icon-only on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden h-9 w-9 rounded-lg border-border text-foreground hover:bg-muted"
            onClick={onShowShare}
            title="Share board"
            aria-label="Share board"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden sm:inline-flex rounded-lg h-9 px-3 border-border text-sm text-foreground hover:bg-muted"
            onClick={onShowShare}
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            Share
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden h-9 w-9 rounded-lg border-border text-foreground hover:bg-muted"
            onClick={onShowAutomations}
            title="Automations"
            aria-label="Automations"
          >
            <Zap className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden sm:inline-flex rounded-lg h-9 px-3 border-border text-sm text-foreground hover:bg-muted"
            onClick={onShowAutomations}
          >
            <Zap className="w-4 h-4 mr-1.5" />
            Automations
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden h-9 w-9 rounded-lg border-border text-foreground hover:bg-muted"
            onClick={onShowAnalytics}
            title="Analytics"
            aria-label="Analytics"
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden sm:inline-flex rounded-lg h-9 px-3 border-border text-sm text-foreground hover:bg-muted"
            onClick={onShowAnalytics}
          >
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Analytics
          </Button>
        </div>
      </div>

      {/* View Switcher — scrollable on mobile */}
      <div
        role="tablist"
        aria-label="Board views"
        className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit max-w-full overflow-x-auto scrollbar-hide"
      >
        {viewOptions.map((view) => {
          const Icon = view.icon;
          const isActive = currentView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={view.label}
              onClick={() => onViewChange(view.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{view.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
