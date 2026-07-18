import Boards from "@/screens/Boards";
import { Suspense } from "react";

export const dynamic = 'force-dynamic';

export default function BoardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0073EA]" /></div>}>
      <Boards />
    </Suspense>
  );
}
