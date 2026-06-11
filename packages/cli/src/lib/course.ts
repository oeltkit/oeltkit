// Load and validate a course. Validation = JSON Schema + the cross-checks the
// schema can't express (manifest-v0.md §7, tracking-semantics §10, component
// validator obligations). Findings are machine-readable.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { schemaPath } from "./paths.js";

export interface Interaction {
  id: string;
  type: string;
  weight?: number;
  required?: boolean;
}
export interface Page {
  id: string;
  title: string;
  src: string;
  interactions?: Interaction[];
}
export interface Module {
  id: string;
  title: string;
  pages: Page[];
}
export interface Tracking {
  completion?: { rule: string; threshold?: number };
  score?: { rule: string; source?: string; mastery?: number };
  progress?: { rule: string };
}
export interface CourseManifest {
  oelt: string;
  id: string;
  title: string;
  lang: string;
  targets: string[];
  theme?: string;
  tracking?: Tracking;
  structure: Module[];
}

export interface Finding {
  level: "error" | "warning";
  code: string;
  message: string;
  where?: string;
}

export interface LoadedCourse {
  dir: string;
  course: CourseManifest;
}

export function loadCourse(dir: string): LoadedCourse {
  const file = join(dir, "course.json");
  if (!existsSync(file)) throw new Error(`No course.json in ${dir}`);
  return { dir, course: JSON.parse(readFileSync(file, "utf8")) as CourseManifest };
}

let validator: ReturnType<Ajv2020["compile"]> | undefined;
function schemaValidate(course: unknown): Finding[] {
  if (!validator) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
    addFormats(ajv);
    validator = ajv.compile(JSON.parse(readFileSync(schemaPath(), "utf8")));
  }
  if (validator(course)) return [];
  return (validator.errors ?? []).map((e) => ({
    level: "error" as const,
    code: "schema",
    message: `${e.instancePath || "/"} ${e.message ?? "invalid"}`,
  }));
}

const ID_RE = (id: string) =>
  new RegExp(`\\bid\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);

export function validateCourse({ dir, course }: LoadedCourse): Finding[] {
  const findings: Finding[] = [...schemaValidate(course)];
  // If the manifest isn't even schema-valid, structural walks below may throw.
  if (findings.length) return findings;

  const pages = course.structure.flatMap((m) => m.pages);
  const interactions = pages.flatMap((p) => (p.interactions ?? []).map((i) => ({ ...i, page: p })));

  // Course-wide id uniqueness (manifest-v0 §3.1).
  const ids = [
    ...course.structure.map((m) => m.id),
    ...pages.map((p) => p.id),
    ...interactions.map((i) => i.id),
  ];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id))
      findings.push({ level: "error", code: "id-unique", message: `duplicate id "${id}"` });
    seen.add(id);
  }

  // Per-page HTML cross-checks.
  for (const page of pages) {
    const file = join(dir, page.src);
    if (!existsSync(file)) {
      findings.push({
        level: "error",
        code: "page-missing",
        message: `page src not found: ${page.src}`,
        where: page.id,
      });
      continue;
    }
    const html = readFileSync(file, "utf8");
    // Declared interactions must exist in the page HTML (decl ↔ HTML, §4.1).
    for (const i of page.interactions ?? []) {
      if (!ID_RE(i.id).test(html)) {
        findings.push({
          level: "error",
          code: "interaction-missing",
          message: `declared interaction "${i.id}" has no element with that id in ${page.src}`,
          where: page.id,
        });
      }
    }
    // Media a11y gate (media.md §3): every <oelt-media> needs captions or a transcript.
    for (const block of html.match(/<oelt-media\b[\s\S]*?<\/oelt-media>/gi) ?? []) {
      if (
        !/kind\s*=\s*["']captions["']/i.test(block) &&
        !/slot\s*=\s*["']transcript["']/i.test(block)
      ) {
        findings.push({
          level: "error",
          code: "media-no-alt",
          message: `<oelt-media> without captions or a transcript in ${page.src}`,
          where: page.id,
        });
      }
    }
  }

  // Tracking reachability / consistency (tracking-semantics §10).
  const t = course.tracking;
  const completionRule = t?.completion?.rule ?? "all-pages-viewed";
  if (completionRule.startsWith("required-interactions") && !interactions.some((i) => i.required)) {
    findings.push({
      level: "error",
      code: "no-required-interaction",
      message: `completion rule "${completionRule}" but no interaction is marked required`,
    });
  }
  if (t?.score?.rule === "single-interaction") {
    const src = t.score.source;
    if (!src || !interactions.some((i) => i.id === src)) {
      findings.push({
        level: "error",
        code: "score-source",
        message: `score source "${src ?? "(unset)"}" is not a declared interaction`,
      });
    }
  }
  return findings;
}
