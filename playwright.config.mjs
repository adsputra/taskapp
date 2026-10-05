import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (e2e/). They need a running Supabase with
 * supabase/schema.sql applied — locally: `npx supabase start` — and the
 * app built against it. See README → Testing.
 *
 * E2E_BASE_URL points at an already running app; otherwise `next start`
 * is launched on port 3100 (run `npm run build` first).
 */
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/auth/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
