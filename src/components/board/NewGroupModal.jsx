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

const GROUP_COLORS = [
  "#0073EA",
  "#00C875",
  "#E2445C",
  "#9B59B6",
  "#FDAB3D",
  "#579BFC",
  "#FF7575",
  "#7B61FF",
];

export default function NewGroupModal({ isOpen, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), color });
    setTitle("");
    setColor(GROUP_COLORS[0]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#323338]">Add New Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-[#323338] mb-1.5 block">
              Group Name
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter group name..."
              className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#323338] mb-1.5 block">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-[#0073EA] scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
              disabled={!title.trim()}
              className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
            >
              Add Group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
