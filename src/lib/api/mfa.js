/**
 * MFA (TOTP) — enrollment, challenge and assurance level.
 *
 * A verified factor makes the database refuse aal1 sessions for this user
 * (RESTRICTIVE policies + mfa_satisfied() in supabase/schema.sql), so the
 * second factor protects the data itself, not just the UI.
 */
import { createClient } from "@/lib/supabase/client";
import { apiError } from "./errors";
import { assert, requireNonEmptyString } from "@/lib/validation";

const CODE_PATTERN = /^\d{6}$/;

function requireCode(code) {
  const clean = typeof code === "string" ? code.replace(/\s+/g, "") : "";
  assert(CODE_PATTERN.test(clean), "Kode harus 6 digit.");
  return clean;
}

function mapMfaError(error, fallback) {
  const code = error?.code || "";
  if (code === "mfa_verification_failed" || /invalid totp/i.test(error?.message || "")) {
    return new Error("Kode salah atau sudah kedaluwarsa.");
  }
  if (code === "mfa_challenge_expired") return new Error("Waktu verifikasi habis. Coba lagi.");
  if (code === "too_many_enrolled_mfa_factors") return new Error("Batas jumlah authenticator tercapai.");
  if (code === "mfa_factor_name_conflict") return new Error("Nama authenticator sudah dipakai.");
  return apiError(error, fallback);
}

export const mfaApi = {
  async assuranceLevel() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw apiError(error, "Gagal memeriksa status MFA.");
    return data;
  },

  async listFactors() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw apiError(error, "Gagal memuat authenticator.");
    return data?.totp || [];
  },

  /**
   * Starts TOTP enrollment. Returns the QR code (SVG data URI) and secret.
   * Leftover unverified factors are removed first so retries do not pile up.
   */
  async enrollTotp(friendlyName) {
    const name = requireNonEmptyString(friendlyName, { field: "Nama authenticator", max: 60 });
    const supabase = createClient();

    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all || []) {
      if (factor.factor_type === "totp" && factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: name });
    if (error) throw mapMfaError(error, "Gagal memulai pendaftaran MFA.");
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  },

  /** Verify a code for a factor — completes enrollment or steps up to aal2. */
  async verify(factorId, code) {
    assert(typeof factorId === "string" && factorId.length > 0, "Authenticator tidak valid.");
    const cleanCode = requireCode(code);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: cleanCode });
    if (error) throw mapMfaError(error, "Verifikasi MFA gagal.");
    return data;
  },

  async unenroll(factorId) {
    assert(typeof factorId === "string" && factorId.length > 0, "Authenticator tidak valid.");
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      if (error.code === "insufficient_aal") {
        throw new Error("Verifikasi kode MFA terlebih dahulu untuk menghapus authenticator.");
      }
      throw mapMfaError(error, "Gagal menghapus authenticator.");
    }
    // Refresh so the session no longer claims factors that are gone.
    await supabase.auth.refreshSession();
  },
};
