import { test, expect } from "@playwright/test";
import { hasBackend } from "./helpers.mjs";

test.describe("security headers and routing", () => {
  test.skip(!hasBackend, "needs NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");

  test("pages get a per-request nonce CSP and every script carries it", async ({ page }) => {
    const violations = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to (execute|load)/i.test(msg.text())) violations.push(msg.text());
    });

    const first = await page.goto("/auth/login");
    const csp = first.headers()["content-security-policy"];
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp.split(";").find((d) => d.trim().startsWith("script-src"))).not.toContain("unsafe-inline");
    expect(csp).toContain("frame-ancestors 'none'");

    const nonce = csp.match(/'nonce-([^']+)'/)[1];
    const scriptNonces = await page.locator("script").evaluateAll((els) => els.map((el) => el.nonce));
    expect(scriptNonces.length).toBeGreaterThan(0);
    expect(scriptNonces.every((n) => n === nonce)).toBe(true);

    // next-themes' inline script ran (it needs the nonce): <html> has a theme class.
    await expect(page.locator("html")).toHaveClass(/(light|dark)/);

    const second = await page.goto("/auth/login");
    expect(second.headers()["content-security-policy"]).not.toContain(nonce);
    expect(violations).toEqual([]);
  });

  test("private pages, including the dashboard, require a session", async ({ page }) => {
    for (const path of ["/", "/boards", "/profile", "/auth/reset-password", "/auth/mfa"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login\?redirect=/);
    }
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/auth/login");
    const headers = res.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-request-id"]).toBeTruthy();
  });
});
