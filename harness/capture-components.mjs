#!/usr/bin/env node
// Capture harness/screenshots/components-mcq.png — the inspector panel after an
// <oelt-mcq> answer is tracked in SCORM 1.2 mode. Run: node harness/capture-components.mjs
// (requires @oeltkit/runtime + @oeltkit/components built).

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PORT = 4179;
const OUT = join(HERE, "screenshots");

const server = spawn(
  "node",
  [join(HERE, "server.mjs"), "examples/components-demo", "--port", String(PORT)],
  {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "inherit"],
  },
);
const ready = new Promise((res) =>
  server.stdout.on("data", (d) => String(d).includes("open:") && res()),
);

try {
  await ready;
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await fetch(`http://localhost:${PORT}/api/state?mode=scorm12`, { method: "DELETE" }); // fresh
  await page.goto(`http://localhost:${PORT}/?mode=scorm12`);
  const frame = page.frameLocator("#course-frame");
  await frame.locator("h1").waitFor();
  await frame.getByRole("radio", { name: /four targets/ }).check();
  await frame.getByRole("button", { name: "Check answer" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "components-mcq.png") });
  console.log("captured components-mcq.png");
  await browser.close();
} finally {
  server.kill();
}
