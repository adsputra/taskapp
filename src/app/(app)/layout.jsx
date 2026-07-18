import Sidebar from "@/components/layout/Sidebar";
import { Suspense } from "react";

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50/80 dark:bg-slate-950">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 w-full">
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
