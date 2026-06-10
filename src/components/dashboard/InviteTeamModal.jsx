import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Mail, X, Users } from "lucide-react";
import { motion } from "framer-motion";

export default function InviteTeamModal({ isOpen, onClose }) {
  const [emails, setEmails] = useState([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addEmail = () => {
    if (currentEmail && currentEmail.includes('@') && !emails.includes(currentEmail)) {
      setEmails([...emails, currentEmail]);
      setCurrentEmail('');
    }
  };

  const removeEmail = (emailToRemove) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  const handleSendInvites = async () => {
    if (emails.length === 0) return;
    
    setIsLoading(true);
    try {
      // Here you would integrate with your actual invitation system
      console.log('Sending invites to:', emails, 'with role:', role, 'message:', message);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset form
      setEmails([]);
      setCurrentEmail('');
      setRole('editor');
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending invites:', error);
    }
    setIsLoading(false);
  };

  const roleOptions = [
    { value: 'admin', label: 'Admin', description: 'Full access to everything' },
    { value: 'editor', label: 'Editor', description: 'Can edit and create content' },
    { value: 'viewer', label: 'Viewer', description: 'Can view and comment only' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#323338] flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-[#0073EA]" />
            Invite Team Members
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#323338] font-medium">
              Email Addresses
            </Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter email address..."
                className="flex-1 rounded-xl border-[#E1E5F3] h-12 focus:ring-2 focus:ring-[#0073EA]/20"
              />
              <Button
                onClick={addEmail}
                disabled={!currentEmail || !currentEmail.includes('@')}
                className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-4"
              >
                Add
              </Button>
            </div>
            
            {/* Email Tags */}
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {emails.map((email, index) => (
                  <motion.div
                    key={email}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Badge className="bg-[#E1E5F3] text-[#323338] hover:bg-[#D1D5DB] flex items-center gap-1 px-3 py-1">
                      <Mail className="w-3 h-3" />
                      {email}
                      <button
                        onClick={() => removeEmail(email)}
                        className="ml-1 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label className="text-[#323338] font-medium">Role & Permissions</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="rounded-xl border-[#E1E5F3] h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Personal Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-[#323338] font-medium">
              Personal Message (Optional)
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to your invitation..."
              className="rounded-xl border-[#E1E5F3] min-h-20 focus:ring-2 focus:ring-[#0073EA]/20"
            />
          </div>

          {/* Preview */}
          {emails.length > 0 && (
            <div className="p-4 bg-[#F5F6F8] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-[#676879]" />
                <span className="text-sm font-medium text-[#323338]">
                  Inviting {emails.length} member{emails.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-xs text-[#676879]">
                They will be added as <strong>{roleOptions.find(r => r.value === role)?.label}</strong> 
                {' '}and can start collaborating immediately.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl h-12 px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendInvites}
            disabled={emails.length === 0 || isLoading}
            className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-6 font-medium"
          >
            {isLoading ? 'Sending...' : `Send ${emails.length} Invite${emails.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}