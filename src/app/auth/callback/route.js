import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent("Kode verifikasi tidak ditemukan.")}`
    );
  }

  try {
    const supabase = await createClient();

    // Tukar code dengan session
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Exchange error:", exchangeError);
      return NextResponse.redirect(
        `${origin}/auth/login?error=auth_callback_error`
      );
    }

    // Ambil user dari session yang baru
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Buat profile jika belum ada
      const fullName =
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "User";

      // Cek dulu — hindari insert kalau sudah ada
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("profiles").insert({
          id: user.id,
          full_name: fullName,
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url || null,
        });
      }
    }

    // Redirect
    const redirectUrl = new URL(next, origin);
    if (redirectUrl.origin !== origin) {
      return NextResponse.redirect(`${origin}/`);
    }

    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Callback error:", err);
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent("Terjadi kesalahan server.")}`
    );
  }
}
