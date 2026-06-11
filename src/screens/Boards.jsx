"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Plus, Search, Grid3X3, LayoutList, Folder, BarChart } from "lucide-react";
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

  const createMutation = useMutation({
    mutationFn: (data) => boardsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setShowCreateModal(false);
      toast.success("Board berhasil dibuat!");
    },
    onError: (err) => {
      toast.error(err.message || "Gagal membuat board.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => boardsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setShowEditModal(false);
      setEditingBoard(null);
      toast.success("Board berhasil diupdate.");
    },
    onError: (err) => {
      toast.error(err.message || "Gagal update board.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => boardsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Board berhasil dihapus.");
    },
    onError: (err) => {
      toast.error(err.message || "Gagal menghapus board.");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 bg-[#F5F6F8] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0073EA]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Folder className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">My Boards</h1>
              <p className="text-slate-400 text-sm mt-0.5">Manage your projects and workflows</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-[#0073EA] to-[#0056B3] hover:from-[#0056B3] hover:to-[#0073EA] text-white rounded-xl h-10 px-5 font-medium text-sm shadow-sm gap-2">
            <Plus className="w-4 h-4" /> Create Board
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search boards..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-slate-200 rounded-xl h-10 focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] text-sm" />
          </div>
          <div className="flex gap-2">
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "grid" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <Link href="/analytics">
              <Button variant="outline" className="rounded-xl h-10 px-4 border-slate-200 text-slate-600 text-sm gap-1.5 hover:bg-slate-50">
                <BarChart className="w-4 h-4" /> Analytics
              </Button>
            </Link>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {filteredBoards.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-16 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-slate-200/60">
                <Folder className="w-10 h-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                {searchQuery ? "No boards found" : "No boards yet"}
              </h3>
              <p className="text-slate-400 mb-6 max-w-sm mx-auto">
                {searchQuery ? "Try adjusting your search query." : "Create your first project board to get started."}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateModal(true)}
                  className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-6 font-medium">
                  <Plus className="w-5 h-5 mr-2" /> Create Your First Board
                </Button>
              )}
            </motion.div>
          ) : (
            <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
              {filteredBoards.map((board, index) => (
                <BoardCard key={board.id} board={board} viewMode={viewMode} index={index}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onEdit={(b) => { setEditingBoard(b); setShowEditModal(true); }} />
              ))}
            </div>
          )}
        </AnimatePresence>

        <CreateBoardModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)} />

        {editingBoard && (
          <EditBoardModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingBoard(null); }}
            onSubmit={(id, data) => updateMutation.mutate({ id, data })} board={editingBoard} />
        )}
      </div>
    </div>
  );
}
