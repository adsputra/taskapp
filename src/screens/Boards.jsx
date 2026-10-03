"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { boardsApi } from "@/lib/api/boards";
import { userApi } from "@/lib/api/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Plus,
  Search,
  Grid3X3,
  LayoutList,
  Folder,
  BarChart,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import CreateBoardModal from "../components/boards/CreateBoardModal";
import EditBoardModal from "../components/boards/EditBoardModal";
import BoardCard from "../components/boards/BoardCard";

export default function Boards() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const isShared = filterParam === "shared";
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: () => boardsApi.list(),
    staleTime: 60 * 1000,
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
    staleTime: 5 * 1000,
  });

  const userId = user?.id;

  const filteredBoards = useMemo(() => {
    let result = boards;
    if (user) {
      if (isShared) {
        result = result.filter(b => b.user_id !== user.id);
      } else {
        result = result.filter(b => b.user_id === user.id);
      }
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [searchQuery, boards, user, isShared]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0073EA]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {isShared ? "Shared with Me" : "My Boards"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-8 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" />
              <p className="text-sm text-slate-400 dark:text-slate-500">                {filteredBoards.length} board{filteredBoards.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {!isShared && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              New Board
            </Button>
          )}
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
          {[
            { label: "All", v: boards.length, icon: Folder, c: "bg-blue-50 text-blue-600" },
            { label: "Owned", v: userId ? boards.filter(b => b.user_id === userId).length : "-", icon: Grid3X3, c: "bg-blue-50 text-blue-600" },
            { label: "Shared", v: userId ? boards.filter(b => b.user_id !== userId).length : "-", icon: LayoutList, c: "bg-emerald-50 text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-xl shadow-md hover:shadow-lg dark:shadow-none transition-all duration-200 p-3.5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.c} dark:bg-opacity-20 flex-shrink-0`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{s.label}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{s.v}</p>
              </div>
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
        >
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filter boards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl h-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1.5 rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-2.5 py-1.5 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <Link href="/analytics">
              <Button
                variant="outline"
                className="rounded-xl h-10 px-4 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <BarChart className="w-4 h-4" />
                Analytics
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          {filteredBoards.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl shadow-md dark:shadow-none"
            >
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Folder className="w-9 h-9 text-slate-400 dark:text-slate-600" />
                  </div>
                  {!isShared && (
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm">
                      <Plus className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  {searchQuery 
                    ? "No matching boards" 
                    : isShared 
                      ? "No shared boards yet" 
                      : "No boards yet"}
                </h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-8 text-center max-w-sm">
                  {searchQuery
                    ? "Try a different search term."
                    : isShared 
                      ? "Boards that others share with you will appear here." 
                      : "Create your first board to start organizing your work."}
                </p>
                {!searchQuery && !isShared && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Board
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={
                viewMode === "grid"
                  ? "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                  : "flex flex-col gap-2"
              }
            >
              <AnimatePresence mode="popLayout">
                {filteredBoards.map((board, index) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    viewMode={viewMode}
                    index={index}
                    isShared={isShared}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onEdit={(b) => {
                      setEditingBoard(b);
                      setShowEditModal(true);
                    }}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Modals ── */}
        <CreateBoardModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutateAsync(data)}
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
