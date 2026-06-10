"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewTaskModal({ isOpen, onClose, board, onSubmit }) {
  const [title, setTitle] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(
    board?.groups?.[0]?.id || ""
  );

  const handleSubmit = () => {
    if (!title.trim() || !selectedGroup) return;
    onSubmit(selectedGroup, title.trim());
    setTitle("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#323338]">New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-[#323338] mb-1.5 block">
              Task Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#323338] mb-1.5 block">
              Group
            </label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="rounded-lg border-[#E1E5F3]">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {board?.groups?.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-lg border-[#E1E5F3]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || !selectedGroup}
              className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
            >
              Create Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
