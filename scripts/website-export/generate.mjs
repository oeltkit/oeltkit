#!/usr/bin/env node
// Regenerates docs/website-export/* from repo sources. The website (Task 11
// Part B) consumes these artifacts; this script is the ONLY place they are
// produced, so there is no hand-maintained duplication to drift.
//
//   components.json   ← packages/components/README.md  (the curated, model-facing inventory)
//   cli.json          ← packages/cli/.../commands.js   (the single CLI command source)
//   walkthrough/*.json← docs/website-export/walkthrough/course.json (authored source) + the validator
//
// Authored source under walkthrough/ (course.json, pages/*.html, screenshots/*)
// is NOT regenerated — only the derived validator-output JSON is. Run:
//   npm run website-export         # regenerate + prettier-format
//   npm run website-export:check   # regenerate and fail if anything drifted (CI)

import { readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const exportDir = join(repoRoot, "docs", "website-export");

// Built CLI modules (run after `npm run build`).
const { COMMANDS } = await import(join(repoRoot, "packages/cli/dist/esm/lib/commands.js"));
const { loadCourse, validateCourse } = await import(
  join(repoRoot, "packages/cli/dist/esm/lib/course.js")
);

const writeJson = (rel, value) =>
  writeFileSync(join(exportDir, rel), JSON.stringify(value, null, 2) + "\n");

// ── components.json ─────────────────────────────────────────────────────────
// Parse the @oeltkit/components README — the authored per-component inventory
// with canonical examples written for model consumption (CLAUDE.md component
// checklist). One entry per `## ` section whose heading names an <oelt-*> tag.
function buildComponents() {
  const md = readFileSync(join(repoRoot, "packages/components/README.md"), "utf8");

  // Global release status, e.g. "> Status: `beta` (pending manual NVDA/VoiceOver passes)."
  const statusMatch = md.match(/^>\s*Status:\s*`([^`]+)`\s*\(([^)]+)\)/m);
  const status = statusMatch ? statusMatch[1] : "beta";
  const statusNote = statusMatch ? statusMatch[2].trim() : "";

  // a11y baseline asserted in the README intro — true for every component.
  const a11yBaseline =
    "Light DOM, fully keyboard-operable, visible focus, screen-reader documented in its spec, axe-clean, honors prefers-reduced-motion.";

  const sections = md.split(/\n## /).slice(1); // drop the intro before the first `##`
  const components = [];
  for (const section of sections) {
    const heading = section.slice(0, section.indexOf("\n")).trim();
    const elements = [...heading.matchAll(/`<(oelt-[a-z0-9-]+)>`/g)].map((m) => m[1]);
    if (elements.length === 0) continue; // e.g. the "Develop" section

    const body = section.slice(section.indexOf("\n") + 1);

    // Description: heading text after "— " unless that's just the element list
    // (the presentation family), in which case use the first sentence of the body.
    let description = "";
    const dash = heading.split(" — ")[1];
    if (dash && !dash.trimStart().startsWith("`<oelt")) {
      description = dash.trim();
    } else {
      const firstSentence = body.replace(/\n+/g, " ").match(/^\s*(.+?[.!?])(\s|$)/);
      description = firstSentence
        ? firstSentence[1].replace(/\*\*/g, "").trim()
        : heading.replace(/`/g, "");
    }

    // Canonical example: the first ```html fenced block in the section.
    const example = body.match(/```html\n([\s\S]*?)```/);

    // Spec slug: the first [<name>.md](...) link in the section.
    const specLink = body.match(/\[([a-z0-9-]+)\.md\]/);
    const slug = specLink ? specLink[1] : elements[0].replace(/^oelt-/, "");

    // a11y summary: a "**Screen-reader:**" note if the section has one, else baseline.
    const sr = body.match(/\*\*Screen-reader:\*\*\s*([\s\S]*?)(?:\n\n|Spec:|$)/);
    const a11y = sr ? sr[1].replace(/\s+/g, " ").replace(/\*\*/g, "").trim() : a11yBaseline;

    components.push({
      name: elements[0],
      elements,
      status,
      statusNote,
      description,
      a11y,
      example: example ? example[1].trim() : null,
      spec: `${slug}.md`,
      readmeSlug: slug,
    });
  }
  return { generated: "scripts/website-export/generate.mjs", status, statusNote, components };
}

// ── cli.json ──────────────────────────────────────────────────────────────--
function buildCli() {
  return {
    generated: "scripts/website-export/generate.mjs",
    binary: "oelt",
    commands: COMMANDS,
  };
}

// ── walkthrough validator output ──────────────────────────────────────────--
// validate-ok.json   — the authored walkthrough course as it ships (clean).
// validate-error.json — the same course with ONE injected mistake (a declared
//                       interaction missing from the page HTML), so the website
//                       can show a real "caught error → fix" loop.
function buildWalkthrough() {
  const courseDir = join(exportDir, "walkthrough");
  const okFindings = validateCourse(loadCourse(courseDir));
  writeJson("walkthrough/validate-ok.json", {
    ok: !okFindings.some((f) => f.level === "error"),
    findings: okFindings,
  });

  const tmp = mkdtempSync(join(tmpdir(), "oelt-walkthrough-"));
  try {
    cpSync(courseDir, tmp, { recursive: true });
    const manifestPath = join(tmp, "course.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    // Inject the mistake: declare a second interaction "q2" the page never adds.
    const check = manifest.structure[0].pages.find((p) => p.id === "check");
    check.interactions.push({ id: "q2", type: "choice", weight: 1, required: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const errFindings = validateCourse(loadCourse(tmp));
    writeJson("walkthrough/validate-error.json", {
      ok: !errFindings.some((f) => f.level === "error"),
      findings: errFindings,
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

writeJson("components.json", buildComponents());
writeJson("cli.json", buildCli());
buildWalkthrough();
console.log("website-export: regenerated components.json, cli.json, walkthrough/*.json");
