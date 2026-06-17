#!/usr/bin/env node
// SCORM Cloud conformance runner (Task 10) — the real-LMS regression net.
//
// For every example × LMS target: package it, import it to SCORM Cloud, create a
// registration, launch it, drive a deterministic playthrough with Playwright,
// then assert completion/success/score via the v2 REST API — and on the pass
// scenario, relaunch to prove suspend/location round-trips. Always tears down the
// registration + course, even on failure (the dev tier caps registrations).
//
// Usage:
//   node scripts/scorm-cloud/run.mjs                 # live run (needs CI secrets)
//   node scripts/scorm-cloud/run.mjs --dry-run       # local: web target + localStorage, no Cloud
//   node scripts/scorm-cloud/run.mjs --example spike --target scorm12
//   node scripts/scorm-cloud/run.mjs --keep          # leave Cloud courses/registrations (debug)
//
// Secrets (live mode): SCORM_CLOUD_APP_ID / SCORM_CLOUD_SECRET_KEY. If absent,
// the run SKIPS with a clear notice and exits 0 — never fails (fork PRs, local).

import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { chromium } from "@playwright/test";
import { ScormCloudClient } from "./client.mjs";
import { findContentFrame, makeContext, openCourseWindow } from "./driver.mjs";
import { EXAMPLES, LEARNER } from "./playthroughs.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "packages", "cli", "dist", "esm", "index.js");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".vtt": "text/vtt",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

// ── args ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = { dryRun: false, keep: false, example: null, target: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--keep") flags.keep = true;
    else if (a === "--example") flags.example = argv[++i];
    else if (a === "--target") flags.target = argv[++i];
  }
  return flags;
}

const log = (m) => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── packaging ───────────────────────────────────────────────────────────────
/** Package an example for a target via the built CLI; return the zip bytes + path. */
function packageCourse(exampleDir, target) {
  if (!existsSync(CLI)) {
    throw new Error(`CLI not built at ${CLI} — run \`npm run build\` first.`);
  }
  const outDir = mkdtempSync(join(tmpdir(), "oelt-cloud-pkg-"));
  const out = join(outDir, `${target}.zip`);
  const res = spawnSync(
    "node",
    [CLI, "package", join(ROOT, exampleDir), "--target", target, "--out", out],
    {
      encoding: "utf8",
    },
  );
  if (res.status !== 0) {
    throw new Error(
      `oelt package ${exampleDir} --target ${target} failed:\n${res.stderr || res.stdout}`,
    );
  }
  return { bytes: readFileSync(out), path: out };
}

/** Extract a zip's files into destDir. */
async function extractZip(bytes, destDir) {
  const zip = await JSZip.loadAsync(bytes);
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const full = join(destDir, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, await entry.async("nodebuffer"));
  }
}

