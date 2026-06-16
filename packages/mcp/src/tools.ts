// Tool handler implementations. Each returns MCP content (text) and throws on
// unrecoverable errors (caller wraps into isError responses).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

import {
  loadCourse,
  validateCourse,
  buildPackage,
  writePackage,
  exportCourse,
  importCourse,
} from "@oeltkit/cli/lib";
import { coursePath } from "./courses-dir.js";

// Locate the repo root by walking up for a stable sentinel (the component
// specs directory). Robust to build-output depth (dist/esm) and dev layout.
function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "specs", "components", "base.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Could not locate repo root (specs/components/base.md)");
    dir = parent;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot(HERE);
const SPECS_COMPONENTS = join(REPO_ROOT, "specs", "components");

// ── helpers ──────────────────────────────────────────────────────────────────

function ok(text: string): McpText {
  return { type: "text" as const, text };
}

function json(value: unknown): McpText {
  return ok(JSON.stringify(value, null, 2));
}

interface McpText {
  type: "text";
  text: string;
}

// ── tools ─────────────────────────────────────────────────────────────────────

export async function scaffold_course(args: {
  name: string;
  title: string;
  targets?: string[];
  lang?: string;
}): Promise<McpText> {
  const { name, title, targets = ["scorm12", "scorm2004", "cmi5", "web"], lang = "en" } = args;
  const dir = coursePath(name);
  if (existsSync(join(dir, "course.json"))) {
    throw new Error(
      `A course named "${name}" already exists — choose a different name or use get_course to inspect it`,
    );
  }
  mkdirSync(join(dir, "pages"), { recursive: true });
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "course";
  const manifest = {
    oelt: "0.1",
    id: `org.oelt.${slug(name)}`,
    title,
    lang,
    targets,
    structure: [
      {
        id: "m1",
        title: "Module 1",
        pages: [{ id: "p1", title: "Welcome", src: "pages/p1.html" }],
      },
    ],
  };
  writeFileSync(join(dir, "course.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(
    join(dir, "pages", "p1.html"),
    `<section>\n  <h1>Welcome</h1>\n  <p>Edit <code>pages/p1.html</code> and update course.json to build your course.</p>\n</section>\n`,
  );
  return ok(
    `Created course "${title}" in ${dir}\n\nNext: call validate to check the course, add_page to add more pages, or preview to open the preview harness.`,
  );
}

export function get_course(args: { name: string }): McpText {
  const dir = coursePath(args.name);
  const loaded = loadCourse(dir);
  return json({ dir, course: loaded.course });
}

export function update_structure(args: { name: string; structure: unknown }): McpText {
  const dir = coursePath(args.name);
  const loaded = loadCourse(dir);
  const updated = { ...loaded.course, structure: args.structure };
  writeFileSync(join(dir, "course.json"), JSON.stringify(updated, null, 2) + "\n");
  // Verify the result is schema-valid before confirming.
  const findings = validateCourse({ dir, course: updated as typeof loaded.course });
  const errors = findings.filter((f) => f.level === "error");
  if (errors.length) {
    return ok(
      `Structure updated but validation found ${errors.length} error(s):\n` +
        errors.map((f) => `  • ${f.message_human}`).join("\n") +
        "\n\nThe course.json has been written — call validate for full details.",
    );
  }
  return ok(
    `Structure updated. Course now has ${(updated.structure as unknown[]).length} module(s).`,
  );
}

export function add_page(args: {
  name: string;
  module_id: string;
  page_id: string;
  page_title: string;
  html?: string;
}): McpText {
  const { name, module_id, page_id, page_title, html } = args;
  const dir = coursePath(name);
  const loaded = loadCourse(dir);
  const mod = loaded.course.structure.find((m) => m.id === module_id);
  if (!mod)
    throw new Error(`Module "${module_id}" not found — call get_course to see the structure`);

  // Check id uniqueness.
  const allIds = [
    ...loaded.course.structure.map((m) => m.id),
    ...loaded.course.structure.flatMap((m) => m.pages.map((p) => p.id)),
  ];
  if (allIds.includes(page_id)) {
    throw new Error(`Id "${page_id}" is already used in this course — choose a unique page id`);
  }

  const src = `pages/${page_id}.html`;
  const pageContent =
    html ??
    `<section>\n  <h1>${page_title}</h1>\n  <p>Edit ${src} to add your content.</p>\n</section>\n`;
  mkdirSync(join(dir, "pages"), { recursive: true });
  writeFileSync(join(dir, src), pageContent);

  mod.pages.push({ id: page_id, title: page_title, src });
  writeFileSync(join(dir, "course.json"), JSON.stringify(loaded.course, null, 2) + "\n");

  return ok(`Added page "${page_title}" (id: ${page_id}) to module "${mod.title}". File: ${src}`);
}

export function update_page(args: { name: string; src: string; html: string }): McpText {
  const dir = coursePath(args.name);
  const file = join(dir, args.src);
  if (!existsSync(file)) {
    throw new Error(`Page file "${args.src}" not found — call get_course to see the page sources`);
  }
  writeFileSync(file, args.html);
  return ok(`Updated ${args.src}`);
}

export function list_components(): McpText {
  const entries = readdirSync(SPECS_COMPONENTS)
    .filter((f) => f.endsWith(".md") && f !== "base.md" && f !== "README.md")
    .map((f) => {
      const name = f.replace(/\.md$/, "");
      // Peek at first heading for description
      const content = readFileSync(join(SPECS_COMPONENTS, f), "utf8");
      const match = content.match(/^# .+? — (.+)$/m);
      return { element: `oelt-${name}`, spec: f, description: match?.[1] ?? name };
    });
  return json({ components: entries });
}

export function get_component_doc(args: { component: string }): McpText {
  // Accept "oelt-mcq", "mcq", or "mcq.md"
  const name = args.component.replace(/^oelt-/, "").replace(/\.md$/, "");
  const specFile = join(SPECS_COMPONENTS, `${name}.md`);
  if (!existsSync(specFile)) {
    const available = readdirSync(SPECS_COMPONENTS)
      .filter((f) => f.endsWith(".md") && f !== "base.md" && f !== "README.md")
      .map((f) => `oelt-${f.replace(/\.md$/, "")}`);
    throw new Error(`Component "oelt-${name}" not found. Available: ${available.join(", ")}`);
  }
  return ok(readFileSync(specFile, "utf8"));
}

export function validate(args: { name: string }): McpText {
  const dir = coursePath(args.name);
  const loaded = loadCourse(dir);
  const findings = validateCourse(loaded);
  const ok_ = !findings.some((f) => f.level === "error");
  if (findings.length === 0) return ok("✓ Course is valid — no issues found.");
  const lines = findings.map((f) => `[${f.level.toUpperCase()}] ${f.code}: ${f.message_human}`);
  return ok(
    (ok_ ? "⚠ Valid (warnings only):\n" : "✗ Validation failed:\n") +
      lines.join("\n") +
      "\n\n" +
      JSON.stringify({ ok: ok_, findings }, null, 2),
  );
}

// Running preview servers: track active instances to avoid duplicates.
const activePreviews = new Map<string, number>();

export async function preview(args: { name: string; port?: number }): Promise<McpText> {
  const dir = coursePath(args.name);
  const existing = activePreviews.get(dir);
  if (existing) return ok(`Preview already running at http://localhost:${existing}/`);

  const port = args.port ?? (await findFreePort());
  const server = join(REPO_ROOT, "harness", "server.mjs");
  const child = spawn("node", [server, dir, "--port", String(port)], {
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  activePreviews.set(dir, port);

  // Wait for the server to be ready (up to 5 s).
  await waitForUrl(`http://localhost:${port}/`, 5000);
  return ok(
    `Preview running at http://localhost:${port}/\n\nThe harness simulates all four delivery targets (scorm12, scorm2004, cmi5, web) and shows live tracking events.`,
  );
}

async function findFreePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, () => {
      const addr = s.address();
      s.close(() => res(typeof addr === "object" && addr ? addr.port : 0));
    });
    s.on("error", rej);
  });
}

