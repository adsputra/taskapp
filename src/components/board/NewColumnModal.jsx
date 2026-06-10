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

const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "date", label: "Date" },
  { value: "people", label: "People" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "tags", label: "Tags" },
  { value: "budget", label: "Budget" },
];

export default function NewColumnModal({ isOpen, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("text");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), type });
    setTitle("");
    setType("text");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#323338]">Add New Column</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-[#323338] mb-1.5 block">
              Column Name
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter column name..."
              className="rounded-lg border-[#E1E5F3] focus:ring-[#0073EA]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#323338] mb-1.5 block">
              Column Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-lg border-[#E1E5F3]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
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
              disabled={!title.trim()}
              className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg"
            >
              Add Column
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
