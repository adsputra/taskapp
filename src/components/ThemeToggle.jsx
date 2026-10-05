"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};
// true on the client, false during SSR — without a setState-in-effect.
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Switch theme with one smooth motion for the whole page.
 *
 * The DOM change happens inside a view transition: the browser snapshots
 * the old page, we apply the new theme synchronously (flushSync, so
 * next-themes' class update lands inside the callback), and the new
 * snapshot is revealed with a circle growing from the toggle. Browsers
 * without the API — or users who prefer reduced motion — get an instant
 * switch; next-themes suppresses per-element transitions either way.
 */
export function switchTheme(setTheme, nextTheme, origin) {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof document === "undefined" || !document.startViewTransition || prefersReducedMotion) {
    setTheme(nextTheme);
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = document.startViewTransition(() => {
    flushSync(() => setTheme(nextTheme));
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 480,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {});
}

export default function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  if (!hydrated) {
    return <div aria-hidden className={cn("h-7 w-[52px] rounded-full bg-muted", className)} />;
  }

  const isDark = resolvedTheme === "dark";

  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    switchTheme(setTheme, isDark ? "light" : "dark", {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={handleClick}
      className={cn(
        "relative inline-flex h-7 w-[52px] select-none items-center rounded-full border border-border bg-muted transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border transition-transform duration-300 ease-out",
          isDark ? "translate-x-[26px]" : "translate-x-0.5"
        )}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-primary" />
        ) : (
          <Sun className="h-3 w-3 text-warning" />
        )}
      </span>
    </button>
  );
}
