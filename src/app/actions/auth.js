"use server";

import { createClient } from "@/lib/supabase/server";


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
