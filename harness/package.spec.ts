// Closes the loop: build a real package with @oeltkit/cli, serve it, and verify
// the generated player boots @oeltkit/runtime and tracks correctly — the
// automated stand-in for the SCORM Cloud import (Task 05 DoD).

import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { buildPackage } from "../packages/cli/src/lib/generators.js";
import { loadCourse } from "../packages/cli/src/lib/course.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".vtt": "text/vtt",
};

let server: Server;
let baseURL: string;

test.beforeAll(async () => {
  // Build the web package of examples/spike and extract it to a temp dir.
  const loaded = loadCourse(join(ROOT, "examples/spike"));
  const bytes = await buildPackage(loaded.dir, loaded.course, "web");
  const zip = await JSZip.loadAsync(bytes);
  const dir = mkdtempSync(join(tmpdir(), "oelt-pkg-"));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const full = join(dir, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, await entry.async("nodebuffer"));
  }

  server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    const file = join(dir, rel === "/" ? "index.html" : rel);
    try {
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  baseURL = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
});

test.afterAll(() => server?.close());

test("packaged web course boots, renders, and tracks completion + score", async ({ page }) => {
  await page.goto(`${baseURL}/index.html`);
  // Player rendered the first page and the runtime is live.
  await expect(page.locator("#oelt-page h1")).toHaveText("Introduction");
  expect(await page.evaluate(() => typeof (window as any).oelt?.track?.interaction)).toBe(
    "function",
  );

  // Advance to the quiz and pass it.
  await page.locator("#oelt-toc").getByText("3. Quiz").click();
  await expect(page.locator("#oelt-page h1")).toHaveText("Quiz");
  await page.getByRole("button", { name: /four targets/ }).click();

  // The standalone (web) backend persisted completion + mastery to localStorage.
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oelt:web:org.oeltkit.spike") ?? "{}"),
  );
  expect(record.completion).toBe("completed");
  expect(record.success).toBe("passed");
  expect(record.score).toBe(1);
});
