/**
 * Converts a Supabase/PostgREST error into a client-safe Error.
 *
 * Raw database error text stays in the browser console; the message
 * shown to the user is either a mapped, known-safe message or the
 * provided generic fallback.
 */
import { logger } from "@/lib/logger";

const DEFAULT_ERROR_MAPPINGS = {
  "23503": "Profil pengguna belum tersimpan di database. Silakan coba lagi.",
  "42501": "Akses ditolak oleh database (kebijakan RLS). Pastikan Anda memiliki izin.",
  "23505": "Data duplikat telah ditemukan.",
  "23502": "Terdapat data wajib yang belum diisi.",
  "PGRST116": "Data yang diminta tidak ditemukan.",
  "PGRST301": "Sesi login kedaluwarsa. Silakan refresh atau login ulang.",
};

export function apiError(error, fallback, knownCodes = {}) {
  if (error) {
    logger.error(fallback, {
      code: error.code,
      detail: error.message,
      hint: error.hint,
    });
  }

  const mapped =
    (error?.code && knownCodes[error.code]) ||
    (error?.code && DEFAULT_ERROR_MAPPINGS[error.code]);

  if (mapped) return new Error(mapped);
  if (error?.message) return new Error(`${fallback} (${error.message})`);
  return new Error(fallback);
}

export function validationError(message) {
  return new Error(message);
}
