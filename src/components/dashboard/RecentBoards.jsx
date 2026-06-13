import React, { useState } from "react";
import { Folder, Lock, Globe, Users, ArrowRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import Link from "next/link";
import CreateBoardModal from "@/components/boards/CreateBoardModal";

export default function RecentBoards({
  boards,
  sharedBoards = [],
  isLoading,
  onCreateBoard,
}) {
  const [showCreate, setShowCreate] = useState(false);

  const renderBoard = (board, index, isShared = false) => (
    <motion.div
      key={board.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Link href={`/boards/${board.id}`}>
        <div className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white/70 transition-all duration-200 cursor-pointer">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform"
            style={{ backgroundColor: board.color || "#3B82F6" }}
          >
            {isShared ? (
              <Users className="w-5 h-5" />
            ) : (
              <Folder className="w-5 h-5" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
              {board.title}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {isShared ? "Shared" : "Updated"}{" "}
              {format(new Date(board.updated_at), "MMM d, yyyy")}
            </p>
          </div>

          {/* Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                board.visibility === "private"
                  ? "bg-amber-50 text-amber-700 border-amber-200/60"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
              }`}
            >
              {board.visibility === "private" ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Globe className="w-3 h-3" />
              )}
              {board.visibility}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  );

  return (
    <>
      {/* ── My Boards ── */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                <Folder className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  My Boards
                </h3>
                <p className="text-xs text-slate-400">
                  {boards.length} board{boards.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        </div>

        <div className="px-3 py-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-44 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Folder className="w-7 h-7 text-slate-300" />
              </div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">
                No boards yet
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                Create your first board to get started
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Board
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {boards.slice(0, 6).map((b, i) => renderBoard(b, i))}
            </div>
          )}
        </div>
      </div>

      {/* ── Shared With Me ── */}
      {sharedBoards.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Shared With Me
                </h3>
                <p className="text-xs text-slate-400">
                  {sharedBoards.length} board
                  {sharedBoards.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="px-3 py-2 divide-y divide-slate-50">
            {sharedBoards.map((b, i) => renderBoard(b, i, true))}
          </div>
        </div>
      )}

      <CreateBoardModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (data) => {
          if (onCreateBoard) await onCreateBoard(data);
          setShowCreate(false);
        }}
      />
    </>
  );
}
