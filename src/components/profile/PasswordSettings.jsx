"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

function PasswordField({ id, label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="h-11 rounded-xl border-input bg-muted/50 pr-11"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordSettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!current || !next) return toast.error("Please fill in all fields");
    if (next.length < PASSWORD_MIN_LENGTH) {
      return toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (next !== confirm) return toast.error("Passwords do not match");

    setSaving(true);
    const result = await changePassword(current, next).catch(() => ({ error: "Server unreachable." }));
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password changed");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="password-heading">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h3 id="password-heading" className="text-sm font-semibold text-foreground">
          Change password
        </h3>
      </div>
      <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField id="new-password" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordField id="confirm-password" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <Button type="submit" disabled={saving} className="h-11 rounded-xl px-6 font-medium">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          "Change password"
        )}
      </Button>
    </form>
  );
}
