"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { userApi } from "@/lib/api/user";
import { signOut } from "@/app/actions/auth";
import {
  LayoutGrid,
  Folder,
  Search,
  Bell,
  HelpCircle,
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

const navigationItems = [
  { title: "Dashboard", href: "/", icon: LayoutGrid },
  { title: "My Boards", href: "/boards", icon: Folder },
  { title: "Analytics", href: "/analytics", icon: TrendingUp },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
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
    user?.full_name || user?.email?.split("@")[0] || "User";

  const userEmail = user?.email || "";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Fallback: tidak bisa sign out server-side
    }
    router.push("/auth/login");
    router.refresh();
  };

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white border-b border-[#E1E5F3] shadow-sm sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Nav */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex-shrink-0 flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-[#323338] text-xl">
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
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#E1E5F3] text-[#0073EA]"
                        : "text-[#323338] hover:bg-[#F5F6F8] hover:text-[#0073EA]"
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
                  <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <Input
                  id="search"
                  name="search"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] sm:text-sm"
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
              className="hover:bg-[#E1E5F3] rounded-lg h-10 w-10"
            >
              <Bell className="w-5 h-5 text-[#676879]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-[#E1E5F3] rounded-lg h-10 w-10"
            >
              <HelpCircle className="w-5 h-5 text-[#676879]" />
            </Button>

            {/* Avatar + Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full h-10 w-10 p-0 ml-1"
                >
                  {loading ? (
                    <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-r from-[#0073EA] to-[#00C875] rounded-full flex items-center justify-center shadow-sm">
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
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="hover:bg-[#E1E5F3] rounded-lg h-10 w-10"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E1E5F3] bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navigationItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    active
                      ? "bg-[#E1E5F3] text-[#0073EA]"
                      : "text-[#323338] hover:bg-[#F5F6F8] hover:text-[#0073EA]"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>

          {/* Mobile: Search */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-2">
              <label htmlFor="search-mobile" className="sr-only">
                Search
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <Input
                  id="search-mobile"
                  name="search-mobile"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0073EA] focus:border-[#0073EA] sm:text-sm"
                  placeholder="Search everything..."
                  type="search"
                />
              </div>
            </div>
          </div>

          {/* Mobile: User info */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-5">
              <div className="flex-shrink-0">
                {loading ? (
                  <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-r from-[#0073EA] to-[#00C875] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {userInitial}
                    </span>
                  </div>
                )}
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">
                  {userName}
                </div>
                <div className="text-sm font-medium text-gray-500">
                  {userEmail}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto hover:bg-[#E1E5F3] rounded-lg h-10 w-10"
              >
                <Bell className="w-5 h-5 text-[#676879]" />
              </Button>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                Your Profile
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
