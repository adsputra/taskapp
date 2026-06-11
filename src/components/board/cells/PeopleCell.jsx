"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { User, Check } from "lucide-react";
import { boardsApi } from "@/lib/api/boards";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * PeopleCell — dropdown assign menggunakan fixed position agar tidak terpotong overflow parent.
 */
export default function PeopleCell({ value, onUpdate, itemId, column, boardId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Parse value
  const assignedUsers = Array.isArray(value) ? value : value ? [value] : [];

  // Load board members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["board-members", boardId],
    queryFn: () => boardsApi.listMembers(boardId),
    enabled: !!boardId,
  });

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

  const getUserInitial = (email) => email?.charAt(0)?.toUpperCase() || "?";

  const getUserColor = (email) => {
    const colors = ["#0073EA", "#00C875", "#E2445C", "#FFCB00", "#A358DF", "#579BFC"];
    let hash = 0;
    for (let i = 0; i < (email || "").length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = rect.left + rect.width > window.innerWidth - 270
        ? window.innerWidth - 270
        : rect.left;
      setDropdownStyle({ top: rect.bottom + 4, left });
    }
  }, []);

  const openDropdown = useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        closeDropdown();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isOpen, closeDropdown]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className="relative">
      {/* Trigger */}
      <div
        ref={triggerRef}
        className="cursor-pointer flex items-center gap-1 flex-wrap min-h-[28px] px-1 py-0.5 rounded hover:bg-[#E1E5F3]/50 transition-colors"
        onClick={openDropdown}
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
            style={{ backgroundColor: getUserColor(email), zIndex: assignedUsers.length - i }}
            title={email}
          >
            {getUserInitial(email)}
          </div>
        ))}
        {assignedUsers.length > 3 && (
          <span className="text-xs text-[#676879] ml-1">+{assignedUsers.length - 3}</span>
        )}
      </div>

      {/* Dropdown — fixed position agar tidak terhalang overflow parent */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: dropdownStyle.top, left: dropdownStyle.left, zIndex: 100 }}
          className="w-64 bg-white rounded-xl shadow-lg border border-[#E1E5F3] overflow-hidden"
        >
          {/* Search */}
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
                      <p className="text-xs text-[#676879] truncate">{email}</p>
                    </div>
                    {isChecked && <Check className="w-4 h-4 text-[#0073EA] flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Close */}
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
