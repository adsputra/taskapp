
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Globe } from "lucide-react";

const colorOptions = [
  { name: 'Ocean Blue', value: '#0073EA' },
  { name: 'Success Green', value: '#00C875' },
  { name: 'Warning Orange', value: '#FFCB00' },
  { name: 'Danger Red', value: '#E2445C' },
  { name: 'Purple', value: '#A25DDC' },
  { name: 'Teal', value: '#00D9FF' }
];

export default function CreateBoardModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    color: '#0073EA',
    visibility: 'private'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      const boardData = {
        ...formData,
        columns: [
          {
            id: 'task', // Always keep task column first
            title: 'Task',
            type: 'text',
            width: 250 // Increased default width for task
          },
          {
            id: 'priority', // New default column
            title: 'Priority',
            type: 'dropdown', // Assuming priority is a dropdown
            width: 120,
            options: {
              choices: [
                { value: 'low', label: 'Low', color: '#787D80' },
                { value: 'medium', label: 'Medium', color: '#FFCB00' },
                { value: 'high', label: 'High', color: '#FDAB3D' },
                { value: 'critical', label: 'Critical', color: '#E2445C' }
              ]
            }
          },
          {
            id: 'status',
            title: 'Status',
            type: 'status',
            width: 150,
            options: {
              choices: [
                { label: 'Not Started', color: '#C4C4C4' },
                { label: 'Working on it', color: '#FFCB00' },
                { label: 'Done', color: '#00C875' },
                { label: 'Stuck', color: '#E2445C' }
              ]
            }
          },
          {
            id: 'owner',
            title: 'Owner',
            type: 'people',
            width: 150
          },
          {
            id: 'due_date',
            title: 'Due Date',
            type: 'date',
            width: 150
          }
        ],
        groups: [
          {
            id: 'group1', // Keep a default group
            title: 'New Group',
            color: formData.color, // Use selected board color for the group
            collapsed: false
          }
        ]
      };

      await onSubmit(boardData);
      setFormData({ title: '', description: '', color: '#0073EA', visibility: 'private' });
    } catch (error) {
      console.error('Error creating board:', error);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#323338]">
            Create New Board
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[#323338] font-medium">
              Board Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter board title..."
              className="rounded-xl border-[#E1E5F3] h-12 focus:ring-2 focus:ring-[#0073EA]/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-[#323338] font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What's this board about?"
              className="rounded-xl border-[#E1E5F3] min-h-20 focus:ring-2 focus:ring-[#0073EA]/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#323338] font-medium">Board Color</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    formData.color === color.value 
                      ? 'border-[#323338] scale-110' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#323338] font-medium">Visibility</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value) => setFormData(prev => ({ ...prev, visibility: value }))}
            >
              <SelectTrigger className="rounded-xl border-[#E1E5F3] h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Private</span>
                  </div>
                </SelectItem>
                <SelectItem value="shared">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>Shared</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-12 px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim() || isSubmitting}
              className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-6 font-medium"
            >
              {isSubmitting ? 'Creating...' : 'Create Board'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
