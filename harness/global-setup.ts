// Playwright global setup: build @oeltkit/runtime so the harness can serve its
// IIFE bundle at /runtime/oelt.min.js. Keeps the e2e suite self-contained —
// tests always run against the current runtime source.

import { execSync } from "node:child_process";

export default function globalSetup(): void {
  execSync("npm run build -w @oeltkit/runtime -w @oeltkit/components", { stdio: "inherit" });
}
