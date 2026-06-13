/**
 * Attachments API — file upload/download for tasks.
 * Uses Supabase Storage bucket: task-attachments
 */
import { createClient } from "@/lib/supabase/client";

const BUCKET = "task-attachments";

export const attachmentsApi = {
  /**
   * List all attachments for a task.
   */
  async listByItem(itemId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_attachments")
      .select("*, profiles(id, full_name, avatar_url)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to load attachments: " + error.message);
    return data || [];
  },

  /**
   * Upload a file to Supabase Storage and save metadata.
   */
  async upload({ item_id, board_id, file }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Generate unique path: board_id/item_id/timestamp_filename
    const ext = file.name.split(".").pop();
    const path = `${board_id}/${item_id}/${Date.now()}_${file.name}`;

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });

    if (uploadError) throw new Error("Failed to upload file: " + uploadError.message);

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // Save metadata in DB
    const { data, error } = await supabase
      .from("task_attachments")
      .insert({
        item_id,
        user_id: user.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
      })
      .select("*, profiles(id, full_name, avatar_url)")
      .single();

    if (error) throw new Error("Failed to save attachment: " + error.message);
    return data;
  },

  /**
   * Delete an attachment (file + DB record).
   */
  async delete(id) {
    const supabase = createClient();

    // Get the file record first to know the storage path
    const { data: record, error: fetchError } = await supabase
      .from("task_attachments")
      .select("file_url")
      .eq("id", id)
      .single();

    if (fetchError) throw new Error("Failed to find attachment: " + fetchError.message);

    // Extract path from public URL
    const url = new URL(record.file_url);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`);
    const storagePath = pathParts[1];

    // Delete from Storage
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }

    // Delete DB record
    const { error } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", id);

    if (error) throw new Error("Failed to delete attachment: " + error.message);
  },
};
