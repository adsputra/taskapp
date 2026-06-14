"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Star } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-[52px] h-7 rounded-full bg-gray-200" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative inline-flex items-center w-[52px] h-7 rounded-full transition-colors duration-300 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
        isDark ? "bg-gray-600" : "bg-gray-300"
      }`}
    >
      {/* Round sliding knob */}
      <span
        className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md transition-all duration-300 ease-in-out flex items-center justify-center ${
          isDark
            ? "left-[calc(100%-26px)] bg-gray-400"
            : "left-0.5 bg-white"
        }`}
      >
        {isDark ? (
          <Moon className="w-3 h-3 text-gray-800" />
        ) : (
          <Sun className="w-3 h-3 text-gray-500" />
        )}
      </span>
    </button>
  );
}
