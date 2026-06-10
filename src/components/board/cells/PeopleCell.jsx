"use client";

import React, { useState, useEffect } from "react";
import { User, Check, X } from "lucide-react";
import { boardsApi } from "@/lib/api/boards";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * PeopleCell — menampilkan siapa yang di-assign ke task.
 * Menarik data user dari board_members (real users yang punya akses ke board).
 */
export default function PeopleCell({ value, onUpdate, itemId, column, boardId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Parse value — bisa string atau array
  const assignedUsers = Array.isArray(value) ? value : value ? [value] : [];

  // Load board members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["board-members", boardId],
    queryFn: () => boardsApi.listMembers(boardId),
    enabled: !!boardId,
  });

  // Filter members based on search
  const filteredMembers = members.filter(
    (m) =>
      m.status === "active" &&
      (!search ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.split("@")[0]?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleUser = (memberId, memberEmail) => {
    const newAssigned = assignedUsers.includes(memberEmail)
      ? assignedUsers.filter((u) => u !== memberEmail)
      : [...assignedUsers, memberEmail];
    onUpdate(newAssigned);
  };

  const getUserInitial = (email) => {
    return email?.charAt(0)?.toUpperCase() || "?";
  };

  const getUserColor = (email) => {
    const colors = ["#0073EA", "#00C875", "#E2445C", "#FFCB00", "#A358DF", "#579BFC"];
    let hash = 0;
    for (let i = 0; i < (email || "").length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleBlur = () => {
    // Gunakan setTimeout agar click event handler bisa berjalan dulu
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div className="relative" onBlur={handleBlur}>
      {/* Display assigned users */}
      <div
        className="cursor-pointer flex items-center gap-1 flex-wrap min-h-[28px] px-1 py-0.5 rounded hover:bg-[#E1E5F3]/50 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        {assignedUsers.length === 0 && (
          <span className="text-[#676879] text-sm flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            Assign
          </span>
        )}
        {assignedUsers.map((email, i) => (
          <div
            key={email}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white -ml-1 first:ml-0 shadow-sm"
            style={{
              backgroundColor: getUserColor(email),
              zIndex: assignedUsers.length - i,
            }}
            title={email}
          >
            {getUserInitial(email)}
          </div>
        ))}
        {assignedUsers.length > 3 && (
          <span className="text-xs text-[#676879] ml-1">
            +{assignedUsers.length - 3}
          </span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-[#E1E5F3] z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-[#E1E5F3]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full text-sm border border-[#E1E5F3] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              autoFocus
            />
          </div>

          {/* Member list */}
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-8 w-full rounded" />
                <Skeleton className="h-8 w-full rounded" />
                <Skeleton className="h-8 w-full rounded" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#A0A0A0]">
                {members.length === 0
                  ? "No team members yet. Share this board to add people."
                  : "No matching members found."}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const email = member.email || "Unknown";
                const isChecked = assignedUsers.includes(email);
                return (
                  <button
                    key={member.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F5F6F8] transition-colors text-left"
                    onClick={() => toggleUser(member.id, email)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: getUserColor(email) }}
                    >
                      {getUserInitial(email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#323338] truncate">
                        {email.split("@")[0]}
                      </p>
                      <p className="text-xs text-[#676879] truncate">
                        {email}
                      </p>
                    </div>
                    {isChecked && (
                      <Check className="w-4 h-4 text-[#0073EA] flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Close button */}
          <div className="p-2 border-t border-[#E1E5F3]">
            <button
              type="button"
              className="w-full text-xs text-[#676879] hover:text-[#323338] transition-colors py-1"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
