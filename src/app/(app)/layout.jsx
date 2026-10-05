import Sidebar from "@/components/layout/Sidebar";
import RealtimeSync from "@/components/RealtimeSync";
import CommandPalette from "@/components/CommandPalette";
import { Suspense } from "react";

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <RealtimeSync />
      <CommandPalette />
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      {/* min-w-0: without it a flex child can't shrink below its content,
          so wide views (Kanban) pushed the page past the viewport. */}
      <main id="main-content" className="flex-1 min-w-0">
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
