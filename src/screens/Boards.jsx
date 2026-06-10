"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Plus, Search, Filter, Grid3X3, LayoutList, Folder, BarChart } from "lucide-react";
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
    <div className="p-4 md:p-6 bg-[#F5F6F8] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#323338]">My Boards</h1>
            <p className="text-[#676879] text-sm mt-1">Manage your projects and workflows</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-[#0073EA] to-[#0056B3] hover:from-[#0056B3] hover:to-[#0073EA] text-white rounded-lg h-10 px-5 font-medium text-sm shadow-md">
            <Plus className="w-4 h-4 mr-2" /> Create Board
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#676879]" />
            <Input placeholder="Search boards..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-[#E1E5F3] rounded-lg h-10" />
          </div>
          <div className="flex gap-2">
            <Button variant={viewMode === "grid" ? "default" : "outline"} onClick={() => setViewMode("grid")}
              className={`rounded-lg h-10 px-3 ${viewMode === "grid" ? "bg-[#0073EA] text-white" : "border-[#E1E5F3]"}`}>
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")}
              className={`rounded-lg h-10 px-3 ${viewMode === "list" ? "bg-[#0073EA] text-white" : "border-[#E1E5F3]"}`}>
              <LayoutList className="w-4 h-4" />
            </Button>
            <Link href="/analytics">
              <Button variant="outline" className="rounded-lg h-10 px-3 border-[#E1E5F3] text-[#323338] text-sm">
                <BarChart className="w-4 h-4 mr-1.5" /> Analytics
              </Button>
            </Link>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {filteredBoards.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Folder className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-[#323338] mb-2">
                {searchQuery ? "No boards found" : "No boards yet"}
              </h3>
              <p className="text-[#676879] mb-6">
                {searchQuery ? "Try adjusting your search." : "Create your first board!"}
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
