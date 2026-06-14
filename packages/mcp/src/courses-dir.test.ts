// The managed courses directory must constrain all access to its root: no path
// traversal, no absolute escapes. These are pure unit tests (no server needed).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coursePath, coursesRoot, courseExists } from "./courses-dir.js";

let root: string;
const original = process.env["OELT_COURSES_DIR"];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oelt-cd-"));
  process.env["OELT_COURSES_DIR"] = root;
});

afterEach(() => {
  if (original === undefined) delete process.env["OELT_COURSES_DIR"];
  else process.env["OELT_COURSES_DIR"] = original;
  rmSync(root, { recursive: true, force: true });
});

describe("coursesRoot", () => {
  it("uses OELT_COURSES_DIR when set and creates it", () => {
    expect(coursesRoot()).toBe(root);
  });
});

describe("coursePath sandboxing", () => {
  it("resolves a valid name inside the root", () => {
    expect(coursePath("my-course")).toBe(join(root, "my-course"));
    expect(coursePath("Course 1")).toBe(join(root, "Course 1"));
  });

  it("rejects path-traversal names", () => {
    expect(() => coursePath("../escape")).toThrow(/Invalid course name/);
    expect(() => coursePath("../../etc/passwd")).toThrow(/Invalid course name/);
  });

  it("rejects names with slashes", () => {
    expect(() => coursePath("a/b")).toThrow(/Invalid course name/);
    expect(() => coursePath("/absolute")).toThrow(/Invalid course name/);
  });

  it("rejects names starting with a dot or special chars", () => {
    expect(() => coursePath(".hidden")).toThrow(/Invalid course name/);
    expect(() => coursePath("name;rm -rf")).toThrow(/Invalid course name/);
  });
});

describe("courseExists", () => {
  it("returns false for a non-existent course (and never throws on bad names)", () => {
    expect(courseExists("nope")).toBe(false);
    expect(courseExists("../bad")).toBe(false);
  });
});
