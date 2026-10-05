"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { switchTheme, useHydrated } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const current = hydrated ? theme || "system" : null;

  return (
    <section className="space-y-4" aria-labelledby="appearance-heading">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <h3 id="appearance-heading" className="text-sm font-semibold text-foreground">
          Appearance
        </h3>
      </div>
      <div role="radiogroup" aria-labelledby="appearance-heading" className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ id, label, icon: Icon }) => {
          const selected = current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                switchTheme(setTheme, id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors",
                selected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">System follows your device setting automatically.</p>
    </section>
  );
}
