/**
 * Boards API — semua operasi CRUD untuk boards.
 * Digunakan oleh client components via React Query.
 *
 * v2 — menambahkan sharing, listMyBoards, acceptInvite, dll.
 */
import { createClient } from "@/lib/supabase/client";

const BOARD_SELECT = "*";
const BOARD_WITH_MEMBERS = `
  *,
  board_members(*)
`;

/**
 * Generate token acak untuk undangan.
 */
function generateToken() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export const boardsApi = {
  // =============================================
  // LIST — ambil SEMUA board user (owned + shared)
  // RLS handles filtering automatically via policies
  // =============================================
  async listMyBoards({ sort = "-updated_at", limit } = {}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const isDesc = sort.startsWith("-");
    const field = isDesc ? sort.slice(1) : sort;

    // Cukup select all — RLS akan auto-filter:
    // 1. Boards where user_id = auth.uid() (owner)
    // 2. Boards where user exists in board_members with status='active' (member)
    let query = supabase
      .from("boards")
      .select(BOARD_SELECT)
      .order(field, { ascending: !isDesc });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error("Gagal memuat boards: " + error.message);
    return data || [];
  },

  // =============================================
  // LIST — hanya board milik sendiri (deprecated, use listMyBoards)
  // =============================================
  async list({ sort = "-updated_at", limit } = {}) {
    const supabase = createClient();
    const isDesc = sort.startsWith("-");
    const field = isDesc ? sort.slice(1) : sort;

    let query = supabase.from("boards").select(BOARD_SELECT).order(field, { ascending: !isDesc });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error("Gagal memuat boards: " + error.message);
    return data || [];
  },

  // =============================================
  // GET — ambil satu board (auto-cek akses via RLS)
  // =============================================
  async get(id) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("boards")
      .select(BOARD_WITH_MEMBERS)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error("Gagal memuat board: " + error.message);
    }
    return data;
  },

  // =============================================
  // CREATE — buat board baru
  // =============================================
  async create({ title, description = "", color = "#0073EA", visibility = "private", columns = [], groups = [] }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk membuat board.");

    const { data, error } = await supabase
      .from("boards")
      .insert({
        user_id: user.id,
        title,
        description,
        color,
        visibility,
        columns,
        groups,
      })
      .select()
      .single();

    if (error) throw new Error("Gagal membuat board: " + error.message);
    return data;
  },

  // =============================================
  // UPDATE — update board
  // =============================================
  async update(id, updates) {
    const supabase = createClient();
    const clean = { ...updates };
    delete clean.id;
    delete clean.user_id;
    delete clean.created_at;

    const { data, error } = await supabase
      .from("boards")
      .update(clean)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error("Gagal update board: " + error.message);
    return data;
  },

  // =============================================
  // DELETE — hapus board
  // =============================================
  async delete(id) {
    const supabase = createClient();
    const { error } = await supabase.from("boards").delete().eq("id", id);
    if (error) throw new Error("Gagal menghapus board: " + error.message);
  },

  // =============================================
  // SHARE — undang orang ke board via email
  // =============================================
  async share(boardId, { email, role = "editor" }) {
    const supabase = createClient();
    const token = generateToken();

    const { data, error } = await supabase
      .from("board_members")
      .insert({
        board_id: boardId,
        email: email.toLowerCase().trim(),
        role,
        token,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Orang ini sudah diundang ke board ini.");
      throw new Error("Gagal mengundang: " + error.message);
    }

    // Generate share link
    const origin = window.location.origin;
    const shareLink = `${origin}/join?token=${token}`;

    return { ...data, shareLink };
  },

  // =============================================
  // GET INVITATION — ambil data undangan via token
  // =============================================
  async getInvitation(token) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_members")
      .select("*, board:board_id(title, color)")
      .eq("token", token)
      .single();

    if (error || !data) return null;
    return data;
  },

  // =============================================
  // ACCEPT INVITE — accept undangan
  // =============================================
  async acceptInvite(token) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk menerima undangan.");

    // Cek undangan
    const { data: invite, error: findError } = await supabase
      .from("board_members")
      .select("*")
      .eq("token", token)
      .single();

    if (findError || !invite) throw new Error("Undangan tidak ditemukan.");
    if (invite.status === "active") return { boardId: invite.board_id, alreadyAccepted: true };

    // Update status jadi active
    const { error: updateError } = await supabase
      .from("board_members")
      .update({
        user_id: user.id,
        status: "active",
        email: user.email || invite.email, // bisa update email kalau beda
      })
      .eq("id", invite.id);

    if (updateError) throw new Error("Gagal menerima undangan.");

    // Add notification
    try {
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Joined board",
        message: `You now have access to a shared board`,
        type: "share_accepted",
      });
    } catch (_) { /* optional */ }

    return { boardId: invite.board_id, alreadyAccepted: false };
  },

  // =============================================
  // UNSHARE — hapus member dari board
  // =============================================
  async unshare(boardId, memberId) {
    const supabase = createClient();
    const { error } = await supabase
      .from("board_members")
      .delete()
      .eq("id", memberId)
      .eq("board_id", boardId);

    if (error) throw new Error("Gagal menghapus akses: " + error.message);
  },

  // =============================================
  // LIST BOARD MEMBERS — daftar member suatu board
  // =============================================
  async listMembers(boardId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_members")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true });

    if (error) throw new Error("Gagal memuat member: " + error.message);
    return data || [];
  },
};
