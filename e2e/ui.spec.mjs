import { test, expect } from "@playwright/test";
import { addTask, createBoard, hasBackend, signUp, uniqueEmail } from "./helpers.mjs";

test.describe("interface", () => {
  test.skip(!hasBackend, "needs NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");

  test("theme toggle switches the whole app and persists", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signUp(page, { name: "Theo Theme", email: uniqueEmail("theme") });
    await expect(page).toHaveURL(/\/boards/);

    const html = page.locator("html");
    const toggle = page.getByRole("switch", { name: /Switch to (dark|light) mode/ }).first();
    const startDark = (await html.getAttribute("class")).includes("dark");
    await toggle.click();
    await expect(html).toHaveClass(startDark ? /light/ : /dark/);

    // Token-based surfaces follow: body background differs between themes.
    await page.reload();
    await expect(html).toHaveClass(startDark ? /light/ : /dark/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(startDark ? "rgb(248, 250, 252)" : "rgb(2, 6, 23)");

    // And back, from the settings page's three-way choice.
    await page.goto("/profile");
    await page.getByRole("button", { name: "Settings & security" }).click();
    await page.getByRole("radio", { name: "System" }).click();
    await expect(page.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    expect(errors).toEqual([]);
  });

  test("Ctrl+K finds a task and opens it", async ({ page }) => {
    await signUp(page, { name: "Cora Command", email: uniqueEmail("palette") });
    await expect(page).toHaveURL(/\/boards/);
    await createBoard(page, "Palette board");
    await addTask(page, "Quarterly zebra report");
    await page.goto("/");

    await page.keyboard.press("Control+k");
    const search = page.getByRole("combobox");
    await search.fill("zebra");
    await expect(page.getByRole("option", { name: /Quarterly zebra report/ })).toBeVisible();
    await search.press("Enter");

    await expect(page).toHaveURL(/task=/);
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Quarterly zebra report" })).toBeVisible();
  });

  test("table view fits a phone screen without page-level horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUp(page, { name: "Mo Bile", email: uniqueEmail("mobile") });
    await expect(page).toHaveURL(/\/boards/);
    await createBoard(page, "Phone board");
    await addTask(page, "Tiny screen task");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Tiny screen task", exact: true })).toBeInViewport();
  });
});
