import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function NumberCell({ value, onUpdate }) {
  const [draft, setDraft] = useState(null); // null = not editing
  const current = Number(value) || 0;

  const save = () => {
    if (draft === null) return;
    const next = parseFloat(draft);
    const numeric = Number.isFinite(next) ? next : 0;
    if (numeric !== current) onUpdate?.(numeric);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <Input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setDraft(null);
        }}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Edit number"
        autoFocus
        className="h-full w-full border-none bg-transparent p-1 text-center text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      />
    );
  }

  if (!onUpdate) {
    return <div className="flex h-full w-full items-center justify-center text-sm text-foreground">{current.toLocaleString()}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(String(current))}
      className="flex h-full w-full items-center justify-center rounded text-sm text-foreground transition-colors hover:bg-accent/60"
    >
      {current.toLocaleString()}
    </button>
  );
}
