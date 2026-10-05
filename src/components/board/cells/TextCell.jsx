import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function TextCell({ value, onUpdate }) {
  const [draft, setDraft] = useState(null); // null = not editing

  const save = () => {
    if (draft !== null && draft !== (value || "")) onUpdate?.(draft);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setDraft(null);
        }}
        aria-label="Edit text"
        className="h-full w-full border-none bg-transparent text-sm font-medium text-foreground focus-visible:ring-0"
        autoFocus
      />
    );
  }

  if (!onUpdate) {
    return <div className="flex h-full w-full items-center text-sm font-medium text-foreground">{value}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(value || "")}
      className={cn(
        "flex h-full w-full items-center rounded text-left text-sm font-medium transition-colors hover:bg-accent/60",
        value ? "text-foreground" : "text-subtle-foreground"
      )}
    >
      {value || "Enter text..."}
    </button>
  );
}