async function waitForUrl(url: string, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (res.ok) return;
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Preview server didn't become ready within ${timeout / 1000}s`);
}

export async function package_course(args: {
  name: string;
  target: string;
  out?: string;
}): Promise<McpText> {
  const dir = coursePath(args.name);
  const loaded = loadCourse(dir);
  const findings = validateCourse(loaded);
  if (findings.some((f) => f.level === "error")) {
    const errors = findings.filter((f) => f.level === "error");
    return ok(
      `Packaging refused — fix these errors first:\n` +
        errors.map((f) => `  • ${f.message_human}`).join("\n"),
    );
  }
  const target = args.target as "scorm12" | "scorm2004" | "cmi5" | "web";
  if (!["scorm12", "scorm2004", "cmi5", "web"].includes(target)) {
    throw new Error(`Unknown target "${target}" — use scorm12, scorm2004, cmi5, or web`);
  }
  const bytes = await buildPackage(loaded.dir, loaded.course, target);
  const outFile = args.out ?? join(dir, `${loaded.course.id}-${target}.zip`);
  writePackage(bytes, outFile);
  return ok(`Packaged ${target} → ${outFile} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

export async function export_course(args: { name: string; out?: string }): Promise<McpText> {
  const dir = coursePath(args.name);
  const outFile = await exportCourse(dir, args.out);
  return ok(`Exported → ${outFile}`);
}

export async function import_course(args: { file: string; name: string }): Promise<McpText> {
  const targetDir = coursePath(args.name);
  if (existsSync(targetDir)) {
    throw new Error(`A course named "${args.name}" already exists — choose a different name`);
  }
  await importCourse(args.file, targetDir);
  return ok(`Imported ${args.file} → ${targetDir}`);
}

export function set_theme(args: { name: string; tokens: Record<string, string> }): McpText {
  const dir = coursePath(args.name);
  const loaded = loadCourse(dir);
  const themePath = loaded.course.theme ?? "theme/tokens.css";
  const fullPath = join(dir, themePath);
  mkdirSync(dirname(fullPath), { recursive: true });

  const lines = Object.entries(args.tokens).map(([k, v]) => `  ${k}: ${v};`);
  const css = `:root {\n${lines.join("\n")}\n}\n`;
  writeFileSync(fullPath, css);

  if (!loaded.course.theme) {
    loaded.course.theme = themePath;
    writeFileSync(join(dir, "course.json"), JSON.stringify(loaded.course, null, 2) + "\n");
  }
  return ok(`Theme written to ${fullPath}\n\nTokens set: ${Object.keys(args.tokens).join(", ")}`);
}
