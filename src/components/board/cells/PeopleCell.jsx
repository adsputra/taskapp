"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { User, Check } from "lucide-react";
import { boardsApi } from "@/lib/api/boards";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * PeopleCell — assign dropdown. Fixed position agar tidak terpotong overflow.
 * Menampilkan nama + avatar setelah dipilih.
 */
export default function PeopleCell({ value, onUpdate, itemId, column, boardId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const assignedUsers = Array.isArray(value) ? value : value ? [value] : [];

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
    if (!onUpdate) return;
    const newAssigned = assignedUsers.includes(memberEmail)
      ? assignedUsers.filter((u) => u !== memberEmail)
      : [...assignedUsers, memberEmail];
    onUpdate(newAssigned);
  };

  const getUserInitial = (email) => email?.charAt(0)?.toUpperCase() || "?";
  const getUserName = (email) => email?.split("@")[0] || email || "Unknown";

  const getUserColor = (email) => {
    const colors = ["#0073EA", "#00C875", "#E2445C", "#FFCB00", "#A358DF", "#579BFC"];
    let hash = 0;
    for (let i = 0; i < (email || "").length; i++)
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getDropdownPos = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let left = rect.left;
      if (left + 256 > window.innerWidth) left = window.innerWidth - 272;
      return { top: rect.bottom + 4, left };
    }
    return { top: 0, left: 0 };
  }, []);

  const openDropdown = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  // Click outside
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

  // Force re-render on scroll/resize
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const rerender = () => setTick((t) => t + 1);
    window.addEventListener("scroll", rerender, true);
    window.addEventListener("resize", rerender);
    return () => {
      window.removeEventListener("scroll", rerender, true);
      window.removeEventListener("resize", rerender);
    };
  }, [isOpen]);

  // Dropdown position — dihitung saat render, bukan via state
  const pos = getDropdownPos();

  return (
    <div className="relative">
      {/* Trigger — avatar + nama */}
      <div
        ref={triggerRef}
        className={`flex items-center gap-2 w-full h-full px-1 rounded transition-colors ${onUpdate ? 'cursor-pointer hover:bg-[#E1E5F3]/50' : ''}`}
        onClick={() => onUpdate && openDropdown()}
      >
        {assignedUsers.length === 0 && (
          <span className="text-[#676879] text-sm flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-[#E1E5F3] flex items-center justify-center">
              <User className="w-3 h-3 text-[#676879]" />
            </span>
            Assign
          </span>
        )}
        {assignedUsers.length === 1 && (
          <span className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: getUserColor(assignedUsers[0]) }}
            >
              {getUserInitial(assignedUsers[0])}
            </span>
            <span className="text-sm text-[#323338] truncate max-w-[100px]">
              {getUserName(assignedUsers[0])}
            </span>
          </span>
        )}
        {assignedUsers.length > 1 && (
          <span className="flex items-center gap-1.5">
            {assignedUsers.slice(0, 3).map((email, i) => (
              <span
                key={email}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white -ml-1 first:ml-0"
                style={{ backgroundColor: getUserColor(email) }}
                title={getUserName(email)}
              >
                {getUserInitial(email)}
              </span>
            ))}
            <span className="text-xs text-[#323338] ml-1">
              {assignedUsers.length} people
            </span>
          </span>
        )}
      </div>

      {/* Dropdown — fixed di viewport, posisi dihitung saat render */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 100, width: 256 }}
          className="bg-white rounded-xl shadow-lg border border-[#E1E5F3] overflow-hidden"
        >
          <div className="p-2 border-b border-[#E1E5F3]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full text-sm border border-[#E1E5F3] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-8 w-full rounded" />
                <Skeleton className="h-8 w-full rounded" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#A0A0A0]">
                {members.length === 0
                  ? "No team members yet."
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
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: getUserColor(email) }}
                    >
                      {getUserInitial(email)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#323338] truncate">
                        {getUserName(email)}
                      </p>
                      <p className="text-xs text-[#676879] truncate">{email}</p>
                    </span>
                    {isChecked && <Check className="w-4 h-4 text-[#0073EA] flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
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
