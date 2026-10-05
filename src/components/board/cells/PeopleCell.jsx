"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, User } from "lucide-react";
import { boardsApi } from "@/lib/api/boards";
import { useBoardPeople } from "@/hooks/useBoardPeople";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["#2563EB", "#059669", "#DC2626", "#D97706", "#7C3AED", "#0891B2"];

export function avatarColor(key) {
  let hash = 0;
  for (const char of key || "") hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function displayName(email, people) {
  const person = people.find((p) => p.email === email?.toLowerCase());
  return person?.full_name || email?.split("@")[0] || "Unknown";
}

function Avatar({ email, people, size = "sm", className }) {
  const name = displayName(email, people);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
        className
      )}
      style={{ backgroundColor: avatarColor(email) }}
      title={name}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Assign people (stored as an array of emails). The list contains the
 * board owner and every active member; the database notifies newly
 * assigned people.
 */
export default function PeopleCell({ value, onUpdate, boardId }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Same cache entry the board page uses.
  const { data: board } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => boardsApi.get(boardId),
    enabled: Boolean(boardId),
  });
  const { people, isLoading } = useBoardPeople(board);

  const assigned = (Array.isArray(value) ? value : value ? [value] : []).map((e) => String(e).toLowerCase());
  const needle = search.trim().toLowerCase();
  const filtered = people.filter(
    (p) => !needle || p.email.includes(needle) || (p.full_name || "").toLowerCase().includes(needle)
  );

  const toggle = (email) => {
    if (!onUpdate) return;
    onUpdate(assigned.includes(email) ? assigned.filter((e) => e !== email) : [...assigned, email]);
  };

  const summary =
    assigned.length === 0
      ? "Unassigned"
      : assigned.map((email) => displayName(email, people)).join(", ");

  const trigger = (
    <button
      type="button"
      disabled={!onUpdate}
      aria-label={`Assignees: ${summary}`}
      className={cn(
        "flex h-full w-full items-center justify-center gap-2 rounded px-1 transition-colors",
        onUpdate ? "cursor-pointer hover:bg-accent/60" : "cursor-default"
      )}
    >
      {assigned.length === 0 && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
            <User className="h-3 w-3" />
          </span>
          {onUpdate && "Assign"}
        </span>
      )}
      {assigned.length === 1 && (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar email={assigned[0]} people={people} />
          <span className="max-w-[90px] truncate text-sm text-foreground">
            {displayName(assigned[0], people)}
          </span>
        </span>
      )}
      {assigned.length > 1 && (
        <span className="flex items-center">
          {assigned.slice(0, 3).map((email) => (
            <Avatar key={email} email={email} people={people} className="-ml-1.5 border-2 border-card first:ml-0" />
          ))}
          {assigned.length > 3 && (
            <span className="ml-1 text-xs text-muted-foreground">+{assigned.length - 3}</span>
          )}
        </span>
      )}
    </button>
  );

  if (!onUpdate) return <div className="h-full w-full">{trigger}</div>;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 overflow-hidden rounded-xl p-0">
        <div className="border-b border-border p-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto scroll-themed" role="listbox" aria-multiselectable="true">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-full rounded" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {people.length === 0 ? "Invite people to this board first." : "No matching people."}
            </p>
          ) : (
            filtered.map((person) => {
              const checked = assigned.includes(person.email);
              return (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(person.email)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <Avatar email={person.email} people={people} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {person.full_name || person.email.split("@")[0]}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                  </span>
                  {checked && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