/** Serve a directory of static files; returns { baseURL, close }. */
async function serveDir(dir) {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = join(dir, rel === "/" ? "index.html" : rel);
    try {
      const buf = readFileSync(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(buf);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  return { baseURL: `http://localhost:${port}`, close: () => server.close() };
}

// ── assertions ────────────────────────────────────────────────────────────────
/** Compare a RegistrationSchema-shaped result against scenario.expect. */
function assertResult(reg, expect) {
  const completion = reg.registrationCompletion ?? "UNKNOWN";
  const success = reg.registrationSuccess ?? "UNKNOWN";
  // SCORM Cloud reports score.scaled on a 0–100 scale (e.g. 100 for a perfect
  // score); our expectations + the web localStorage record use 0–1. Normalize.
  const rawScaled = reg.score?.scaled;
  const scaled = rawScaled != null && rawScaled > 1 ? rawScaled / 100 : rawScaled;
  const problems = [];
  if (expect.completion && completion !== expect.completion)
    problems.push(`completion: expected ${expect.completion}, got ${completion}`);
  if (expect.success && success !== expect.success)
    problems.push(`success: expected ${expect.success}, got ${success}`);
  if (expect.scaled != null && (scaled == null || Math.abs(scaled - expect.scaled) > 0.01))
    problems.push(`score.scaled: expected ~${expect.scaled}, got ${scaled ?? "(none)"}`);
  if (expect.softCompletionNot && completion === expect.softCompletionNot)
    log(
      `  ⚠ soft check: completion=${completion} (expected ≠ ${expect.softCompletionNot}) — review adapter mapping`,
    );
  return problems;
}

/** Map the standalone web localStorage record onto the RegistrationSchema shape. */
function webRecordToReg(record) {
  return {
    registrationCompletion: record.completion === "completed" ? "COMPLETED" : "INCOMPLETE",
    registrationSuccess:
      record.success === "passed" ? "PASSED" : record.success === "failed" ? "FAILED" : "UNKNOWN",
    score: record.score != null ? { scaled: record.score } : undefined,
  };
}

// ── local web driver (dry-run + failure-diff artifact) ─────────────────────────
/**
 * Build + serve the web package, drive the scenario, return the localStorage
 * record (and, if the scenario has a resume step, run it after a reload).
 */
async function driveOnWeb(browser, example, scenario) {
  const ex = EXAMPLES.find((e) => e.example === example);
  const { bytes } = packageCourse(ex.dir, "web");
  const dir = mkdtempSync(join(tmpdir(), "oelt-cloud-web-"));
  await extractZip(bytes, dir);
  const srv = await serveDir(dir);
  const context = await browser.newContext();
  const page = await context.newPage();
  const courseId = loadCourseId(ex.dir);
  try {
    await page.goto(`${srv.baseURL}/index.html`, { waitUntil: "load" });
    const frame = await findContentFrame(page);
    const ctx = makeContext(page, frame);
    await scenario.drive(ctx);
    await ctx.terminate();
    const record = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
      `oelt:web:${courseId}`,
    );
    if (scenario.resume) {
      await page.reload({ waitUntil: "load" });
      const frame2 = await findContentFrame(page);
      await scenario.resume(makeContext(page, frame2));
    }
    return record;
  } finally {
    await context.close();
    srv.close();
  }
}

function loadCourseId(exampleDir) {
  const c = JSON.parse(readFileSync(join(ROOT, exampleDir, "course.json"), "utf8"));
  return c.id;
}

// ── live SCORM Cloud driver ─────────────────────────────────────────────────────
async function driveOnCloud(
  browser,
  client,
  registrationId,
  scenario,
  artifactsDir,
  label,
  example,
) {
  const context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true });
  // Capture browser console + page errors across all pages (incl. the popup) —
  // the runtime emits "SCORM 2004 API not found" etc. here, and a failed cmi5
  // adapter.start() surfaces as a page error. Written to the failure artifact.
  const consoleLog = [];
  context.on("console", (m) => consoleLog.push(`[${m.type()}] ${m.text()}`));
  context.on("pageerror", (e) => consoleLog.push(`[pageerror] ${e.message}`));
  const launcher = await context.newPage();
  let target = launcher; // the page hosting the course (popup or launcher)
  let detectedTarget = null; // window.oelt.target as the runtime auto-detected it
  let problems = [];
  let saveTrace = false;
  try {
    const launchUrl = await client.buildLaunchLink(registrationId);
    target = await openCourseWindow(context, launcher, launchUrl);
    const frame = await findContentFrame(target);
    const ctx = makeContext(target, frame);
    // Which adapter did the runtime pick on the real LMS? A "web" here means
    // SCORM API discovery failed and tracking silently went to localStorage.
    detectedTarget = await frame.evaluate(() => window.oelt?.target).catch(() => null);
    await scenario.drive(ctx);
    await ctx.terminate();
    await sleep(1500); // let the final LMSCommit/Terminate flush to the LMS

    // Poll until the result matches what we expect (Cloud commits asynchronously).
    const reg = await client.waitForRegistration(registrationId, (r) => {
      if (scenario.expect.completion)
        return r.registrationCompletion === scenario.expect.completion;
      if (scenario.expect.success) return r.registrationSuccess === scenario.expect.success;
      return true;
    });
    problems = assertResult(reg, scenario.expect);

    // Resume round-trip: relaunch the SAME registration and verify state restored.
    if (scenario.resume && problems.length === 0) {
      const resumeLauncher = await context.newPage();
      let resumeTarget = resumeLauncher;
      try {
        const resumeUrl = await client.buildLaunchLink(registrationId);
        resumeTarget = await openCourseWindow(context, resumeLauncher, resumeUrl);
        const rFrame = await findContentFrame(resumeTarget);
        await scenario.resume(makeContext(resumeTarget, rFrame));
        await resumeTarget.evaluate(() => window.oelt?.terminate?.());
        // Completion must not be downgraded by the resume.
        const after = await client.getRegistration(registrationId);
        if (
          scenario.expect.completion &&
          after.registrationCompletion !== scenario.expect.completion
        ) {
          problems.push(
            `resume downgraded completion to ${after.registrationCompletion} (expected ${scenario.expect.completion})`,
          );
        }
      } finally {
        if (!resumeTarget.isClosed()) await resumeTarget.close();
        if (!resumeLauncher.isClosed()) await resumeLauncher.close();
      }
    }

    if (problems.length) {
      saveTrace = true;
      await writeFailureArtifacts(browser, client, registrationId, scenario, artifactsDir, label, {
        page: target,
        example,
        problems,
        detectedTarget,
        consoleLog,
      });
    }
  } catch (err) {
    saveTrace = true;
    problems.push(`exception: ${err.message}`);
    try {
      await writeFailureArtifacts(browser, client, registrationId, scenario, artifactsDir, label, {
        page: target,
        example,
        problems,
        detectedTarget,
        consoleLog,
      });
    } catch (e2) {
      log(`  (failed to write artifacts: ${e2.message})`);
    }
  } finally {
    if (saveTrace) {
      mkdirSync(artifactsDir, { recursive: true });
      await context.tracing.stop({ path: join(artifactsDir, `${label}.trace.zip`) });
    } else {
      await context.tracing.stop();
    }
    await context.close();
  }
  return { label, ok: problems.length === 0, problems };
}

