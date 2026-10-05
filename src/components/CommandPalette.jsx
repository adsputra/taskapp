"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  BarChart3,
  CheckSquare,
  CornerDownLeft,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Moon,
  Search,
  Sun,
  User,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { searchApi, MIN_SEARCH_LENGTH } from "@/lib/api/search";
import { switchTheme } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "taskapp:open-command-palette";

/** Open the palette from anywhere (e.g. the sidebar search button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const PAGES = [
  { id: "page-dashboard", label: "Dashboard", href: "/", icon: LayoutGrid },
  { id: "page-tasks", label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { id: "page-boards", label: "Boards", href: "/boards", icon: LayoutTemplate },
  { id: "page-analytics", label: "Analytics", href: "/analytics", icon: BarChart3 },
  { id: "page-profile", label: "Profile & security", href: "/profile", icon: User },
];

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);
  const listId = useId();

  const term = useDebounced(query.trim(), 200);
  const searching = term.length >= MIN_SEARCH_LENGTH;

  const { data: results, isFetching } = useQuery({
    queryKey: ["search", term],
    queryFn: () => searchApi.search(term),
    enabled: open && searching,
    staleTime: 15 * 1000,
    placeholderData: (previous) => previous,
  });

  // Ctrl/⌘+K anywhere, plus the custom open event.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const isDark = resolvedTheme === "dark";
    const commands = [
      ...PAGES.filter((page) => !needle || page.label.toLowerCase().includes(needle)).map((page) => ({
        ...page,
        group: "Go to",
        run: () => router.push(page.href),
      })),
      {
        id: "toggle-theme",
        label: isDark ? "Switch to light mode" : "Switch to dark mode",
        icon: isDark ? Sun : Moon,
        group: "Preferences",
        keywords: "theme dark light mode appearance",
        run: () => switchTheme(setTheme, isDark ? "light" : "dark"),
      },
    ].filter((cmd) => !needle || `${cmd.label} ${cmd.keywords || ""}`.toLowerCase().includes(needle));

    const boards = searching
      ? (results?.boards || []).map((board) => ({
          id: `board-${board.id}`,
          label: board.title,
          color: board.color,
          group: "Boards",
          run: () => router.push(`/boards/${board.id}`),
        }))
      : [];

    const tasks = searching
      ? (results?.items || []).map((item) => ({
          id: `task-${item.id}`,
          label: item.title,
          hint: item.board_title,
          color: item.board_color,
          group: "Tasks",
          run: () => router.push(`/boards/${item.board_id}?task=${item.id}`),
        }))
      : [];

    return [...tasks, ...boards, ...commands];
  }, [query, searching, results, resolvedTheme, router, setTheme]);

  const activeOption = sections[Math.min(activeIndex, Math.max(sections.length - 1, 0))];

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const runOption = (option) => {
    if (!option) return;
    close();
    option.run();
  };

  const moveActive = (delta) => {
    if (sections.length === 0) return;
    const next = (activeIndex + delta + sections.length) % sections.length;
    setActiveIndex(next);
    listRef.current
      ?.querySelector(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  const onInputKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runOption(activeOption);
    }
  };

  let previousGroup = null;

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search boards and tasks, or jump to a page. Use the arrow keys and Enter.
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border px-4">
          {isFetching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search tasks and boards…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
          />
          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" className="max-h-[min(22rem,55vh)] overflow-y-auto p-2 scroll-themed">
          {sections.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {searching && !isFetching ? `No results for “${term}”` : "Type at least 2 characters to search"}
            </p>
          )}

          {sections.map((option, index) => {
            const showGroup = option.group !== previousGroup;
            previousGroup = option.group;
            const Icon = option.icon;
            const active = option === activeOption;
            return (
              <div key={option.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground first:pt-1">
                    {option.group}
                  </p>
                )}
                <div
                  id={`${listId}-${option.id}`}
                  role="option"
                  aria-selected={active}
                  data-index={index}
                  onMouseMove={() => activeIndex !== index && setActiveIndex(index)}
                  onClick={() => runOption(option)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-foreground"
                  )}
                >
                  {Icon ? (
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color || "hsl(var(--primary))" }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="max-w-[40%] truncate text-xs text-muted-foreground">{option.hint}</span>
                  )}
                  {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
