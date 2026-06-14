// Managed courses directory — all course operations are sandboxed to this root.
// Default: ~/Documents/OELTKit Courses/  Override via OELT_COURSES_DIR env var.

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

const COURSE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;

export function coursesRoot(): string {
  const override = process.env["OELT_COURSES_DIR"];
  const root = override ? resolve(override) : join(homedir(), "Documents", "OELTKit Courses");
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

/** Resolve a course name to an absolute path inside the root. Throws on invalid name. */
export function coursePath(name: string): string {
  if (!COURSE_NAME_RE.test(name)) {
    throw new Error(
      `Invalid course name "${name}" — use letters, numbers, spaces, hyphens, and underscores only`,
    );
  }
  const root = coursesRoot();
  const resolved = resolve(root, name);
  // Redundant safety check: names can't contain separators, but be explicit.
  if (!resolved.startsWith(root + sep) && resolved !== root) {
    throw new Error(`Course name "${name}" would escape the courses root`);
  }
  return resolved;
}

export function courseExists(name: string): boolean {
  try {
    return existsSync(join(coursePath(name), "course.json"));
  } catch {
    return false;
  }
}
