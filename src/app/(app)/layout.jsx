import Sidebar from "@/components/layout/Sidebar";
import RealtimeSync from "@/components/RealtimeSync";
import { Suspense } from "react";

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50/80 dark:bg-slate-950">
      <RealtimeSync />
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      {/* min-w-0: without it a flex child can't shrink below its content,
          so wide views (Kanban) pushed the page past the viewport. */}
      <main className="flex-1 min-w-0">
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
