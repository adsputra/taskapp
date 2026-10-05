import { test, expect } from "@playwright/test";
import { createBoard, freshTotp, hasBackend, logIn, restSelect, signUp, totp, uniqueEmail } from "./helpers.mjs";

test.describe("two-factor authentication", () => {
  test.skip(!hasBackend, "needs NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  test.setTimeout(150_000);

  test("enroll TOTP; sign-in then requires the code and the database enforces it", async ({ page, context }) => {
    const email = uniqueEmail("mfa");
    await signUp(page, { name: "Mia Mfa", email });
    await expect(page).toHaveURL(/\/boards/);
    await createBoard(page, "Secret roadmap");

    // ── Enroll ──
    await page.goto("/profile");
    await page.getByRole("button", { name: "Settings & security" }).click();
    await page.getByRole("button", { name: "Enable" }).click();
    await expect(page.getByAltText("QR code for your authenticator app")).toBeVisible();
    const secret = (await page.locator("code").first().textContent()).trim();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText(/Active since/)).toBeVisible();

    // ── Sign out and back in: password alone is not enough ──
    await page.getByRole("button", { name: "Sign Out" }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await logIn(page, { email });
    await expect(page).toHaveURL(/\/auth\/mfa/);

    // At aal1 the database returns nothing, even for the user's own board.
    const aal1 = await restSelect(context, "boards", "select=id,title");
    expect(aal1.body).toEqual([]);

    // Navigating around does not get past the challenge.
    await page.goto("/boards");
    await expect(page).toHaveURL(/\/auth\/mfa/);

    await page.getByLabel(/Kode dari/).fill("000000");
    await page.getByRole("button", { name: "Verifikasi" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();

    await page.getByLabel(/Kode dari/).fill(await freshTotp(secret));
    await page.getByRole("button", { name: "Verifikasi" }).click();
    await expect(page).toHaveURL(/\/boards/);

    const aal2 = await restSelect(context, "boards", "select=id,title");
    expect(aal2.body.map((b) => b.title)).toContain("Secret roadmap");
  });
});
