import { test, expect } from "@playwright/test";
import { PASSWORD, hasBackend, logIn, signUp, uniqueEmail } from "./helpers.mjs";

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

  test("change password in settings requires the current password", async ({ page }) => {
    const email = uniqueEmail("pw");
    await signUp(page, { name: "Pat Password", email });
    await expect(page).toHaveURL(/\/boards/);

    await page.goto("/profile");
    await page.getByRole("button", { name: "Settings & security" }).click();
    const newPassword = `${PASSWORD}-new`;

    await page.getByLabel("Current password", { exact: true }).fill("not-my-password");
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password saat ini salah.")).toBeVisible();

    await page.getByLabel("Current password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();

    await page.getByRole("button", { name: "Sign Out" }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
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
