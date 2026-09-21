/**
 * Attachments API — file upload/download for tasks.
 * Uses the PRIVATE Supabase Storage bucket: task-attachments
 *
 * v3 — private bucket:
 * - `file_url` stores the storage object key for new uploads
 *   (legacy rows may still contain a public URL; both are handled).
 * - Reads return a short-lived signed URL in `file_url` so the UI can
 *   render/preview without ever exposing a permanent public link.
 * - Access is enforced by Storage RLS (see migration 008).
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import {
  clampLimit,
  requireUuid,
  sanitizeFilename,
  validateUploadFile,
} from "@/lib/validation";

const BUCKET = "task-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const STORAGE_URL_PATTERN = new RegExp(
  `/storage/v1/object/(?:public|sign)/${BUCKET}/(.+)$`
);

function generateObjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Accepts either a storage object key (new rows) or a legacy public URL,
 * and returns the object key.
 */
export function resolveStoragePath(fileUrlOrPath) {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== "string") return null;

  if (!/^https?:\/\//i.test(fileUrlOrPath)) {
    return fileUrlOrPath;
  }

  try {
    const { pathname } = new URL(fileUrlOrPath);
    const match = pathname.match(STORAGE_URL_PATTERN);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function signPaths(supabase, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return new Map();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);

  if (error) throw apiError(error, "Failed to sign attachment URLs.");

  const signedByPath = new Map();
  for (const entry of data || []) {
    if (entry?.path && entry?.signedUrl) {
      signedByPath.set(entry.path, entry.signedUrl);
    }
  }
  return signedByPath;
}

async function withSignedUrls(supabase, rows) {
  const paths = rows.map((row) => resolveStoragePath(row.file_url));
  const signedByPath = await signPaths(supabase, paths);

  return rows.map((row, index) => ({
    ...row,
    file_url: paths[index] ? signedByPath.get(paths[index]) || null : null,
  }));
}

export const attachmentsApi = {
  /**
   * List all attachments for a task, with fresh signed URLs.
   */
  async listByItem(itemId, { limit } = {}) {
    requireUuid(itemId, "Item ID");
    const pageSize = clampLimit(limit, { defaultLimit: 200, maxLimit: 500 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_attachments")
      .select("id, item_id, user_id, file_name, file_url, file_size, file_type, created_at, profiles(id, full_name, avatar_url)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (error) throw apiError(error, "Failed to load attachments.");
    return withSignedUrls(supabase, data || []);
  },

  /**
   * Upload a file to Supabase Storage and save metadata.
   */
  async upload({ item_id, board_id, file }) {
    requireUuid(item_id, "Item ID");
    requireUuid(board_id, "Board ID");

    const fileError = validateUploadFile(file);
    if (fileError) throw new Error(fileError);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk mengunggah file.");

    const safeName = sanitizeFilename(file.name);
    // Key is generated here — never trust a client-supplied path.
    const path = `${board_id}/${item_id}/${generateObjectId()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });

    if (uploadError) throw apiError(uploadError, "Failed to upload file.");

    const { data, error } = await supabase
      .from("task_attachments")
      .insert({
        item_id,
        user_id: user.id,
        file_name: safeName,
        file_url: path,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
      })
      .select("*, profiles(id, full_name, avatar_url)")
      .single();

    if (error) throw apiError(error, "Failed to save attachment.");

    const [signed] = await withSignedUrls(supabase, [data]);
    return signed;
  },

  /**
   * Delete an attachment (file + DB record).
   */
  async delete(id) {
    requireUuid(id, "Attachment ID");
    const supabase = createClient();

    const { data: record, error: fetchError } = await supabase
      .from("task_attachments")
      .select("file_url")
      .eq("id", id)
      .single();

    if (fetchError) throw apiError(fetchError, "Failed to find attachment.");

    const storagePath = resolveStoragePath(record.file_url);
    if (storagePath) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([storagePath]);
      if (removeError) throw apiError(removeError, "Failed to delete file.");
    }

    const { error } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", id);

    if (error) throw apiError(error, "Failed to delete attachment.");
  },
};
