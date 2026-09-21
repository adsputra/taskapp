"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";
import { getClientIp, authRateLimiter, authAccountRateLimiter } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-context";
import {
  isValidEmail,
  passwordError,
  requireNonEmptyString,
} from "@/lib/validation";

const RATE_LIMIT_MESSAGE = "Terlalu banyak percobaan. Coba lagi sebentar lagi.";

/**
 * Batasi percobaan login/signup per IP dan per akun.
 * Memakai Upstash Redis bila dikonfigurasi, fallback in-memory bila tidak.
 */
async function enforceAuthRateLimit(scope, accountKey) {
  const headerStore = await headers();
  const requestId = headerStore.get("x-request-id") || undefined;
  const ip = getClientIp(headerStore);

  const ipResult = await authRateLimiter.check(`${scope}:ip:${ip}`);
  if (!ipResult.allowed) {
    incrementCounter("taskapp_rate_limit_blocked_total", { scope: `${scope}_ip` });
    logger.warn("auth rate limit (ip)", { requestId, scope });
    return RATE_LIMIT_MESSAGE;
  }

  const accountResult = await authAccountRateLimiter.check(`${scope}:account:${accountKey}`);
  if (!accountResult.allowed) {
    incrementCounter("taskapp_rate_limit_blocked_total", { scope: `${scope}_account` });
    logger.warn("auth rate limit (account)", { requestId, scope });
    return RATE_LIMIT_MESSAGE;
  }

  return null;
}

/**
 * Login — server action.
 */
export async function login(email, password) {
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  try {
    if (!isValidEmail(cleanEmail)) return { error: "Email tidak valid." };
    if (typeof password !== "string" || password.length === 0) {
      return { error: "Password wajib diisi." };
    }

    const rateLimitError = await enforceAuthRateLimit("login", cleanEmail);
    if (rateLimitError) return { error: rateLimitError };

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      // Generic message: jangan bocorkan apakah email terdaftar.
      incrementCounter("taskapp_auth_login_total", { result: "rejected" });
      logger.warn("login rejected", { requestId: await getRequestId(), code: error.code });
      return { error: "Email atau password salah." };
    }

    if (!data?.user) {
      return { error: "Gagal mendapatkan data user." };
    }

    incrementCounter("taskapp_auth_login_total", { result: "ok" });
    return { ok: true };
  } catch (err) {
    incrementCounter("taskapp_auth_login_total", { result: "error" });
    logger.error("login failed", { requestId: await getRequestId(), detail: err?.message });
    return { error: "Terjadi kesalahan server." };
  }
}

/**
 * Signup — server action.
 */
export async function signup(fullName, email, password) {
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  try {
    const cleanName = requireNonEmptyString(fullName, { field: "Nama", max: 100 });
    if (!isValidEmail(cleanEmail)) return { error: "Email tidak valid." };
    const passwordIssue = passwordError(password);
    if (passwordIssue) return { error: passwordIssue };

    const rateLimitError = await enforceAuthRateLimit("signup", cleanEmail);
    if (rateLimitError) return { error: rateLimitError };

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: cleanName },
      },
    });

    if (error) {
      incrementCounter("taskapp_auth_signup_total", { result: "rejected" });
      logger.warn("signup rejected", {
        requestId: await getRequestId(),
        code: error.code,
        status: error.status,
      });
      if (error.status === 429 || error.code?.includes("rate_limit")) {
        return { error: RATE_LIMIT_MESSAGE };
      }
      return { error: "Gagal membuat akun. Coba lagi." };
    }

    if (!data?.user) {
      return { error: "Gagal membuat akun." };
    }

    if (data?.user?.identities?.length === 0) {
      incrementCounter("taskapp_auth_signup_total", { result: "duplicate" });
      return { error: "Email ini sudah terdaftar." };
    }

    incrementCounter("taskapp_auth_signup_total", { result: "ok" });

    if (data?.session) {
      return { ok: true };
    }

    return { ok: true, emailConfirmationRequired: true };
  } catch (err) {
    incrementCounter("taskapp_auth_signup_total", { result: "error" });
    logger.error("signup failed", { requestId: await getRequestId(), detail: err?.message });
    return { error: err?.message || "Terjadi kesalahan server." };
  }
}

/**
 * Sign out — server action.
 */
export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { ok: true };
  } catch (err) {
    logger.error("signOut failed", { requestId: await getRequestId(), detail: err?.message });
    return { error: "Gagal sign out." };
  }
}
