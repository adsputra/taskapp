import { Suspense } from "react";
import JoinContent from "./JoinContent";
import { Loader2 } from "lucide-react";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#0073EA] animate-spin" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
