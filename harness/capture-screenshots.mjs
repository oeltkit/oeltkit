#!/usr/bin/env node
// Regenerate the inspector-panel screenshots used in harness/README.md.
//   node harness/capture-screenshots.mjs
// Launches the harness on a scratch port, drives each mode to completion, and
// writes harness/screenshots/<mode>.png. Committed so the README stays current.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PORT = 4178;
const OUT = join(HERE, "screenshots");

const server = spawn(
  "node",
  [join(HERE, "server.mjs"), "examples/minimal", "--port", String(PORT)],
  {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "inherit"],
  },
);
const ready = new Promise((res) => {
  server.stdout.on("data", (d) => {
    if (String(d).includes("open:")) res();
  });
});

try {
  await ready;
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  for (const mode of ["scorm12", "scorm2004", "cmi5", "web"]) {
    await page.goto(`http://localhost:${PORT}/?mode=${mode}`);
    const frame = page.frameLocator("#course-frame");
    await frame.locator("h1").waitFor();
    // Let the completion + terminate lifecycle log a few entries.
    await frame.getByRole("button", { name: "Exit course" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${mode}.png`) });
    console.log(`captured ${mode}.png`);
  }
  await browser.close();
} finally {
  server.kill();
}
