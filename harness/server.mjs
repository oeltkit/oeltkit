#!/usr/bin/env node
// OELT fake-LMS preview harness — dev server.
//
// Serves an OELT course directory and simulates the four delivery
// environments (scorm12 / scorm2004 / cmi5 / web). Dependency-free Node ESM so
// `npm run harness -- examples/minimal` runs with no build step.
//
//   node harness/server.mjs <course-dir> [--port 4173] [--open]
//
// Responsibilities split between server (this file) and browser:
//   - server: static files, SCORM/web state persistence to a JSON file
//     (so resume survives reloads), and the cmi5 endpoints + in-memory LRS.
//   - browser: the faithful fake SCORM API objects and the inspector panel
//     (see harness/client/*). SCORM is a synchronous content-side API, so it
//     lives in the page; this server only persists its committed state.

import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve, normalize, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
const CLIENT_DIR = join(HERE, "client");
const STATE_DIR = join(HERE, ".state");
const RUNTIME_DIR = join(ROOT, "packages", "runtime", "dist");

// ── CLI args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let port = 4173;
let courseArg;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--port") port = Number(argv[++i]);
  else if (a === "--open")
    void 0; // reserved; opening a browser is the caller's job
  else if (!a.startsWith("--")) courseArg = a;
}
if (!courseArg) {
  console.error("usage: node harness/server.mjs <course-dir> [--port N]");
  process.exit(2);
}
const COURSE_DIR = resolve(process.cwd(), courseArg);
const COURSE_JSON_PATH = join(COURSE_DIR, "course.json");
if (!existsSync(COURSE_JSON_PATH)) {
  console.error(`No course.json found at ${COURSE_JSON_PATH}`);
  process.exit(2);
}
const course = JSON.parse(readFileSync(COURSE_JSON_PATH, "utf8"));
const COURSE_ID = String(course.id ?? basename(COURSE_DIR)).replace(/[^a-zA-Z0-9._-]/g, "_");

// ── in-memory LRS (cmi5 mode) ─────────────────────────────────────────────────
// Reset whenever the launch (registration) changes so the panel shows one run.
/** @type {Map<string, object[]>} registration -> statements */
const lrsStatements = new Map();
/** @type {Map<string, string>} "registration::stateId" -> JSON state document */
const lrsState = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "cache-control": "no-store", ...headers });
  res.end(body);
};
const sendJson = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), { "content-type": MIME[".json"] });

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

/** Serve a static file from a root, blocking path traversal. */
async function serveStatic(res, root, relPath) {
  const full = normalize(join(root, relPath));
  if (!full.startsWith(normalize(root))) return send(res, 403, "Forbidden");
  if (!existsSync(full)) return send(res, 404, `Not found: ${relPath}`);
  try {
    const buf = await readFile(full);
    return send(res, 200, buf, {
      "content-type": MIME[extname(full)] ?? "application/octet-stream",
    });
  } catch {
    return send(res, 500, "Read error");
  }
}

const stateFile = (mode) => join(STATE_DIR, `${COURSE_ID}.${mode}.json`);

