"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { userApi } from "@/lib/api/user";
import { boardsApi } from "@/lib/api/boards";
import { signOut } from "@/app/actions/auth";
import {
  LayoutGrid,
  CheckSquare,
  TrendingUp,
  Folder,
  Plus,
  Bell,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Briefcase,
  Settings,
  Star,
  Clock,
  ChevronRight,
  Sparkles,
  LayoutTemplate,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/board/NotificationBell";
import { openCommandPalette } from "@/components/CommandPalette";

// Desktop collapse preference, persisted per browser.
const COLLAPSED_KEY = "taskapp_sidebar_collapsed";
const collapsedListeners = new Set();

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(value) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {
    // storage unavailable: the toggle still works for this page view
  }
  collapsedListeners.forEach((listener) => listener());
}

function subscribeCollapsed(listener) {
  collapsedListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    collapsedListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const collapsedPreference = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false
  );
  // The mobile drawer always shows the full sidebar.
  const isCollapsed = collapsedPreference && !mobileMenuOpen;
  const [signingOut, setSigningOut] = useState(false);

  const toggleCollapse = () => writeCollapsed(!collapsedPreference);

  // Own key: the Boards page caches the full list under ["boards"], and a
  // shared key let this 5-item list overwrite it.
  const { data: boards = [] } = useQuery({
    queryKey: ["boards", "recent"],
    queryFn: () => boardsApi.list({ limit: 5 }),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: user = null, isLoading: loading } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
  });

  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.full_name || user?.email?.split("@")[0] || "Guest";
  const userEmail = user?.email || "";

  const handleSignOut = async () => {
    setSigningOut(true);
    await new Promise((r) => setTimeout(r, 600));
    try {
      await signOut();
    } catch {}
    queryClient.invalidateQueries();
    router.push("/auth/login");
    router.refresh();
  };

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    
    const [path, query] = href.split("?");
    if (!pathname.startsWith(path)) return false;

    if (query) {
      const urlParams = new URLSearchParams(query);
      for (const [key, value] of urlParams.entries()) {
        if (searchParams.get(key) !== value) {
          return false;
        }
      }
      return true;
    } else {
      // If href is /boards without query, but current url has ?filter=shared, return false
      if (path === "/boards" && searchParams.has("filter")) {
        return false;
      }
      return true;
    }
  };

  // Overlay sign out
  if (signingOut) {
    return (
      <div className="fixed inset-0 z-[100] backdrop-blur-md bg-white/50 dark:bg-slate-900/50 flex items-center justify-center transition-all duration-500">
        <div className="bg-card rounded-2xl shadow-2xl px-10 py-12 flex flex-col items-center gap-5 border border-border animate-in zoom-in-95 fade-in duration-300">
          <div className="relative">
            <svg className="w-14 h-14 animate-spin" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="24" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="3" fill="none" />
              <circle
                cx="28" cy="28" r="24" stroke="currentColor" className="text-blue-600" strokeWidth="3"
                fill="none" strokeLinecap="round" strokeDasharray="150" strokeDashoffset="115"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-foreground font-bold text-lg tracking-tight">Signing Out</p>
            <p className="text-muted-foreground text-sm mt-1">See you next time!</p>
          </div>
        </div>
      </div>
    );
  }

  const mainNavigation = [
    { title: "Dashboard", href: "/", icon: LayoutGrid },
    { title: "My Tasks", href: "/my-tasks", icon: CheckSquare },
    { title: "Analytics", href: "/analytics", icon: TrendingUp },
  ];

  const projectsNavigation = [
    { title: "My Boards", href: "/boards", icon: LayoutTemplate },
    { title: "Shared with Me", href: "/boards?filter=shared", icon: UserIcon },
  ];

  const renderNavItems = (items) => (
    <div className="space-y-1.5 px-3">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.title}
            href={item.href}
            title={isCollapsed ? item.title : undefined}
            prefetch={true}
            onClick={() => setMobileMenuOpen(false)}
            className={`group relative flex items-center px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-300 overflow-hidden ${
              isCollapsed ? "justify-center w-11 h-11 mx-auto" : "gap-3"
            } ${
              active
                ? "bg-blue-50/80 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {active && (
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full transition-all duration-300 ${isCollapsed ? 'hidden' : 'block'}`} />
            )}
            <Icon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${active ? 'scale-110 text-blue-600' : 'group-hover:scale-110 text-slate-500 dark:text-slate-400'} ${isCollapsed && active ? 'text-blue-600' : ''}`} />
            <span className={`truncate transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 -translate-x-4 absolute' : 'w-auto opacity-100 translate-x-0 relative'}`}>
              {item.title}
            </span>
          </Link>
        );
      })}
    </div>
  );

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-r border-border flex-shrink-0 transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] ${isCollapsed ? 'w-[80px]' : 'w-64'}`}>
      {/* Header */}
      <div className={`p-4 border-b border-border flex flex-col transition-all duration-300`}>
        <div className={`flex mb-6 transition-all duration-300 ${isCollapsed ? 'flex-col-reverse items-center gap-5 w-full mt-2' : 'flex-row items-center justify-between px-1'}`}>
          <Link href="/" className={`flex items-center group overflow-hidden transition-all duration-300 ${isCollapsed ? 'justify-center' : 'gap-3'}`} onClick={() => setMobileMenuOpen(false)}>
            <div className="relative flex items-center justify-center w-8 h-8 bg-blue-600 rounded-xl transition-shadow flex-shrink-0">
              <Briefcase className="w-4.5 h-4.5 text-white" />
            </div>
            <span className={`font-bold text-foreground tracking-tight transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 overflow-hidden absolute' : 'text-xl w-auto opacity-100 relative'}`}>
              Tuesday
            </span>
          </Link>
          
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-1'}`}>
            <NotificationBell align="start" className="hidden md:flex" />
            <Button
              variant="ghost"
              size="icon"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              className={`hidden md:flex flex-shrink-0 w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-300 ${isCollapsed ? 'bg-accent text-foreground' : ''}`}
              onClick={toggleCollapse}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <Link href="/boards" onClick={() => setMobileMenuOpen(false)} className={`flex w-full transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}>
          <Button title={isCollapsed ? "Create Board" : undefined} className={`bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium transition-all duration-300 flex items-center justify-center group overflow-hidden relative ${isCollapsed ? 'w-[36px] h-[36px] p-0 rounded-full gap-0' : 'w-full h-10 px-4 gap-2 text-sm rounded-xl'}`}>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <Plus className={`w-5 h-5 relative z-10 transition-transform duration-300 flex-shrink-0 group-hover:rotate-90 ${isCollapsed ? 'm-auto' : ''}`} /> 
            <span className={`relative z-10 whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 absolute overflow-hidden' : 'w-auto opacity-100 relative'}`}>Create Board</span>
          </Button>
        </Link>

        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            openCommandPalette();
          }}
          aria-label="Search (Ctrl+K)"
          title={isCollapsed ? "Search (Ctrl+K)" : undefined}
          className={`mt-3 flex items-center rounded-xl border border-border bg-muted/60 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${isCollapsed ? 'mx-auto h-9 w-9 justify-center' : 'h-9 w-full gap-2 px-3'}`}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="rounded border border-border bg-card px-1.5 text-[10px] font-medium">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-5 space-y-6 custom-scrollbar">
        <div>
          <p className={`font-bold text-subtle-foreground uppercase tracking-widest mb-3 flex items-center gap-2 transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 h-0 m-0' : 'text-[11px] px-6 w-full opacity-100 h-auto'}`}>
            <Sparkles className="w-3.5 h-3.5" /> Workspace
          </p>
          {renderNavItems(mainNavigation)}
        </div>

        <div>
          <p className={`font-bold text-subtle-foreground uppercase tracking-widest mb-3 flex items-center gap-2 transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 h-0 m-0' : 'text-[11px] px-6 w-full opacity-100 h-auto'}`}>
            <Folder className="w-3.5 h-3.5" /> Projects
          </p>
          {renderNavItems(projectsNavigation)}
        </div>

        <div>
          <p className={`font-bold text-subtle-foreground uppercase tracking-widest mb-3 flex items-center gap-2 transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 h-0 m-0' : 'text-[11px] px-6 w-full opacity-100 h-auto'}`}>
            <Clock className="w-3.5 h-3.5" /> Recent
          </p>
          <div className="space-y-1 px-3">
            {boards.slice(0, 3).map(board => {
              const isShared = user && board.user_id !== user.id;
              const boardHref = `/boards/${board.id}${isShared ? '?filter=shared' : ''}`;
              
              return (
                <Link
                  key={board.id}
                  href={boardHref}
                  title={isCollapsed ? board.title : undefined}
                  prefetch={true}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group relative flex items-center px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-300 overflow-hidden ${
                    isCollapsed ? "justify-center w-11 h-11 mx-auto" : "justify-between"
                  } text-muted-foreground hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-foreground `}
                >
                <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'justify-center' : 'gap-3 truncate w-full'}`}>
                  <div className="w-3 h-3 flex-shrink-0 rounded-full shadow-sm" style={{ backgroundColor: board.color || "#2563EB" }} />
                  <span className={`truncate transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 absolute' : 'w-auto opacity-100 relative'}`}>{board.title}</span>
                </div>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ${isCollapsed ? 'hidden' : 'block'}`} />
              </Link>
              );
            })}
            {boards.length === 0 && (
              <p className={`py-2 text-xs text-subtle-foreground italic transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 h-0 m-0 overflow-hidden' : 'px-6 w-auto opacity-100'}`}>No recent boards</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/30 flex flex-col transition-all duration-300 ${isCollapsed ? 'items-center gap-6 py-6' : 'space-y-4'}`}>
        <div className={`flex items-center transition-all duration-300 w-full ${isCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
          <span className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 absolute overflow-hidden' : 'w-auto opacity-100 relative'}`}>Appearance</span>
          <ThemeToggle />
        </div>
        
        {!loading && !user ? (
          <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)} className="w-full flex justify-center">
            <Button title={isCollapsed ? "Sign In" : undefined} variant="ghost" className={`text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-10 h-10 p-0 rounded-full' : 'w-full justify-center text-sm rounded-xl h-10'}`}>
              <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? 'rotate-180' : 'hidden'}`} />
              <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 absolute' : 'w-auto opacity-100 relative'}`}>Sign In</span>
            </Button>
          </Link>
        ) : (
          <div className={`flex transition-all duration-300 w-full ${isCollapsed ? 'flex-col gap-4 items-center' : 'flex-col space-y-1'}`}>
            <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="w-full flex justify-center">
              <Button title={isCollapsed ? "Profile" : undefined} variant="ghost" className={`hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all duration-300 group overflow-hidden ${isCollapsed ? 'w-10 h-10 p-0 rounded-full justify-center' : 'w-full justify-start h-auto py-2 px-2 rounded-xl'}`}>
                <div className={`flex items-center w-full transition-all duration-300 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xs">{userInitial}</span>
                  </div>
                  <div className={`flex flex-col items-start min-w-0 transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 absolute' : 'flex-1 opacity-100 relative'}`}>
                    <span className="truncate text-sm font-semibold text-foreground w-full text-left">{userName}</span>
                    <span className="truncate text-[11px] text-muted-foreground w-full text-left">{userEmail}</span>
                  </div>
                </div>
              </Button>
            </Link>
            <Button title={isCollapsed ? "Sign Out" : undefined} variant="ghost" onClick={handleSignOut} className={`text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-10 h-10 p-0 rounded-full justify-center' : 'w-full justify-start text-sm h-9 px-3 rounded-xl'}`}>
              <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-2'}`} /> 
              <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 absolute' : 'w-auto opacity-100 relative'}`}>Sign Out</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block h-screen sticky top-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-border sticky top-0 z-40 shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-foreground text-xl tracking-tight">Tuesday</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Search" onClick={openCommandPalette}>
            <Search className="w-5 h-5" />
          </Button>
          <NotificationBell />
          <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Mobile Drawer (Always expanded view) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] h-full animate-in slide-in-from-left duration-300 ease-out shadow-2xl">
            <Button variant="ghost" size="icon" aria-label="Close menu" className="absolute top-4 right-4 z-50 text-muted-foreground hover:bg-accent rounded-full" onClick={() => setMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
