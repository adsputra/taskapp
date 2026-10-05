import { test, expect } from "@playwright/test";
import { MAILPIT_URL, PASSWORD, hasBackend, linkFromEmail, logIn, signUp, uniqueEmail } from "./helpers.mjs";

test.describe("authentication", () => {
  test.skip(!hasBackend, "needs NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");

  test("sign up, sign out and sign back in", async ({ page }) => {
    const email = uniqueEmail("auth");
    await signUp(page, { name: "Auth Tester", email });
    await expect(page).toHaveURL(/\/boards/);

    await page.getByRole("button", { name: "Sign Out" }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await logIn(page, { email, password: "wrong-password-1" });
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Email atau password salah");

    await logIn(page, { email });
    await expect(page).toHaveURL(/\/boards/);
  });

  test("forgot password sends a working reset link", async ({ page }) => {
    test.skip(!MAILPIT_URL, "needs E2E_MAILPIT_URL to read the email");
    const email = uniqueEmail("reset");
    await signUp(page, { name: "Reset Tester", email });
    await expect(page).toHaveURL(/\/boards/);
    await page.getByRole("button", { name: "Sign Out" }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.getByRole("link", { name: "Lupa password?" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Kirim link reset" }).click();
    await expect(page.getByRole("status").filter({ hasText: "link reset sudah dikirim" })).toBeVisible();

    await page.goto(await linkFromEmail(email, "/auth/v1/verify"));
    await expect(page).toHaveURL(/\/auth\/reset-password/);

    const newPassword = `${PASSWORD}-new`;
    await page.getByLabel("Password baru", { exact: true }).fill(newPassword);
    await page.getByLabel("Ulangi password baru").fill(newPassword);
    await page.getByRole("button", { name: "Simpan password" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?reset=1/);
    await expect(page.getByRole("status").filter({ hasText: "Password berhasil diubah" })).toBeVisible();

    await logIn(page, { email, password: PASSWORD });
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
    await logIn(page, { email, password: newPassword });
    await expect(page).toHaveURL(/\/boards/);
  });

  test("social sign-in buttons appear only for configured providers", async ({ page }) => {
    await page.goto("/auth/login");
    const configured = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS || "").split(",").filter(Boolean);
    await expect(page.getByRole("button", { name: "GitHub" })).toHaveCount(configured.includes("github") ? 1 : 0);
    await expect(page.getByRole("button", { name: "Google" })).toHaveCount(configured.includes("google") ? 1 : 0);
  });
});
