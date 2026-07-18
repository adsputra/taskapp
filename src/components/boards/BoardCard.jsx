import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Folder, Lock, Globe, MoreHorizontal, Calendar, Trash2, Edit3 } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function BoardCard({ board, viewMode, index, onDelete, onEdit, isShared }) {
  const handleDelete = (e) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    if (window.confirm(`Are you sure you want to delete the board "${board.title}"? This cannot be undone.`)) {
      onDelete(board.id);
    }
  };

  const handleEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(board);
  };

  const boardColor = board.color || '#3B82F6';

  if (viewMode === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.03, layout: { type: "spring", stiffness: 300, damping: 30 } }}
      >
        <Card className="group rounded-2xl shadow-md hover:shadow-lg dark:shadow-none dark:bg-slate-900 dark:border-slate-800 transition-all duration-200 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Link href={`/boards/${board.id}${isShared ? '?filter=shared' : ''}`} className="flex items-center gap-3 flex-grow min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: boardColor }}
                />
                <div className="flex-grow min-w-0">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 transition-colors text-sm truncate">
                    {board.title}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate">
                    {board.description || 'No description'}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <Badge 
                  variant="outline" 
                  className={`border-none text-xs px-2 py-0.5 rounded-full ${
                    board.visibility === 'private' 
                      ? 'bg-rose-100 text-rose-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {board.visibility === 'private' ? (
                    <Lock className="w-2.5 h-2.5 mr-1" />
                  ) : (
                    <Globe className="w-2.5 h-2.5 mr-1" />
                  )}
                  {board.visibility}
                </Badge>
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">
                    {formatDistanceToNow(new Date(board.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" onClick={(e) => {e.preventDefault(); e.stopPropagation();}}>
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEdit}>
                      <Edit3 className="w-3.5 h-3.5 mr-2" />
                      Edit Board
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Delete Board
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Grid View
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04, layout: { type: "spring", stiffness: 300, damping: 30 } }}
      className="h-full"
    >
      <Card 
        className="group h-full flex flex-col rounded-2xl shadow-md hover:shadow-lg dark:shadow-none dark:bg-slate-900 dark:border-slate-800 transition-all duration-200 overflow-hidden"
      >
        <Link href={`/boards/${board.id}${isShared ? '?filter=shared' : ''}`} className="flex-grow block p-5">
          <div className="flex items-start justify-between mb-4">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${boardColor}15` }}
            >
              <Folder 
                className="w-5 h-5"
                style={{ color: boardColor }}
              />
            </div>
            <Badge 
              variant="outline" 
              className={`border-none text-xs px-2.5 py-1 rounded-full ${
                board.visibility === 'private' 
                  ? 'bg-rose-100 text-rose-700' 
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {board.visibility === 'private' ? (
                <Lock className="w-3 h-3 mr-1.5" />
              ) : (
                <Globe className="w-3 h-3 mr-1.5" />
              )}
              {board.visibility}
            </Badge>
          </div>
          
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg mb-2 transition-colors">
            {board.title}
          </h3>
          
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-5 line-clamp-2 flex-grow">
            {board.description || 'No description provided.'}
          </p>
          
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDistanceToNow(new Date(board.updated_at), { addSuffix: true })}</span>
            </div>
          </div>
        </Link>
        <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-center text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200">
                <MoreHorizontal className="w-4 h-4 mr-1.5" /> Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit3 className="w-3.5 h-3.5 mr-2" />
                Edit Board
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50 focus:text-red-600 focus:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete Board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}
