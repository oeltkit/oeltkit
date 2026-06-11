#!/usr/bin/env node
// `npm run validate:examples` — validates every example course's manifest
// against the JSON Schema. Stand-in for `oelt validate` until the CLI lands;
// see specs/manifest-v0.md §7 for the full (schema + validator) contract.

import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { validateCourseFile } from "./lib/validate-course.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(here, "../examples");

const courses = readdirSync(examplesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => join(examplesDir, e.name, "course.json"))
  .filter((p) => existsSync(p));

if (courses.length === 0) {
  console.error("No example courses found under examples/*/course.json");
  process.exit(1);
}

let failures = 0;
for (const path of courses) {
  const rel = path.slice(resolve(here, "..").length + 1);
  const { valid, errors } = validateCourseFile(path);
  if (valid) {
    console.log(`  ✓ ${rel}`);
  } else {
    failures++;
    console.error(`  ✗ ${rel}`);
    for (const err of errors) {
      console.error(`      ${err.instancePath || "/"} ${err.message}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} example course(s) failed schema validation.`);
  process.exit(1);
}
console.log(`\n${courses.length} example course(s) valid.`);
