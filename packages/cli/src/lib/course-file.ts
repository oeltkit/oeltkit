// .oeltcourse archive format — course-file.md spec implementation.
// Export (dir → zip), import (zip → dir), and a withCourseDir helper that
// transparently handles .oeltcourse paths for validate/package/preview.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";
import type { CourseManifest } from "./course.js";

const MAX_WARN = 50 * 1024 * 1024; // 50 MB
const MAX_HARD = 200 * 1024 * 1024; // 200 MB

export const isOeltCourse = (p: string): boolean => p.endsWith(".oeltcourse");

// §5 — zip-slip safety check.
export function isSafePath(targetDir: string, entryName: string): boolean {
  if (entryName.startsWith("/") || /^[A-Za-z]:[/\\]/.test(entryName)) return false;
  const base = resolve(targetDir);
  const full = resolve(targetDir, entryName);
  return full === base || full.startsWith(base + sep);
}

function walkDir(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walkDir(full, base) : [relative(base, full)];
  });
}

/** `oelt export <dir> [--out file.oeltcourse]` */
export async function exportCourse(courseDir: string, outFile?: string): Promise<string> {
  const dir = resolve(courseDir);
  if (!existsSync(join(dir, "course.json")))
    throw new Error(`No course.json in ${courseDir}`);

  const parentName = dir.split(sep).pop() ?? "course";
  const out = outFile ?? join(dirname(dir), `${parentName}.oeltcourse`);

  const zip = new JSZip();
  for (const rel of walkDir(dir)) zip.file(rel.split("\\").join("/"), readFileSync(join(dir, rel)));

  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  if (bytes.length > MAX_HARD)
    throw new Error(
      `Course is ${(bytes.length / 1024 / 1024).toFixed(0)} MB — exceeds the 200 MB hard limit`,
    );
  if (bytes.length > MAX_WARN)
    console.warn(
      `Warning: ${(bytes.length / 1024 / 1024).toFixed(0)} MB — consider reducing asset sizes`,
    );

  writeFileSync(out, bytes);
  return out;
}

/** `oelt import <file.oeltcourse> <dir>` — §3.1 version check + §5 zip-slip guard. */
export async function importCourse(oeltcoursePath: string, targetDir: string): Promise<void> {
  const bytes = readFileSync(oeltcoursePath);
  const zip = await JSZip.loadAsync(bytes);

  const manifestEntry = zip.file("course.json");
  if (!manifestEntry)
    throw new Error(`${oeltcoursePath}: missing course.json at archive root — not a valid .oeltcourse`);

  const manifest = JSON.parse(await manifestEntry.async("string")) as CourseManifest;
  const majorRequired = parseInt((manifest.oelt ?? "0.0").split(".")[0]!, 10);
  const majorSupported = 0; // bump this when the toolkit supports v1+
  if (majorRequired > majorSupported) {
    throw new Error(
      `This .oeltcourse requires toolkit v${manifest.oelt} or later — please upgrade oelt`,
    );
  }

  const target = resolve(targetDir);

  // Refuse to clobber a non-empty directory.
  if (existsSync(target) && readdirSync(target).length > 0)
    throw new Error(`${targetDir} already exists and is non-empty — choose an empty target`);

  mkdirSync(target, { recursive: true });

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!isSafePath(target, name))
      throw new Error(`Refusing to extract unsafe path "${name}" from ${oeltcoursePath}`);
    const full = join(target, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, await entry.async("nodebuffer"));
  }
}

/**
 * If `input` ends with `.oeltcourse`, extract it to a temp dir, call `fn(tempDir)`,
 * then delete the temp dir. Otherwise delegate directly to `fn(input)`.
 *
 * NOTE: not suitable for long-running commands (preview) — callers that need to
 * keep the temp dir alive should call importCourse directly and manage cleanup.
 */
export async function withCourseDir<T>(
  input: string,
  fn: (dir: string) => T | Promise<T>,
): Promise<T> {
  if (!isOeltCourse(input)) return fn(input);
  const tmp = mkdtempSync(join(tmpdir(), "oelt-import-"));
  try {
    await importCourse(input, tmp);
    return await fn(tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
