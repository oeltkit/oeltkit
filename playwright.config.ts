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
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
