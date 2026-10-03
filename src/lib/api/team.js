/**
 * Team API — operations for workspace / team collaboration.
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { assert, requireUuid, isValidEmail } from "@/lib/validation";

const TEAM_ROLES = ["admin", "member"];

export const teamApi = {
  // =============================================
  // GET MY TEAM ROLE — ambil role user di tim saat ini
  // =============================================
  async getMyRole() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: "owner", isOwner: true, ownerId: null };

    const { data, error } = await supabase.rpc("get_user_team_role");
    if (error) throw apiError(error, "Gagal memuat role tim.");
    return data || { role: "owner", isOwner: true, ownerId: user.id };
  },

  // =============================================
  // LIST MEMBERS — daftar semua anggota tim
  // =============================================
  async listMembers() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { owner: null, members: [] };

    const { data, error } = await supabase.rpc("list_team_members");
    if (error) throw apiError(error, "Gagal memuat anggota tim.");
    return data || { owner: null, members: [] };
  },

  // =============================================
  // INVITE MEMBER — undang anggota baru ke tim
  // =============================================
  async invite({ email, role = "member" }) {
    assert(typeof email === "string" && isValidEmail(email), "Email tidak valid.");
    assert(TEAM_ROLES.includes(role), "Role tidak valid.");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk mengundang anggota tim.");

    const { data, error } = await supabase.rpc("invite_team_member", {
      p_email: email.toLowerCase().trim(),
      p_role: role,
    });

    if (error) {
      throw apiError(error, "Gagal mengundang anggota tim.");
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareLink = `${origin}/join?team=${data.token}`;

    return { ...data, shareLink };
  },

  // =============================================
  // UPDATE ROLE — ubah role anggota (Admin / Member)
  // =============================================
  async updateRole(memberId, role) {
    requireUuid(memberId, "Member ID");
    assert(TEAM_ROLES.includes(role), "Role tidak valid.");

    const supabase = createClient();
    const { error } = await supabase.rpc("update_team_member_role", {
      p_member_id: memberId,
      p_role: role,
    });

    if (error) throw apiError(error, "Gagal mengubah role anggota tim.");
    return true;
  },

  // =============================================
  // REMOVE MEMBER — kick / hapus anggota dari tim
  // =============================================
  async removeMember(memberId) {
    requireUuid(memberId, "Member ID");

    const supabase = createClient();
    const { error } = await supabase.rpc("remove_team_member", {
      p_member_id: memberId,
    });

    if (error) throw apiError(error, "Gagal menghapus anggota tim.");
    return true;
  },

  // =============================================
  // GET INVITATION — ambil info undangan tim via token
  // =============================================
  async getInvitation(token) {
    assert(typeof token === "string" && token.length >= 16 && token.length <= 128, "Token undangan tim tidak valid.");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_team_invitation", { p_token: token });

    if (error) throw apiError(error, "Gagal memuat undangan tim.");
    return data || null;
  },

  // =============================================
  // ACCEPT INVITATION — terima undangan tim
  // =============================================
  async acceptInvite(token) {
    assert(typeof token === "string" && token.length >= 16 && token.length <= 128, "Token undangan tim tidak valid.");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Harus login untuk menerima undangan tim.");

    const { data, error } = await supabase.rpc("accept_team_invitation", { p_token: token });
    if (error) throw apiError(error, "Gagal menerima undangan tim.");
    return data;
  },
};
