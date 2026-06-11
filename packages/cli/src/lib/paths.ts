// Locating repo assets the CLI needs (the JSON Schema and the built runtime /
// component bundles). v0 runs inside the monorepo, so we walk up from the CLI's
// own location to the repo root. (When the CLI is published these become
// package dependencies; tracked for Phase 1.)

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Walk up from `start` until `rel` exists; throw if not found. */
export function findUp(rel: string, start: string = HERE): string {
  let dir = start;
  for (;;) {
    const candidate = join(dir, rel);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not locate ${rel} (searched up from ${start})`);
    dir = parent;
  }
}

// schema lives at <root>/specs/schema/course.schema.json — three levels down.
export const repoRoot = (): string =>
  resolve(findUp("specs/schema/course.schema.json"), "../../..");
export const schemaPath = (): string => findUp("specs/schema/course.schema.json");
export const runtimeBundle = (): string => resolve(repoRoot(), "packages/runtime/dist/oelt.min.js");
export const componentsBundle = (): string =>
  resolve(repoRoot(), "packages/components/dist/oelt.min.js");
