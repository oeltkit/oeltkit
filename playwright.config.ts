import { defineConfig, devices } from "@playwright/test";

// Accessibility + keyboard e2e tests. Component demos live in harness/demos/;
// axe-core scans run via @axe-core/playwright. Specs use the `*.spec.ts`
// suffix so vitest ignores them. No components exist yet — this is the
// scaffold so component tasks can add `*.spec.ts` files with zero setup.
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  // The harness itself is the web server under test; it serves examples/minimal.
  webServer: {
    command: "node harness/server.mjs examples/minimal --port 4173",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
