// Validates manifest-v0 §9: web-target packages must run under file:// with no
// server. Builds each example course, extracts the zip, and loads index.html
// via a file:// URL — asserts render and, for scored courses, tracking.

import { test, expect } from "@playwright/test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { buildPackage } from "../packages/cli/src/lib/generators.js";
import { loadCourse } from "../packages/cli/src/lib/course.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function buildWebPackage(example: string): Promise<string> {
  const loaded = loadCourse(join(ROOT, "examples", example));
  const bytes = await buildPackage(loaded.dir, loaded.course, "web");
  const zip = await JSZip.loadAsync(bytes);
  const dir = mkdtempSync(join(tmpdir(), `oelt-file-${example}-`));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const full = join(dir, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, await entry.async("nodebuffer"));
  }
  return dir;
}

// Build all three example web packages once before tests run.
let dirs: Record<string, string> = {};
test.beforeAll(async () => {
  const [minimal, spike, demo] = await Promise.all([
    buildWebPackage("minimal"),
    buildWebPackage("spike"),
    buildWebPackage("components-demo"),
  ]);
  dirs = { minimal, spike, demo: demo! };
});

test("minimal: first page renders under file://", async ({ page }) => {
  await page.goto(`file://${join(dirs.minimal!, "index.html")}`);
  await expect(page.locator("#oelt-page")).toBeVisible();
  // minimal has one page with <h1>Welcome</h1>
  await expect(page.locator("#oelt-page h1")).toHaveText("Welcome");
});

test("spike: first page renders and web adapter records completion under file://", async ({
  page,
}) => {
  await page.goto(`file://${join(dirs.spike!, "index.html")}`);
  await expect(page.locator("#oelt-page h1")).toHaveText("Introduction");

  // Navigate to quiz page and pass it (same flow as package.spec.ts).
  await page.locator("#oelt-toc").getByText("3. Quiz").click();
  await expect(page.locator("#oelt-page h1")).toHaveText("Quiz");
  await page.getByRole("button", { name: /four targets/ }).click();

  // Web adapter writes to localStorage — verify completion and pass.
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oelt:web:org.oeltkit.spike") ?? "{}"),
  );
  expect(record.completion).toBe("completed");
  expect(record.success).toBe("passed");
});

test("components-demo: first page renders under file://", async ({ page }) => {
  await page.goto(`file://${join(dirs.demo!, "index.html")}`);
  await expect(page.locator("#oelt-page")).toBeVisible();
  await expect(page.locator("#oelt-page h1")).toHaveText("Multiple choice");
});
