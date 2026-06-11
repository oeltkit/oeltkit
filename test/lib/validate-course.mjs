// Shared course-manifest schema validation, used by both the vitest suite and
// the `validate:examples` CLI script. This validates ONLY against the JSON
// Schema (`specs/schema/course.schema.json`). The cross-field validator rules
// described in specs/manifest-v0.md §7 (id uniqueness, declaration↔HTML sync,
// reachability, suspend budget) are the job of `oelt validate`, built later.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = resolve(here, "../../specs/schema/course.schema.json");

let cachedValidator;

/** Compile (once) and return the course.json schema validator. */
export function getValidator() {
  if (cachedValidator) return cachedValidator;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  // strictRequired is disabled because the schema uses if/then conditional
  // `required` that references properties declared on the parent (e.g.
  // `threshold` on completionRule) — a legitimate pattern Ajv flags otherwise.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  cachedValidator = ajv.compile(schema);
  return cachedValidator;
}

/**
 * Validate a parsed course manifest object.
 * @returns {{ valid: boolean, errors: import("ajv").ErrorObject[] }}
 */
export function validateCourse(course) {
  const validate = getValidator();
  const valid = validate(course);
  return { valid, errors: valid ? [] : (validate.errors ?? []) };
}

/** Validate a course.json file on disk. */
export function validateCourseFile(path) {
  const course = JSON.parse(readFileSync(path, "utf8"));
  return validateCourse(course);
}
