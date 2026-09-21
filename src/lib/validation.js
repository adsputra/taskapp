/**
 * Input validation helpers.
 * Pure functions — no framework or Supabase imports, so they are
 * usable from server actions, client API modules, and tests alike.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const BOARD_ROLES = ["admin", "editor", "viewer"];
export const BOARD_VISIBILITIES = ["public", "private", "shared"];
export const SPRINT_STATUSES = ["planning", "active", "completed"];

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value.trim());
}

export function isValidUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function passwordError(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`;
  }
  return null;
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function requireNonEmptyString(value, { field = "Nilai", max = 500 } = {}) {
  assert(typeof value === "string" && value.trim().length > 0, `${field} wajib diisi.`);
  assert(value.trim().length <= max, `${field} maksimal ${max} karakter.`);
  return value.trim();
}

export function requireUuid(value, field = "ID") {
  assert(isValidUuid(value), `${field} tidak valid.`);
  return value;
}

export function requireEnum(value, allowed, field = "Nilai") {
  assert(allowed.includes(value), `${field} tidak valid.`);
  return value;
}

export function requirePlainObject(value, field = "Data") {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${field} tidak valid.`
  );
  return value;
}

export function requireUuidArray(value, { field = "Daftar ID", max = 1000 } = {}) {
  assert(Array.isArray(value) && value.length > 0, `${field} tidak boleh kosong.`);
  assert(value.length <= max, `${field} maksimal ${max} item.`);
  value.forEach((id) => requireUuid(id, field));
  return value;
}

/**
 * Parse a PostgREST-style sort string ("-updated_at" = descending).
 * Only columns present in `allowedFields` are accepted; anything else
 * falls back to the provided default.
 */
export function parseSort(sort, allowedFields, fallback = { field: "updated_at", ascending: false }) {
  if (typeof sort !== "string" || sort.length === 0 || sort.length > 64) return fallback;
  const isDesc = sort.startsWith("-");
  const field = isDesc ? sort.slice(1) : sort;
  if (!allowedFields.includes(field)) return fallback;
  return { field, ascending: !isDesc };
}

/**
 * Clamp a client-supplied limit to a sane server-side range.
 */
export function clampLimit(value, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
  return Math.min(Math.floor(parsed), maxLimit);
}

/**
 * Strip path separators and control characters from a user-supplied
 * filename. The stored object key is generated separately.
 */
export function sanitizeFilename(name) {
  const base = typeof name === "string" ? name : "";
  const cleaned = base
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 180) || "file";
}

export function validateUploadFile(file) {
  if (!file || typeof file.size !== "number" || typeof file.name !== "string") {
    return "File tidak valid.";
  }
  if (file.size === 0) return "File kosong.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Ukuran file maksimal ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`;
  }
  if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return "Tipe file tidak diizinkan.";
  }
  return null;
}