/**
 * Failure artifacts (Task 10): the registration's runtime/activity detail from
 * the API, a screenshot, the Playwright trace (saved by the caller), AND a local
 * web run of the same playthrough for diffing ("works locally, fails in Cloud").
 */
async function writeFailureArtifacts(
  browser,
  client,
  registrationId,
  scenario,
  artifactsDir,
  label,
  { page, example, problems, detectedTarget = null, consoleLog = [] },
) {
  mkdirSync(artifactsDir, { recursive: true });
  // diag: the adapter the runtime auto-detected on the LMS + browser console.
  // A detectedTarget of "web" (when an LMS target was expected) means SCORM API
  // discovery failed and tracking silently went to localStorage instead.
  const diag = { problems, detectedTarget, consoleLog };
  try {
    const reg = await client.getRegistration(registrationId, {
      includeChildResults: true,
      includeRuntime: true,
    });
    writeFileSync(
      join(artifactsDir, `${label}.cloud.json`),
      JSON.stringify({ ...diag, registration: reg }, null, 2),
    );
  } catch (e) {
    writeFileSync(
      join(artifactsDir, `${label}.cloud.json`),
      JSON.stringify({ ...diag, error: e.message }, null, 2),
    );
  }
  try {
    if (page && !page.isClosed())
      await page.screenshot({ path: join(artifactsDir, `${label}.png`), fullPage: true });
  } catch {
    /* page may be on a redirect target */
  }
  // Local diff baseline: drive the same scenario against the web package locally.
  try {
    const record = await driveOnWeb(browser, example, { ...scenario, resume: undefined });
    writeFileSync(
      join(artifactsDir, `${label}.local-web.json`),
      JSON.stringify(
        {
          note: "local web run of the same playthrough for diffing",
          record,
          mapped: webRecordToReg(record),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    log(`  (local-web diff run failed: ${e.message})`);
  }
}

// ── modes ──────────────────────────────────────────────────────────────────────
function selectMatrix(flags) {
  let examples = EXAMPLES;
  if (flags.example) examples = examples.filter((e) => e.example === flags.example);
  return examples.map((e) => ({
    ...e,
    targets: flags.target ? e.targets.filter((t) => t === flags.target) : e.targets,
  }));
}

async function runDryRun(flags) {
  log(
    "SCORM Cloud runner — DRY RUN (local web target + localStorage; no Cloud, no credentials).\n",
  );
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const ex of selectMatrix(flags)) {
      for (const sc of ex.scenarios) {
        const label = `${ex.example}-${sc.name}`;
        log(`▶ ${label} (web)`);
        try {
          const record = await driveOnWeb(browser, ex.example, sc);
          const problems = assertResult(webRecordToReg(record), sc.expect);
          results.push({ label, ok: !problems.length, problems });
          log(problems.length ? `  ✗ ${problems.join("; ")}` : `  ✓ ${JSON.stringify(record)}`);
        } catch (err) {
          results.push({ label, ok: false, problems: [err.message] });
          log(`  ✗ ${err.message}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function runLive(flags) {
  const appId = process.env.SCORM_CLOUD_APP_ID;
  const secretKey = process.env.SCORM_CLOUD_SECRET_KEY;
  if (!appId || !secretKey) {
    log("⏭  SCORM_CLOUD_APP_ID / SCORM_CLOUD_SECRET_KEY not set — skipping the SCORM Cloud");
    log("   conformance run (expected on fork PRs and local runs without credentials).");
    log("   Tip: `node scripts/scorm-cloud/run.mjs --dry-run` exercises the playthroughs locally.");
    return null; // signal: skipped, not failed
  }

  const sha = (process.env.GITHUB_SHA ?? "local").slice(0, 8);
  const runId = process.env.GITHUB_RUN_ID ?? String(Date.now());
  const coursePrefix = `oelt-ci-${sha}`;
  const artifactsDir = join(ROOT, "scorm-cloud-artifacts");

  log(`SCORM Cloud conformance run — sha=${sha} runId=${runId}\n`);
  const client = new ScormCloudClient({ appId, secretKey });
  const browser = await chromium.launch();
  const results = [];

  try {
    for (const ex of selectMatrix(flags)) {
      for (const target of ex.targets) {
        const courseId = `${coursePrefix}-${ex.example}-${target}-${runId}`;
        const createdRegs = [];
        log(`▶ ${ex.example} / ${target} — courseId=${courseId}`);
        try {
          const { bytes } = packageCourse(ex.dir, target);
          const jobId = await client.importCourse(courseId, bytes, `${ex.example}-${target}.zip`);
          await client.waitForImport(jobId);
          log(`  imported (job ${jobId})`);

          for (const sc of ex.scenarios) {
            const registrationId = `${courseId}-${sc.name}`;
            const label = `${ex.example}-${target}-${sc.name}`;
            await client.createRegistration({ courseId, registrationId, learner: LEARNER });
            createdRegs.push(registrationId);
            log(`  ▶ scenario "${sc.name}" — reg=${registrationId}`);
            const r = await driveOnCloud(
              browser,
              client,
              registrationId,
              sc,
              artifactsDir,
              label,
              ex.example,
            );
            results.push(r);
            log(r.ok ? `    ✓ ${label}` : `    ✗ ${label}: ${r.problems.join("; ")}`);
          }
        } catch (err) {
          results.push({ label: `${ex.example}-${target}`, ok: false, problems: [err.message] });
          log(`  ✗ ${ex.example}/${target}: ${err.message}`);
        } finally {
          // Always clean up — even on failure (registration quota).
          if (!flags.keep) {
            for (const reg of createdRegs) await client.deleteRegistration(reg).catch(() => {});
            await client.deleteCourse(courseId).catch(() => {});
            log(`  cleaned up course + ${createdRegs.length} registration(s)`);
          } else {
            log(
              `  --keep: left course ${courseId} + ${createdRegs.length} registration(s) on SCORM Cloud`,
            );
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

// ── entry ──────────────────────────────────────────────────────────────────────
async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const results = flags.dryRun ? await runDryRun(flags) : await runLive(flags);

  if (results === null) process.exit(0); // skipped (no credentials)

  const failed = results.filter((r) => !r.ok);
  log("\n── summary ──────────────────────────────────────────");
  for (const r of results)
    log(`  ${r.ok ? "✓" : "✗"} ${r.label}${r.ok ? "" : " — " + r.problems.join("; ")}`);
  log(`  ${results.length - failed.length}/${results.length} passed`);

  if (failed.length) {
    log("\nSome conformance checks failed. If a course passes locally (--dry-run) but");
    log("fails on Cloud, the zero-dep adapter may mishandle a target quirk — reopen");
    log("OQ-001 in specs/OPEN-QUESTIONS.md with the artifacts as evidence (Task 10).");
    process.exit(1);
  }
  log("  All clear — the zero-dep adapters conform across examples × targets.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
