#!/usr/bin/env node
/**
 * @oeltkit/cli — `oelt` command line.
 *   oelt new <dir> [--title "…"]
 *   oelt validate <dir|file.oeltcourse> [--json]
 *   oelt package <dir|file.oeltcourse> --target scorm12|scorm2004|cmi5|web [--out file.zip]
 *   oelt preview <dir|file.oeltcourse> [--port N]
 *   oelt export <dir> [--out file.oeltcourse]
 *   oelt import <file.oeltcourse> <dir>
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { loadCourse, validateCourse, type Finding } from "./lib/course.js";
import { buildPackage, writePackage, type Target } from "./lib/generators.js";
import { repoRoot } from "./lib/paths.js";
import { exportCourse, importCourse, isOeltCourse } from "./lib/course-file.js";

const TARGETS: Target[] = ["scorm12", "scorm2004", "cmi5", "web"];

interface Args {
  _: string[];
  flags: Record<string, string | boolean>;
}
function parseArgs(argv: string[]): Args {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else _.push(a);
  }
  return { _, flags };
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "course";

function cmdNew(dir: string, flags: Args["flags"]): void {
  if (existsSync(join(dir, "course.json"))) throw new Error(`${dir} already has a course.json`);
  mkdirSync(join(dir, "pages"), { recursive: true });
  const title = typeof flags.title === "string" ? flags.title : "Untitled Course";
  const course = {
    oelt: "0.1",
    id: `org.oelt.${slug(basename(resolve(dir)))}`,
    title,
    lang: "en",
    targets: ["scorm12", "scorm2004", "cmi5", "web"],
    structure: [
      {
        id: "m1",
        title: "Module 1",
        pages: [{ id: "p1", title: "Welcome", src: "pages/p1.html" }],
      },
    ],
  };
  writeFileSync(join(dir, "course.json"), JSON.stringify(course, null, 2) + "\n");
  writeFileSync(
    join(dir, "pages", "p1.html"),
    `<section>\n  <h1>Welcome</h1>\n  <p>Edit <code>pages/p1.html</code> and <code>course.json</code> to build your course.</p>\n</section>\n`,
  );
  console.log(`Created course in ${dir}\n  next: oelt preview ${dir}`);
}

function printFindings(findings: Finding[], asJson: boolean): void {
  if (asJson) {
    console.log(
      JSON.stringify({ ok: !findings.some((f) => f.level === "error"), findings }, null, 2),
    );
    return;
  }
  if (findings.length === 0) {
    console.log("✓ valid");
    return;
  }
  for (const f of findings) {
    const tag = f.level === "error" ? "✗" : "⚠";
    console.log(`  ${tag} [${f.code}] ${f.message}${f.where ? ` (${f.where})` : ""}`);
  }
}

async function resolveDir(input: string): Promise<{ dir: string; cleanup?: () => void }> {
  if (!isOeltCourse(input)) return { dir: input };
  const tmp = mkdtempSync(join(tmpdir(), "oelt-import-"));
  await importCourse(input, tmp);
  return { dir: tmp, cleanup: () => import("node:fs").then((fs) => fs.rmSync(tmp, { recursive: true, force: true })) };
}

async function cmdValidate(input: string, flags: Args["flags"]): Promise<number> {
  const { dir, cleanup } = await resolveDir(input);
  try {
    const findings = validateCourse(loadCourse(dir));
    printFindings(findings, flags.json === true);
    return findings.some((f) => f.level === "error") ? 1 : 0;
  } finally {
    await cleanup?.();
  }
}

async function cmdPackage(input: string, flags: Args["flags"]): Promise<number> {
  const target = flags.target;
  if (typeof target !== "string" || !TARGETS.includes(target as Target)) {
    throw new Error(`--target must be one of ${TARGETS.join(", ")}`);
  }
  const { dir, cleanup } = await resolveDir(input);
  try {
    const loaded = loadCourse(dir);
    const findings = validateCourse(loaded);
    if (findings.some((f) => f.level === "error")) {
      console.error("Refusing to package — validation failed:");
      printFindings(findings, false);
      return 1;
    }
    const bytes = await buildPackage(loaded.dir, loaded.course, target as Target);
    const out = typeof flags.out === "string" ? flags.out : `${loaded.course.id}-${target}.zip`;
    writePackage(bytes, out);
    console.log(`Packaged ${target} → ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
    return 0;
  } finally {
    await cleanup?.();
  }
}

async function cmdPreview(input: string, flags: Args["flags"]): Promise<void> {
  // For .oeltcourse input: extract to a temp dir that lives for the server lifetime.
  let dir = input;
  if (isOeltCourse(input)) {
    const tmp = mkdtempSync(join(tmpdir(), "oelt-preview-"));
    await importCourse(input, tmp);
    dir = tmp;
    // Register cleanup on exit so the OS does not accumulate temp dirs.
    process.on("exit", () => {
      try {
        import("node:fs").then((fs) => fs.rmSync(tmp, { recursive: true, force: true }));
      } catch { /* best effort */ }
    });
  }
  const server = join(repoRoot(), "harness", "server.mjs");
  const args = [server, dir];
  if (typeof flags.port === "string") args.push("--port", flags.port);
  spawn("node", args, { stdio: "inherit" });
}

async function cmdExport(dir: string, flags: Args["flags"]): Promise<void> {
  const out = typeof flags.out === "string" ? flags.out : undefined;
  const result = await exportCourse(dir, out);
  console.log(`Exported → ${result}`);
}

async function cmdImport(file: string, dir: string): Promise<void> {
  await importCourse(file, dir);
  console.log(`Imported ${file} → ${dir}`);
}

async function main(): Promise<number> {
  const { _, flags } = parseArgs(process.argv.slice(2));
  const [command, arg1, arg2] = _;
  if (!command || command === "help" || flags.help) {
    console.log(
      "oelt <command>\n" +
        "  new <dir> [--title]\n" +
        "  validate <dir|file.oeltcourse> [--json]\n" +
        "  package <dir|file.oeltcourse> --target scorm12|scorm2004|cmi5|web [--out]\n" +
        "  preview <dir|file.oeltcourse> [--port]\n" +
        "  export <dir> [--out file.oeltcourse]\n" +
        "  import <file.oeltcourse> <dir>",
    );
    return command ? 0 : 1;
  }
  if (!arg1 && command !== "help") throw new Error(`${command}: missing argument`);
  switch (command) {
    case "new":
      cmdNew(arg1!, flags);
      return 0;
    case "validate":
      return cmdValidate(arg1!, flags);
    case "package":
      return cmdPackage(arg1!, flags);
    case "preview":
      await cmdPreview(arg1!, flags);
      return 0;
    case "export":
      await cmdExport(arg1!, flags);
      return 0;
    case "import":
      if (!arg2) throw new Error("import: missing <dir>");
      await cmdImport(arg1!, arg2);
      return 0;
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(`oelt: ${(err as Error).message}`);
    process.exit(2);
  });

/** Package version placeholder; real version is injected at publish time. */
export const VERSION = "0.0.0";
