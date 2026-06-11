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
  // Retry once: the suite runs many workers against three harness servers, so
  // initial page render can occasionally exceed a single attempt under load.
  retries: 1,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  // Build @oeltkit/runtime first so the harness can serve its bundle.
  globalSetup: "./harness/global-setup.ts",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  // The harness is the server under test. Two instances: minimal (smoke) on
  // 4173, spike (runtime) on 4174. spike.spec.ts uses absolute 4174 URLs.
  webServer: [
    {
      command: "node harness/server.mjs examples/minimal --port 4173",
      url: "http://localhost:4173/",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node harness/server.mjs examples/spike --port 4174",
      url: "http://localhost:4174/",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node harness/server.mjs examples/components-demo --port 4175",
      url: "http://localhost:4175/",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
