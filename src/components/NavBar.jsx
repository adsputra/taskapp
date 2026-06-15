"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/lib/api/user";
import { signOut } from "@/app/actions/auth";
import {
  LayoutGrid,
  Folder,
  Search,
  Bell,
  Menu,
  X,
  Briefcase,
  TrendingUp,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "@/components/ThemeToggle";

const navigationItems = [
  { title: "Dashboard", href: "/", icon: LayoutGrid },
  { title: "My Boards", href: "/boards", icon: Folder },
  { title: "Analytics", href: "/analytics", icon: TrendingUp },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const data = await userApi.me();
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      }
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const userInitial =
    user?.full_name?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U";

  const userName =
    user?.full_name || user?.email?.split("@")[0] || "Guest";

  const userEmail = user?.email || "";
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    // Delay biar user lihat animasi dulu
    await new Promise((r) => setTimeout(r, 600));
    try {
      await signOut();
    } catch {
      // Fallback: tidak bisa sign out server-side
    }
    // Invalidate semua cache sebelum redirect ke login
    queryClient.invalidateQueries();
    router.push("/auth/login");
    router.refresh();
  };

  // Overlay sign out
  if (signingOut) {
    return (
      <>
        <div className="fixed inset-0 z-[100] backdrop-blur-sm bg-black/20 flex items-center justify-center transition-all duration-500">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center gap-4 animate-in zoom-in-95 fade-in duration-300">
            <div className="relative">
              <svg className="w-14 h-14 animate-spin" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="24" stroke="#E1E5F3" strokeWidth="3" fill="none" />
                <circle
                  cx="28" cy="28" r="24"
                  stroke="#0073EA"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="150"
                  strokeDashoffset="115"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[#323338] font-semibold text-sm">Signing Out</p>
              <p className="text-[#676879] text-xs mt-0.5">See you next time!</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Nav */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex-shrink-0 flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-xl">
                Tuesday.com
              </span>
            </Link>

            <div className="hidden md:ml-10 md:flex md:items-baseline md:space-x-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Center: Search */}
          <div className="hidden md:flex flex-1 justify-center px-2 lg:ml-6 lg:justify-end">
            <div className="max-w-lg w-full lg:max-w-xs">
              <label htmlFor="search" className="sr-only">
                Search
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                </div>
                <Input
                  id="search"
                  name="search"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 sm:text-sm"
                  placeholder="Search everything..."
                  type="search"
                />
              </div>
            </div>
          </div>

          {/* Right: Actions + Avatar */}
          <div className="hidden md:ml-4 md:flex md:items-center md:space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg h-10 w-10"
            >
              <Bell className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </Button>
            <ThemeToggle />

            {/* Avatar + Dropdown — hanya tampil kalau ada user */}
            {!loading && !user ? (
              <Link href="/auth/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-4 text-sm font-medium shadow-sm">
                  Sign In
                </Button>
              </Link>
            ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full h-10 w-10 p-0 ml-1"
                >
                  {loading ? (
                    <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                  ) : (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-white font-bold text-xs">
                        {userInitial}
                      </span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{userName}</span>
                    <span className="text-xs text-gray-500 font-normal">
                      {userEmail}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <UserIcon className="w-4 h-4 mr-2" />
                    Your Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            {!loading && !user ? (
              <Link href="/auth/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-4 text-sm font-medium shadow-sm">
                  Sign In
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="hover:bg-[#E1E5F3] dark:hover:bg-slate-800 rounded-lg h-10 w-10"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {/* Mobile: User info */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {loading ? (
                  <div className="w-11 h-11 bg-gray-200 rounded-full animate-pulse" />
                ) : (
                  <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {userInitial}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium text-slate-800 dark:text-slate-100 truncate">
                  {userName}
                </div>
                <div className="text-sm text-slate-500 truncate">
                  {userEmail}
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              </div>
              <Input
                className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                placeholder="Search everything..."
                type="search"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="px-2 pb-2 space-y-0.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  {item.title}
                </Link>
              );
            })}
            <Link
              href="/profile"
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              <UserIcon className="w-5 h-5" />
              Your Profile
            </Link>
          </div>

          {/* Sign In or Sign Out — separated at bottom */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-2 py-3">
            {!loading && !user ? (
              <Link
                href="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <LogOut className="w-5 h-5 rotate-180" />
                Sign in
              </Link>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
