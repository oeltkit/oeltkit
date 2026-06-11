import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests use `*.test.ts`. Playwright/axe e2e specs use `*.spec.ts`
    // and run under the Playwright runner (`npm run test:a11y`), not vitest.
    include: ["test/**/*.test.ts", "packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.spec.ts"],
  },
});
