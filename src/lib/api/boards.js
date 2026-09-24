/**
 * Boards API — semua operasi CRUD untuk boards.
 * Digunakan oleh client components via React Query.
 *
 * v3 — production hardening:
 * - validasi input di boundary (ID, email, role, pagination)
 * - invite token via crypto.randomUUID (bukan Math.random)
 * - lookup/accept invitation lewat RPC SECURITY DEFINER (token tidak
 *   bisa dibaca lewat SELECT langsung)
 * - pesan error client-safe (detail hanya di console)
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import {
  BOARD_ROLES,
  BOARD_VISIBILITIES,
  clampLimit,
  isValidEmail,
  parseSort,
  requireEnum,
  requireNonEmptyString,
  requirePlainObject,
  requireUuid,
  assert,
} from "@/lib/validation";

const BOARD_SELECT = "*";
const BOARD_WITH_MEMBERS = `
  *,
  board_members(*)
`;
const BOARD_SORT_FIELDS = ["updated_at", "created_at", "title"];
const BOARD_UPDATE_FIELDS = ["title", "description", "color", "visibility", "columns", "groups"];

/**
 * Generate token undangan yang kriptografis aman.
 */
function generateInviteToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requireBoardColor(color) {
  assert(
    typeof color === "string" && /^#[0-9a-f]{3,8}$/i.test(color),
    "Warna board tidak valid."
  );
  return color;
}

function buildBoardUpdates(updates) {
  requirePlainObject(updates, "Perubahan board");
  const clean = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!BOARD_UPDATE_FIELDS.includes(key)) continue;

    switch (key) {
      case "title":
        clean.title = requireNonEmptyString(value, { field: "Judul", max: 200 });
        break;
      case "description":
        assert(typeof value === "string" && value.length <= 2000, "Deskripsi maksimal 2000 karakter.");
        clean.description = value;
        break;
      case "color":
        clean.color = requireBoardColor(value);
        break;
      case "visibility":
        clean.visibility = requireEnum(value, BOARD_VISIBILITIES, "Visibility");
        break;
      case "columns":
      case "groups":
        assert(Array.isArray(value) && value.length <= 200, `${key} tidak valid.`);
        clean[key] = value;
        break;
      default:
        break;
    }
  }

  assert(Object.keys(clean).length > 0, "Tidak ada perubahan yang valid.");
  return clean;
}

