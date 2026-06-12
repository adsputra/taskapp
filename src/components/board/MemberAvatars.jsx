"use client";

import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Shield, Mail } from "lucide-react";

const MAX_VISIBLE = 4;

const ROLE_COLOR = {
  admin: "#0073EA",
  editor: "#00C875",
  viewer: "#676879",
};

const AVATAR_COLORS = [
  "#0073EA", "#00C875", "#E2445C", "#FF9900",
  "#7F63FF", "#00B5D8", "#FF158A", "#9B59B6",
];

function getInitial(email) {
  return (email || "?")[0].toUpperCase();
}

function getColor(str, idx) {
  if (str === "owner") return "#0073EA";
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function MemberAvatars({ members = [], boardOwnerId }) {
  const [open, setOpen] = useState(false);

  if (!members || members.length === 0) return null;

  const sorted = [...members].sort((a, b) => {
    // Owner first, then active, then pending
    const aOwner = a.user_id === boardOwnerId ? -1 : 0;
    const bOwner = b.user_id === boardOwnerId ? -1 : 0;
    if (aOwner !== bOwner) return aOwner - bOwner;
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return 0;
  });

  const overflow = sorted.length - MAX_VISIBLE;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center -space-x-1.5 hover:opacity-80 transition-opacity">
          {sorted.slice(0, MAX_VISIBLE).map((m, i) => {
            const isOwner = m.user_id === boardOwnerId;
            return (
              <span
                key={m.id}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white ring-1 ring-[#E1E5F3] shrink-0"
                style={{
                  backgroundColor: isOwner
                    ? ROLE_COLOR.admin
                    : getColor(m.email, i),
                  zIndex: MAX_VISIBLE - i,
                }}
                title={m.email}
              >
                {isOwner ? (
                  <Shield className="w-3 h-3" />
                ) : (
                  getInitial(m.email)
                )}
              </span>
            );
          })}
          {overflow > 0 && (
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#F5F6F8] text-[#676879] border-2 border-white ring-1 ring-[#E1E5F3] shrink-0"
              style={{ zIndex: 0 }}>
              +{overflow}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end" sideOffset={8}>
        <div className="p-3 border-b border-[#E1E5F3]">
          <p className="text-xs font-semibold text-[#323338]">
            Board Members ({members.length})
          </p>
        </div>
        <div className="max-h-[220px] overflow-y-auto">
          {sorted.map((m) => {
            const isOwner = m.user_id === boardOwnerId;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F6F8]"
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{
                    backgroundColor: isOwner
                      ? ROLE_COLOR.admin
                      : getColor(m.email, 0),
                  }}
                >
                  {isOwner ? (
                    <Shield className="w-3 h-3" />
                  ) : (
                    getInitial(m.email)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#323338] truncate">{m.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      className="text-[10px] px-1.5 py-0 h-4"
                      style={{
                        backgroundColor: (isOwner ? "#0073EA" : ROLE_COLOR[m.role] || ROLE_COLOR.viewer) + "15",
                        color: isOwner ? "#0073EA" : ROLE_COLOR[m.role] || ROLE_COLOR.viewer,
                        borderColor: "transparent",
                      }}
                    >
                      {isOwner ? "Owner" : m.role}
                    </Badge>
                    <span
                      className={`text-[10px] ${
                        m.status === "active"
                          ? "text-[#00C875]"
                          : "text-[#FF9900]"
                      }`}
                    >
                      {m.status === "active"
                        ? "Active"
                        : m.status === "pending"
                        ? "Pending"
                        : m.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
