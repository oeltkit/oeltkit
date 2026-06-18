#!/usr/bin/env node
// Captures the harness screenshot for the website how-it-works walkthrough.
// Run manually (NOT part of the regen check — PNGs are committed binaries):
//
//   npm run build            # runtime + components bundles the harness serves
//   node scripts/website-export/screenshots.mjs
//
// Drives the walkthrough course in the fake-LMS harness (SCORM 1.2 mode),
// answers the knowledge-check correctly, and screenshots the live tracking
// inspector → docs/website-export/walkthrough/screenshots/harness.png.
//
// The LMS-import screenshot cannot be produced locally (it requires a real LMS
// / SCORM Cloud session); see screenshots/README.md.

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const PORT = 4321;
const outFile = join(repoRoot, "docs/website-export/walkthrough/screenshots/harness.png");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`harness server did not start at ${url}`);
}

const server = spawn(
  "node",
  ["harness/server.mjs", "docs/website-export/walkthrough", "--port", String(PORT)],
  { cwd: repoRoot, stdio: "inherit" },
);

let browser;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto(`http://localhost:${PORT}/?mode=scorm12`);

  const frame = page.frameLocator("#course-frame");
  // Jump to the knowledge-check page and answer it correctly.
  await frame.locator("#c-toc button", { hasText: "Knowledge check" }).click();
  await frame.getByRole("radio", { name: /directly in your browser/ }).check();
  await frame.getByRole("button", { name: "Check answer" }).click();

  // Wait for the host inspector to register the committed interaction.
  await page
    .locator("#inspector")
    .getByText(/interaction|completed|passed/i)
    .first()
    .waitFor({
      timeout: 10_000,
    });
  await sleep(500); // let the panel settle
  await page.screenshot({ path: outFile, fullPage: false });
  console.log(`screenshot → ${outFile}`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
