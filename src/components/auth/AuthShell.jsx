"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, BarChart3, Briefcase, CheckCircle2, LayoutGrid, Users } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: LayoutGrid, text: "Kelola proyek dengan board interaktif" },
  { icon: Users, text: "Kolaborasi tim secara real-time" },
  { icon: BarChart3, text: "Pantau progres dengan analitik" },
];

/**
 * Two-column frame for every /auth page. Follows the user's theme (the
 * old pages forced light mode by rewriting the stored preference, which
 * made the app flash when you came back from login).
 */
export default function AuthShell({ headline, subline, title, description, children, footer }) {
  return (
    <div className="flex min-h-screen bg-background">
      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 lg:flex lg:w-1/2 dark:from-blue-950 dark:to-slate-950"
      >
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute bottom-0 right-0 -mb-48 -mr-48 h-[500px] w-[500px] rounded-full bg-white/5" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Briefcase className="h-6 w-6 text-white" />
            </span>
            <span className="text-2xl font-bold text-white">Tuesday</span>
          </Link>

          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">{headline}</h1>
              {subline && <p className="max-w-md text-lg text-white/75">{subline}</p>}
            </div>
            <ul className="space-y-4">
              {FEATURES.map((feature, i) => (
                <motion.li
                  key={feature.text}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                    <feature.icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="text-white/90">{feature.text}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-white/50">&copy; {new Date().getFullYear()} Tuesday</p>
        </div>
      </motion.aside>

      <main className="relative flex flex-1 items-center justify-center p-6 lg:p-12">
        <ThemeToggle className="absolute right-6 top-6" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Briefcase className="h-5 w-5 text-primary-foreground" />
              </span>
              <span className="text-xl font-bold text-foreground">Tuesday</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground lg:text-3xl">{title}</h2>
            {description && <p className="mt-2 text-muted-foreground">{description}</p>}
          </div>

          {children}

          {footer && <div className="mt-8 text-center text-muted-foreground">{footer}</div>}
        </motion.div>
      </main>
    </div>
  );
}

export function AuthAlert({ tone = "error", children }) {
  if (!children) return null;
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-success/30 bg-success/10 text-foreground"
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tone === "error" ? "text-destructive" : "text-success")} />
      <div className="min-w-0">{children}</div>
    </motion.div>
  );
}

export const authInputClass =
  "h-12 w-full rounded-xl border-input bg-card px-4 text-foreground transition-shadow placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25";

export const authButtonClass =
  "h-12 w-full rounded-xl bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

export function AuthFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-border border-t-primary" />
    </div>
  );
}
