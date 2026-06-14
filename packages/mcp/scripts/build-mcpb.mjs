#!/usr/bin/env node
// Build a .mcpb desktop-extension bundle for one-click install in Claude Desktop.
//
// Strategy: esbuild the server into a single file, then lay the repo asset dirs
// (specs/, packages/*/dist, harness/) around it in the SAME relative shape the
// server expects. The server's findUp-based asset resolution then works inside
// the installed bundle with zero runtime code changes.
//
// Output: packages/mcp/dist/oelt-mcp.mcpb (a zip) + an unzipped staging dir.

import { build } from "esbuild";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(MCP_ROOT, "../..");
const STAGE = join(MCP_ROOT, "dist", "mcpb");
const OUT = join(MCP_ROOT, "dist", "oelt-mcp.mcpb");

const pkg = JSON.parse(readFileSync(join(MCP_ROOT, "package.json"), "utf8"));

// Required asset bundles must exist (build runtime/components first).
const RUNTIME_BUNDLE = join(REPO_ROOT, "packages/runtime/dist/oelt.min.js");
const COMPONENTS_BUNDLE = join(REPO_ROOT, "packages/components/dist/oelt.min.js");
for (const f of [RUNTIME_BUNDLE, COMPONENTS_BUNDLE]) {
  if (!existsSync(f)) {
    console.error(`Missing ${f}\nRun: npm run build -w @oeltkit/runtime -w @oeltkit/components`);
    process.exit(1);
  }
}

console.log("Cleaning staging dir…");
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, "server"), { recursive: true });

console.log("Bundling server with esbuild…");
await build({
  entryPoints: [join(MCP_ROOT, "src/index.ts")],
  outfile: join(STAGE, "server/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Keep the dynamic require shim esbuild needs for some CJS deps under ESM.
  banner: { js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);" },
});

console.log("Copying repo assets into bundle (mirrors repo layout)…");
// Schema + component specs (validate, list_components, get_component_doc).
mkdirSync(join(STAGE, "specs/schema"), { recursive: true });
cpSync(join(REPO_ROOT, "specs/schema"), join(STAGE, "specs/schema"), { recursive: true });
cpSync(join(REPO_ROOT, "specs/components"), join(STAGE, "specs/components"), { recursive: true });
// Runtime + components bundles (package_course).
mkdirSync(join(STAGE, "packages/runtime/dist"), { recursive: true });
mkdirSync(join(STAGE, "packages/components/dist"), { recursive: true });
cpSync(RUNTIME_BUNDLE, join(STAGE, "packages/runtime/dist/oelt.min.js"));
cpSync(COMPONENTS_BUNDLE, join(STAGE, "packages/components/dist/oelt.min.js"));
// Harness (preview).
cpSync(join(REPO_ROOT, "harness"), join(STAGE, "harness"), {
  recursive: true,
  // Ship only what preview needs — no test files, build state, or screenshots.
  filter: (src) =>
    !src.includes("node_modules") &&
    !src.includes(".state") &&
    !src.endsWith(".spec.ts") &&
    !src.includes("/screenshots"),
});

console.log("Writing manifest.json…");
const manifest = {
  manifest_version: "0.2",
  name: "oelt-mcp",
  display_name: "OELTKit Course Authoring",
  version: pkg.version,
  description:
    "Author standards-compliant e-learning courses (SCORM 1.2/2004, cmi5, web) conversationally. Scaffold, edit pages, validate accessibility & tracking, preview, and package — all from chat.",
  long_description:
    "OELTKit turns a chat session into a course-authoring environment. Create a course, add pages with accessible interaction components, validate against WCAG and tracking rules with plain-language fixes, preview in a fake-LMS harness, and package for any major LMS — without leaving the conversation.",
  author: { name: "OELTKit", url: "https://github.com/oeltkit" },
  license: "Apache-2.0",
  server: {
    type: "node",
    entry_point: "server/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/server/index.js"],
      env: {
        // Optional override; defaults to ~/Documents/OELTKit Courses when unset.
        OELT_COURSES_DIR: "${user_config.courses_dir}",
      },
    },
  },
  user_config: {
    courses_dir: {
      type: "directory",
      title: "Courses folder",
      description: "Where your courses are stored. Leave blank for ~/Documents/OELTKit Courses.",
      required: false,
    },
  },
  tools: [
    { name: "scaffold_course", description: "Create a new course" },
    { name: "get_course", description: "Read a course manifest" },
    { name: "update_structure", description: "Restructure modules and pages" },
    { name: "add_page", description: "Add a page" },
    { name: "update_page", description: "Replace page HTML" },
    { name: "list_components", description: "List interaction components" },
    { name: "get_component_doc", description: "Get a component spec" },
    { name: "validate", description: "Validate a course" },
    { name: "preview", description: "Launch the preview harness" },
    { name: "package_course", description: "Package for an LMS" },
    { name: "export_course", description: "Export a .oeltcourse file" },
    { name: "import_course", description: "Import a .oeltcourse file" },
    { name: "set_theme", description: "Apply design tokens" },
  ],
};
writeFileSync(join(STAGE, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log("Zipping → oelt-mcp.mcpb…");
const zip = new JSZip();
// Walk the staging dir and add every file.
function addDir(absDir, relBase = "") {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, entry.name);
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) addDir(abs, rel);
    else zip.file(rel, readFileSync(abs));
  }
}
addDir(STAGE);
const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(OUT, bytes);

console.log(`\n✓ Built ${OUT} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  Staging dir: ${STAGE}`);
console.log(`  Install: open the .mcpb in Claude Desktop (Settings → Extensions → Install).`);
