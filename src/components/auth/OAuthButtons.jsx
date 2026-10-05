"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/*
 * Social sign-in. Each provider must be enabled in Supabase (Auth →
 * Providers) — list the enabled ones in NEXT_PUBLIC_AUTH_PROVIDERS, e.g.
 * "google,github". Unlisted providers are not shown.
 */
const PROVIDERS = {
  google: {
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
    ),
  },
  github: {
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
      </svg>
    ),
  },
};

export function enabledProviders() {
  return (process.env.NEXT_PUBLIC_AUTH_PROVIDERS || "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => PROVIDERS[p]);
}

export default function OAuthButtons({ redirectTo = "/boards", onError }) {
  const [pending, setPending] = useState(null);
  const providers = enabledProviders();
  if (providers.length === 0) return null;

  const signIn = async (provider) => {
    setPending(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setPending(null);
      onError?.("Tidak dapat terhubung ke penyedia login. Coba lagi.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
        {providers.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => signIn(id)}
            disabled={pending !== null}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-input bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {pending === id ? <Loader2 className="h-5 w-5 animate-spin" /> : PROVIDERS[id].icon}
            {PROVIDERS[id].label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-subtle-foreground">
        <span className="h-px flex-1 bg-border" />
        atau dengan email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