// ── cmi5 launch data (§10.2) ──────────────────────────────────────────────────
// The LMS derives the LMS.LaunchData State document from the course. We map the
// OELT tracking rules (specs/tracking-semantics.md) onto cmi5 `moveOn` and
// `masteryScore`.
function buildLaunchData(activityId) {
  const score = course.tracking?.score;
  const hasMastery = typeof score?.mastery === "number";
  // moveOn (§10.2.5): mastery present ⇒ must pass; otherwise completion.
  const moveOn = hasMastery ? "CompletedAndPassed" : "Completed";
  const launchData = {
    launchMode: "Normal", // §10.2.2
    moveOn, // §10.2.5
    // contextTemplate (§10.2.1): every cmi5-defined statement MUST merge this,
    // incl. the cmi5 category activity (§9.6.2.1).
    contextTemplate: {
      contextActivities: {
        category: [{ id: "https://w3id.org/xapi/cmi5/context/categories/cmi5" }],
        grouping: [{ id: activityId }],
      },
    },
  };
  if (hasMastery) launchData.masteryScore = score.mastery; // §10.2.4
  return launchData;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const q = url.searchParams;

  try {
    // Host shell + course manifest convenience route.
    if (path === "/" || path === "/index.html") return serveStatic(res, CLIENT_DIR, "host.html");
    if (path === "/preview") return serveStatic(res, CLIENT_DIR, "preview.html");
    if (path === "/harness/course.json") return serveStatic(res, COURSE_DIR, "course.json");

    // Built @oeltkit/runtime bundle (IIFE — exposes global `oelt`).
    if (path.startsWith("/runtime/")) {
      if (!existsSync(join(RUNTIME_DIR, "oelt.min.js"))) {
        return send(res, 503, "Runtime not built — run `npm run build -w @oeltkit/runtime`");
      }
      return serveStatic(res, RUNTIME_DIR, path.slice("/runtime/".length));
    }

    // Harness client assets.
    if (path.startsWith("/harness/"))
      return serveStatic(res, CLIENT_DIR, path.slice("/harness/".length));
    // Course content.
    if (path.startsWith("/course/"))
      return serveStatic(res, COURSE_DIR, path.slice("/course/".length));

    // ── SCORM / web state persistence ────────────────────────────────────────
    if (path === "/api/state") {
      const mode = q.get("mode") ?? "web";
      const file = stateFile(mode);
      if (req.method === "GET") {
        if (!existsSync(file)) return sendJson(res, 200, {});
        return sendJson(res, 200, JSON.parse(await readFile(file, "utf8")));
      }
      if (req.method === "PUT") {
        await mkdir(STATE_DIR, { recursive: true });
        await writeFile(file, await readBody(req));
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        if (existsSync(file)) await rm(file);
        return sendJson(res, 200, { ok: true });
      }
    }

    // ── cmi5 endpoints ───────────────────────────────────────────────────────
    // §8.2 Authorization Token Fetch: AU POSTs the fetch URL once; response is
    // {"auth-token": "..."} (§8.2.2).
    if (path === "/cmi5/fetch" && req.method === "POST") {
      const reg = q.get("registration") ?? "default";
      return sendJson(res, 200, { "auth-token": `oelt-harness-token:${reg}` });
    }

    // §10 xAPI State Data Model. stateId=LMS.LaunchData returns launch data.
    if (path === "/cmi5/activities/state") {
      const reg = q.get("registration") ?? "default";
      const stateId = q.get("stateId") ?? "";
      const activityId = q.get("activityId") ?? course.id;
      const key = `${reg}::${stateId}`;
      if (req.method === "GET") {
        if (stateId === "LMS.LaunchData") return sendJson(res, 200, buildLaunchData(activityId));
        if (!lrsState.has(key)) return send(res, 404, "");
        return send(res, 200, lrsState.get(key), { "content-type": MIME[".json"] });
      }
      if (req.method === "PUT" || req.method === "POST") {
        lrsState.set(key, await readBody(req));
        return send(res, 204, "");
      }
      if (req.method === "DELETE") {
        lrsState.delete(key);
        return send(res, 204, "");
      }
    }

    // §9 Statement API. Accept one statement or an array; store per registration.
    if (path === "/cmi5/statements") {
      const reg = q.get("registration") ?? "default";
      if (req.method === "GET") {
        return sendJson(res, 200, lrsStatements.get(reg) ?? []);
      }
      if (req.method === "PUT" || req.method === "POST") {
        const body = await readBody(req);
        const parsed = body ? JSON.parse(body) : [];
        const incoming = Array.isArray(parsed) ? parsed : [parsed];
        const list = lrsStatements.get(reg) ?? [];
        const ids = incoming.map((s) => s.id ?? `stmt-${list.length + 1}`);
        list.push(...incoming);
        lrsStatements.set(reg, list);
        return sendJson(res, 200, ids);
      }
      if (req.method === "DELETE") {
        lrsStatements.delete(reg);
        return send(res, 204, "");
      }
    }

    return send(res, 404, `Not found: ${path}`);
  } catch (err) {
    return send(res, 500, `Harness error: ${err?.message ?? err}`);
  }
});

server.listen(port, () => {
  const base = `http://localhost:${port}`;
  console.log(`OELT harness serving "${course.title ?? COURSE_ID}" (${COURSE_ID})`);
  console.log(`  course dir: ${COURSE_DIR}`);
  console.log(`  open:       ${base}/`);
  console.log(`  modes:      ${base}/?mode=scorm12 | scorm2004 | cmi5 | web`);
});
