import { useState } from "react";
import { Input } from "@/components/ui/input";

const CURRENCIES = {
  ILS: { prefix: "₪", decimals: 2, locale: undefined },
  USD: { prefix: "$", decimals: 2, locale: undefined },
  IDR: { prefix: "Rp ", decimals: 0, locale: "id-ID" },
};

// Indonesian style while typing: 1.250.000
const formatGrouped = (num) => Number(num || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const digitsOnly = (str) => String(str).replace(/[^0-9]/g, "");

export default function BudgetCell({ value, onUpdate, options }) {
  const [draft, setDraft] = useState(null); // formatted string while editing
  const { prefix, decimals, locale } = CURRENCIES[options?.currency] || CURRENCIES.IDR;
  const current = Number(value) || 0;

  const save = () => {
    if (draft === null) return;
    const numeric = parseInt(digitsOnly(draft), 10) || 0;
    if (numeric !== current) onUpdate?.(numeric);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <Input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(formatGrouped(parseInt(digitsOnly(e.target.value), 10) || 0))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setDraft(null);
        }}
        aria-label="Edit amount"
        autoFocus
        className="h-full w-full border-none bg-transparent p-1 text-center text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      />
    );
  }

  const formatted = current.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (!onUpdate) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-foreground">
        {prefix}
        {formatted}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(formatGrouped(current))}
      className="flex h-full w-full items-center justify-center rounded text-sm text-foreground transition-colors hover:bg-accent/60"
    >
      {prefix}
      {formatted}
    </button>
  );
}
