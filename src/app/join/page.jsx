import { Suspense } from "react";
import JoinContent from "./JoinContent";
import { Loader2 } from "lucide-react";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-muted flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
