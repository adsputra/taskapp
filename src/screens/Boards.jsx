"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Plus,
  Search,
  Grid3X3,
  LayoutList,
  Folder,
  TrendingUp,
  Sparkles,
  ArrowRight,
  LayoutDashboard,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import CreateBoardModal from "../components/boards/CreateBoardModal";
import EditBoardModal from "../components/boards/EditBoardModal";
import BoardCard from "../components/boards/BoardCard";

export default function Boards() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: () => boardsApi.list(),
  });

  const filteredBoards = useMemo(() => {
    if (!searchQuery) return boards;
    const q = searchQuery.toLowerCase();
    return boards.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q)
    );
  }, [searchQuery, boards]);

  // Stats
  const personalBoards = boards.filter((b) => !b.shared);
  const sharedBoards = boards.filter((b) => b.shared);

  const createMutation = useMutation({
    mutationFn: (data) => boardsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setShowCreateModal(false);
      toast.success("Board berhasil dibuat!");
    },
    onError: (err) => toast.error(err.message || "Gagal membuat board."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => boardsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setShowEditModal(false);
      setEditingBoard(null);
      toast.success("Board berhasil diupdate.");
    },
    onError: (err) => toast.error(err.message || "Gagal update board."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => boardsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Board berhasil dihapus.");
    },
    onError: (err) => toast.error(err.message || "Gagal menghapus board."),
  });

  const statCards = [
    { label: "Total Boards", value: boards.length, icon: Folder, color: "text-indigo-600", bg: "bg-indigo-50", ring: "ring-indigo-600/10" },
    { label: "Personal", value: personalBoards.length, icon: Grid3X3, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-600/10" },
    { label: "Shared", value: sharedBoards.length, icon: LayoutList, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-600/10" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0073EA]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* ── Hero Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-500 to-cyan-500 p-6 sm:p-8">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-xl" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-xl" />
            <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-teal-300/10 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-sm">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      My Boards
                    </h1>
                    <p className="text-sm text-teal-100/90 mt-0.5">
                      Manage your projects and workflows
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link href="/analytics">
                  <Button className="h-10 px-5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 text-white hover:bg-white/30 hover:text-white shadow-sm transition-all font-medium text-sm gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Analytics
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
                <Link href="/">
                  <Button className="h-10 px-5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 text-white hover:bg-white/30 hover:text-white shadow-sm transition-all font-medium text-sm gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="grid grid-cols-4 gap-4">
            {statCards.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08 * i }}
              >
                <div className="relative group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg} ${s.color} ring-1 ${s.ring} mb-3`}>
                    <s.icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{s.label}</p>
                    <p className="text-xl font-bold text-slate-800 tabular-nums">{s.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Filters & Actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200 rounded-xl h-10 focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === "list"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#0073EA] to-[#0056B3] hover:from-[#0056B3] hover:to-[#0073EA] text-white shadow-sm transition-all font-medium text-sm gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Board
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Boards Grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {filteredBoards.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-16 text-center"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-slate-200/60">
                  <Folder className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  {searchQuery ? "No boards found" : "No boards yet"}
                </h3>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  {searchQuery
                    ? "Try adjusting your search query."
                    : "Create your first project board to get started with task management."}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-11 px-6 font-medium shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Board
                  </Button>
                )}
              </motion.div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                    : "space-y-3"
                }
              >
                {filteredBoards.map((board, index) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    viewMode={viewMode}
                    index={index}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onEdit={(b) => {
                      setEditingBoard(b);
                      setShowEditModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Modals ── */}
        <CreateBoardModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />

        {editingBoard && (
          <EditBoardModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingBoard(null);
            }}
            onSubmit={(id, data) => updateMutation.mutate({ id, data })}
            board={editingBoard}
          />
        )}
      </div>
    </div>
  );
}
