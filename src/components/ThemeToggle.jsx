"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a static placeholder during SSR / first paint to avoid hydration mismatch
    return (
      <button
        aria-label="Toggle theme"
        className="
          relative inline-flex items-center gap-1.5
          h-8 px-3 rounded-full
          border border-slate-200 bg-white
          shadow-sm select-none
        "
      >
        <Sun className="w-4 h-4 text-slate-400" />
        <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
          Light
        </span>
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`
        relative inline-flex items-center gap-1.5
        h-8 px-3 rounded-full
        border shadow-sm select-none
        transition-all duration-300 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40
        ${
          isDark
            ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
            : "bg-white border-slate-200 hover:bg-slate-50"
        }
      `}
    >
      {/* Icon container — sliding knob */}
      <span
        className={`
          relative z-10 flex items-center justify-center
          w-5 h-5 rounded-full
          transition-transform duration-300
          ${isDark ? "rotate-0" : "rotate-0"}
        `}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-blue-300" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
      </span>

      {/* Label */}
      <span
        className={`
          relative z-10 text-[10px] font-semibold tracking-widest uppercase
          transition-colors duration-300
          ${isDark ? "text-slate-300" : "text-slate-500"}
        `}
      >
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
}