export const boardsApi = {
  // =============================================
  // LIST — ambil semua board user (owned + shared via RLS)
  // =============================================
  async list({ sort = "-updated_at", limit } = {}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { field, ascending } = parseSort(sort, BOARD_SORT_FIELDS);
    const pageSize = clampLimit(limit, { defaultLimit: 100, maxLimit: 200 });

    const { data, error } = await supabase
      .from("boards")
      .select(BOARD_SELECT)
      .order(field, { ascending })
      .limit(pageSize);

    if (error) throw apiError(error, "Gagal memuat boards.");
    return data || [];
  },

  // =============================================
  // GET — ambil satu board (auto-cek akses via RLS)
  // =============================================
  async get(id) {
    requireUuid(id, "Board ID");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("boards")
      .select(BOARD_WITH_MEMBERS)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw apiError(error, "Gagal memuat board.");
    }
    return data;
  },

  // =============================================
  // CREATE — buat board baru
  // =============================================
  async create({ title, description = "", color = "#0073EA", visibility = "private", columns = [], groups = [] }) {
    const cleanTitle = requireNonEmptyString(title, { field: "Judul", max: 200 });
    requireBoardColor(color);
    requireEnum(visibility, BOARD_VISIBILITIES, "Visibility");
    assert(typeof description === "string" && description.length <= 2000, "Deskripsi maksimal 2000 karakter.");
    assert(Array.isArray(columns) && columns.length <= 200, "Kolom tidak valid.");
    assert(Array.isArray(groups) && groups.length <= 200, "Group tidak valid.");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!session || !user) {
      throw new Error("Sesi login telah kedaluwarsa. Silakan logout dan login kembali.");
    }

    // Pastikan profile user ada di tabel profiles agar foreign key (boards_user_id_fkey) tidak gagal
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar_url: user.user_metadata?.avatar_url || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      ).catch(() => {});
    }

    const { data, error } = await supabase
      .from("boards")
      .insert({
        user_id: user.id,
        title: cleanTitle,
        description,
        color,
        visibility,
        columns,
        groups,
      })
      .select()
      .single();

    if (error) {
      throw apiError(error, "Gagal membuat board.", {
        "23503": "Profil pengguna belum tersimpan di database. Silakan refresh atau perbarui profil Anda.",
        "42501": "Tidak memiliki izin membuat board (aturan RLS database).",
        "23505": "Board dengan data yang sama sudah ada.",
      });
    }
    return data;
  },

  // =============================================
  // UPDATE — update board
  // =============================================
  async update(id, updates) {
    requireUuid(id, "Board ID");
    const clean = buildBoardUpdates(updates);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("boards")
      .update(clean)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new Error("Board tidak ditemukan atau kamu tidak punya akses.");
      }
      throw apiError(error, "Gagal update board.");
    }
    return data;
  },

  // =============================================
  // DELETE — hapus board
  // =============================================
  async delete(id) {
    requireUuid(id, "Board ID");
    const supabase = createClient();
    const { error } = await supabase.from("boards").delete().eq("id", id);
    if (error) throw apiError(error, "Gagal menghapus board.");
  },

  // =============================================
  // SHARE — undang orang ke board via email
  // =============================================
  async share(boardId, { email, role = "editor" }) {
    requireUuid(boardId, "Board ID");
    assert(typeof email === "string" && isValidEmail(email), "Email tidak valid.");
    requireEnum(role, BOARD_ROLES, "Role");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk mengundang member.");

    const token = generateInviteToken();

    const { data, error } = await supabase
      .from("board_members")
      .insert({
        board_id: boardId,
        email: email.toLowerCase().trim(),
        role,
        token,
        status: "pending",
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw apiError(error, "Gagal mengundang member.", {
        23505: "Orang ini sudah diundang ke board ini.",
      });
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return { ...data, shareLink: `${origin}/join?token=${token}` };
  },

  // =============================================
  // GET INVITATION — ambil data undangan via token (RPC)
  // =============================================
  async getInvitation(token) {
    assert(typeof token === "string" && token.length >= 16 && token.length <= 128, "Token undangan tidak valid.");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_board_invitation", { p_token: token });

    if (error) {
      if (error.code === "28000") throw new Error("Harus login untuk membuka undangan.");
      throw apiError(error, "Gagal memuat undangan.");
    }
    return data || null;
  },

  // =============================================
  // ACCEPT INVITE — accept undangan (RPC)
  // =============================================
  async acceptInvite(token) {
    assert(typeof token === "string" && token.length >= 16 && token.length <= 128, "Token undangan tidak valid.");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk menerima undangan.");

    const { data, error } = await supabase.rpc("accept_board_invitation", { p_token: token });

    if (error) {
      if (error.code === "28000") throw new Error("Harus login untuk menerima undangan.");
      throw apiError(error, "Gagal menerima undangan.");
    }
    if (!data) throw new Error("Undangan tidak ditemukan atau sudah kadaluarsa.");

    return { boardId: data.boardId, alreadyAccepted: Boolean(data.alreadyAccepted) };
  },

  // =============================================
  // UNSHARE — hapus member dari board
  // =============================================
  async unshare(boardId, memberId) {
    requireUuid(boardId, "Board ID");
    requireUuid(memberId, "Member ID");
    const supabase = createClient();
    const { error } = await supabase
      .from("board_members")
      .delete()
      .eq("id", memberId)
      .eq("board_id", boardId);

    if (error) throw apiError(error, "Gagal menghapus akses.");
  },

  // =============================================
  // UPDATE MEMBER ROLE — ubah role member
  // =============================================
  async updateMemberRole(boardId, memberId, { role }) {
    requireUuid(boardId, "Board ID");
    requireUuid(memberId, "Member ID");
    requireEnum(role, BOARD_ROLES, "Role");

    const supabase = createClient();

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("user_id")
      .eq("id", boardId)
      .single();

    if (boardError || !board) throw new Error("Board tidak ditemukan atau kamu tidak punya akses.");

    const { data: member, error: memberError } = await supabase
      .from("board_members")
      .select("user_id")
      .eq("id", memberId)
      .single();

    if (memberError || !member) throw new Error("Member tidak ditemukan.");
    if (member.user_id && member.user_id === board.user_id) {
      throw new Error("Tidak bisa mengubah role pemilik board.");
    }

    const { data, error } = await supabase
      .from("board_members")
      .update({ role })
      .eq("id", memberId)
      .eq("board_id", boardId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") throw new Error("Kamu tidak punya izin mengubah role member.");
      throw apiError(error, "Gagal update role.");
    }
    return data;
  },

  // =============================================
  // LIST BOARD MEMBERS — daftar member suatu board
  // =============================================
  async listMembers(boardId, { limit } = {}) {
    requireUuid(boardId, "Board ID");
    const pageSize = clampLimit(limit, { defaultLimit: 200, maxLimit: 500 });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("board_members")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true })
      .limit(pageSize);

    if (error) throw apiError(error, "Gagal memuat member.");
    return data || [];
  },
};
