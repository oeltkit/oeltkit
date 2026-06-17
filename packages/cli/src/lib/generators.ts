// Package assembly: build a target artifact (zip) from a course directory.
// Manifests (imsmanifest.xml / cmi5.xml) are GENERATED here from course.json —
// never hand-edited (CLAUDE.md hard-rule 8). The course ships with a default
// "player" (a standalone view that boots @oeltkit/runtime and renders pages).

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import JSZip from "jszip";
import type { CourseManifest } from "./course.js";
import { runtimeBundle, componentsBundle } from "./paths.js";

export type Target = "scorm12" | "scorm2004" | "cmi5" | "web";

const xmlEscape = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

// ── manifests ────────────────────────────────────────────────────────────────
export function scorm12Manifest(c: CourseManifest): string {
  const t = xmlEscape(c.title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-${xmlEscape(c.id)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG"><title>${t}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true"><title>${t}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`;
}

export function scorm2004Manifest(c: CourseManifest): string {
  const t = xmlEscape(c.title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-${xmlEscape(c.id)}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG"><title>${t}</title>
      <item identifier="ITEM-1" identifierref="RES-1"><title>${t}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`;
}

/**
 * The cmi5 course/AU identity IRI for a course. cmi5 (and xAPI) require an
 * absolute IRI; if the author's `course.id` already carries a URI scheme we keep
 * it, otherwise we mint a stable one under the oeltkit namespace. See
 * specs/OPEN-QUESTIONS.md OQ-003.
 */
export function courseActivityIri(id: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(id) ? id : `https://oeltkit.org/cmi5/${id}`;
}

export function cmi5Xml(c: CourseManifest): string {
  const lang = xmlEscape(c.lang);
  const t = xmlEscape(c.title);
  const mastery = c.tracking?.score?.mastery;
  const moveOn = typeof mastery === "number" ? "CompletedAndPassed" : "Completed";
  const masteryAttr = typeof mastery === "number" ? ` masteryScore="${mastery}"` : "";
  // cmi5 CourseStructure schema (courseType / auType) requires <description> and
  // fixes element order: <title> then <description> then <url>. Both <course>
  // and <au> are affected — SCORM Cloud rejects the package otherwise (it
  // validates against the XSD on import). We have no separate description field
  // in course.json, so the title doubles as the (required) description.
  const langstring = (text: string): string => `<langstring lang="${lang}">${text}</langstring>`;
  // cmi5 requires the course/AU `id` to be an absolute IRI (the AU id also
  // becomes the xAPI activity id the LMS hands the AU at launch). course.json
  // ids are reverse-DNS strings (e.g. "org.oeltkit.spike"), which are NOT URIs —
  // SCORM Cloud rejects them ("Activity ID … is not an absolute URI"). Synthesize
  // an IRI under the project namespace unless the author already used one.
  const courseIri = courseActivityIri(c.id);
  const auIri = xmlEscape(`${courseActivityIri(c.id)}/au`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="${xmlEscape(courseIri)}">
    <title>${langstring(t)}</title>
    <description>${langstring(t)}</description>
  </course>
  <au id="${auIri}" moveOn="${moveOn}"${masteryAttr}>
    <title>${langstring(t)}</title>
    <description>${langstring(t)}</description>
    <url>index.html</url>
  </au>
</courseStructure>
`;
}

// ── player (standalone view bundled into the package) ────────────────────────

/**
 * `index.html` for any target. For web target, pass `webPages: true` to
 * include oelt-pages.js (the pre-embedded page content bundle required for
 * file:// viability — manifest-v0 §9).
 */
export function indexHtml(c: CourseManifest, opts: { webPages?: boolean } = {}): string {
  const theme = c.theme ? `\n    <link rel="stylesheet" href="${xmlEscape(c.theme)}" />` : "";
  const pagesScript = opts.webPages ? `\n    <script src="oelt-pages.js"></script>` : "";
  return `<!doctype html>
<html lang="${xmlEscape(c.lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${xmlEscape(c.title)}</title>
    <link rel="stylesheet" href="oelt-player.css" />${theme}
    <script src="oelt-runtime.js"></script>
    <script src="oelt-components.js"></script>${pagesScript}
  </head>
  <body>
    <div id="course-root"></div>
    <script>
      window.OELT_MANIFEST = ${JSON.stringify(c)};
    </script>
    <script src="oelt-player.js"></script>
  </body>
</html>
`;
}

// Shared player shell (navigation chrome, event wiring). The render function
// is swapped out per target: SCORM/cmi5 use fetch; web uses window.OELT_PAGES.
const PLAYER_SHELL = `const course = window.OELT_MANIFEST;
const rt = window.oelt.boot(course);
const pages = rt.nav.pages;
const root = document.getElementById("course-root");
root.innerHTML =
  '<header class="oelt-head"><strong></strong><button id="oelt-exit" type="button">Exit</button></header>' +
  '<nav class="oelt-toc" id="oelt-toc" aria-label="Course contents"></nav>' +
  '<main class="oelt-page" id="oelt-page" tabindex="-1"></main>' +
  '<footer class="oelt-nav"><button id="oelt-prev" type="button">Prev</button>' +
  '<span id="oelt-pos"></span><button id="oelt-next" type="button">Next</button></footer>';
root.querySelector(".oelt-head strong").textContent = course.title;
const toc = document.getElementById("oelt-toc");
toc.innerHTML = pages.map((p, i) => '<button data-i="' + i + '" type="button">' + (i + 1) + ". " + p.title + "</button>").join("");
toc.addEventListener("click", (e) => { const i = e.target && e.target.dataset.i; if (i != null) rt.nav.go(Number(i)); });
document.getElementById("oelt-prev").addEventListener("click", () => rt.nav.prev());
document.getElementById("oelt-next").addEventListener("click", () => rt.nav.next());
document.getElementById("oelt-exit").addEventListener("click", () => rt.terminate());
addEventListener("pagehide", () => rt.terminate());
`;

// SCORM / cmi5 player — uses fetch (always runs over HTTP from an LMS).
const PLAYER_JS = `// OELT player for SCORM/cmi5 packages. Generated by @oeltkit/cli — do not hand-edit.
${PLAYER_SHELL}async function render(i) {
  const pg = pages[i];
  const html = await (await fetch(pg.src)).text();
  const page = document.getElementById("oelt-page");
  page.innerHTML = html;
  page.focus();
  document.getElementById("oelt-pos").textContent = (i + 1) + " / " + pages.length;
  document.getElementById("oelt-prev").disabled = i === 0;
  document.getElementById("oelt-next").disabled = i === pages.length - 1;
  toc.querySelectorAll("button").forEach((b, bi) => b.setAttribute("aria-current", bi === i ? "true" : "false"));
}
rt.on((e) => { if (e.type === "page-change") render(e.index); });
rt.start();
`;

// Web-standalone player — reads from window.OELT_PAGES (no fetch, file:// safe).
// manifest-v0 §9: page HTML is pre-embedded at build time via oelt-pages.js.
const WEB_PLAYER_JS = `// OELT web player. Generated by @oeltkit/cli — do not hand-edit.
${PLAYER_SHELL}function render(i) {
  const pg = pages[i];
  const html = window.OELT_PAGES[pg.src];
  const page = document.getElementById("oelt-page");
  page.innerHTML = html;
  page.focus();
  document.getElementById("oelt-pos").textContent = (i + 1) + " / " + pages.length;
  document.getElementById("oelt-prev").disabled = i === 0;
  document.getElementById("oelt-next").disabled = i === pages.length - 1;
  toc.querySelectorAll("button").forEach((b, bi) => b.setAttribute("aria-current", bi === i ? "true" : "false"));
}
rt.on((e) => { if (e.type === "page-change") render(e.index); });
rt.start();
`;

const PLAYER_CSS = `:root { --oelt-color-fg: #1a1f29; --oelt-color-bg: #fff; --oelt-color-primary: #2257a8; --oelt-color-focus: #2257a8; --oelt-radius: 6px; }
body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: var(--oelt-color-fg); background: #f5f6f8; }
#course-root { display: flex; flex-direction: column; min-height: 100vh; }
.oelt-head { display: flex; justify-content: space-between; align-items: center; padding: .6rem 1rem; background: #fff; border-bottom: 1px solid #d9dde5; }
.oelt-toc { display: flex; flex-wrap: wrap; gap: .35rem; padding: .5rem 1rem; background: #eef0f4; border-bottom: 1px solid #d9dde5; }
.oelt-toc button { border: 1px solid #c2c8d4; background: #fff; border-radius: 999px; padding: .2rem .7rem; cursor: pointer; font: .85rem system-ui; }
.oelt-toc button[aria-current="true"] { background: var(--oelt-color-primary); color: #fff; border-color: var(--oelt-color-primary); }
.oelt-page { flex: 1; padding: 1.5rem clamp(1rem, 5vw, 3rem); max-width: 70ch; margin: 0 auto; outline: none; }
.oelt-nav { display: flex; justify-content: space-between; gap: 1rem; padding: .75rem 1rem; background: #fff; border-top: 1px solid #d9dde5; }
.oelt-head button, .oelt-nav button { border: 1px solid #c2c8d4; background: #fff; border-radius: var(--oelt-radius); padding: .4rem 1rem; cursor: pointer; font: inherit; }
.oelt-nav button:disabled { opacity: .4; cursor: default; }
*:focus-visible { outline: 2px solid var(--oelt-color-focus); outline-offset: 2px; }
`;

// ── assembly ─────────────────────────────────────────────────────────────────
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full)];
  });
}

/** Build the target package zip from a course directory; returns the bytes. */
export async function buildPackage(
  courseDir: string,
  course: CourseManifest,
  target: Target,
): Promise<Buffer> {
  const zip = new JSZip();

  // 1. All authored course files (pages, media, scenarios, theme, course.json).
  for (const rel of walk(courseDir))
    zip.file(rel.split("\\").join("/"), readFileSync(join(courseDir, rel)));

  // 2. Runtime + components bundles and the default player.
  zip.file("oelt-runtime.js", readFileSync(runtimeBundle()));
  zip.file("oelt-components.js", readFileSync(componentsBundle()));
  zip.file("oelt-player.css", PLAYER_CSS);
  zip.file("index.html", indexHtml(course, { webPages: target === "web" }));

  if (target === "web") {
    // Web-standalone: embed page HTML at build time so the player never uses
    // fetch() — required for file:// viability (manifest-v0 §9).
    const pages = course.structure.flatMap((m) => m.pages);
    const pagesMap: Record<string, string> = {};
    for (const page of pages) {
      pagesMap[page.src] = readFileSync(join(courseDir, page.src), "utf8");
    }
    zip.file("oelt-pages.js", `window.OELT_PAGES=${JSON.stringify(pagesMap)};`);
    zip.file("oelt-player.js", WEB_PLAYER_JS);
  } else {
    zip.file("oelt-player.js", PLAYER_JS);
  }

  // 3. Target manifest (generated; web needs none).
  if (target === "scorm12") zip.file("imsmanifest.xml", scorm12Manifest(course));
  else if (target === "scorm2004") zip.file("imsmanifest.xml", scorm2004Manifest(course));
  else if (target === "cmi5") zip.file("cmi5.xml", cmi5Xml(course));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function writePackage(bytes: Buffer, outFile: string): void {
  writeFileSync(outFile, bytes);
}
