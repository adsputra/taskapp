"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Buat/verifikasi profile tanpa memanggil getUser() lagi.
 * Menerima user object dari caller untuk menghindari network call ganda.
 */
async function ensureProfileFast(supabase, user) {
  try {
    // Cek apakah profile sudah ada
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) return { ok: true };

    // Buat profile baru
    const fullName =
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User";

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      email: user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
    });

    if (insertError && insertError.code !== "23505") {
      console.error("Insert profile error:", insertError);
      return { error: insertError.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("ensureProfileFast error:", err);
    return { error: "Gagal membuat profile." };
  }
}

/**
 * Login — server action.
 * 1 network call: signInWithPassword
 * 1-2 network calls: ensureProfile (select + optional insert)
 */
export async function login(email, password) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (!data?.user) {
      return { error: "Gagal mendapatkan data user." };
    }

    // Pakai user object dari response — tidak perlu getUser() lagi
    await ensureProfileFast(supabase, data.user);

    return { ok: true };
  } catch (err) {
    console.error("Login error:", err);
    return { error: "Terjadi kesalahan server." };
  }
}

/**
 * Signup — server action.
 */
export async function signup(fullName, email, password) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (!data?.user) {
      return { error: "Gagal membuat akun." };
    }

    if (data?.user?.identities?.length === 0) {
      return { error: "Email ini sudah terdaftar." };
    }

    if (data?.session) {
      await ensureProfileFast(supabase, data.user);
      return { ok: true };
    }

    return { ok: true, emailConfirmationRequired: true };
  } catch (err) {
    console.error("Signup error:", err);
    return { error: "Terjadi kesalahan server." };
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
    console.error("SignOut error:", err);
    return { error: "Gagal sign out." };
  }
}
