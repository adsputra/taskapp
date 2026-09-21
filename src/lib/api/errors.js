/**
 * Converts a Supabase/PostgREST error into a client-safe Error.
 *
 * Raw database error text stays in the browser console; the message
 * shown to the user is either a mapped, known-safe message or the
 * provided generic fallback.
 */
import { logger } from "@/lib/logger";

export function apiError(error, fallback, knownCodes = {}) {
  if (error) {
    logger.error(fallback, {
      code: error.code,
      detail: error.message,
      hint: error.hint,
    });
  }

  const mapped = error?.code ? knownCodes[error.code] : undefined;
  return new Error(mapped || fallback);
}

export function validationError(message) {
  return new Error(message);
}
