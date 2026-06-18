// Committed playthrough scripts — selectors + answers that deterministically
// drive each example course to a known outcome, plus the expected API result.
//
// These are the contract the SCORM Cloud regression net checks: if a course
// can't be driven to its expected outcome here, that's a gap to fix in the
// course/runtime — never loosen the assertion (Task 10).
//
// Selectors mirror the proven paths in harness/package.spec.ts and
// harness/components.spec.ts. The generated player exposes #oelt-toc / #oelt-page
// (see packages/cli/src/lib/generators.ts).

export const LEARNER = { id: "oelt-ci-bot", firstName: "OELT", lastName: "CI" };

// Only LMS targets are exercised on SCORM Cloud; the standalone `web` target is
// covered by harness/package.spec.ts. `examples/minimal` declares only `web`, so
// it is intentionally absent here (run.mjs logs the skip).
export const CLOUD_TARGETS = ["scorm12", "scorm2004", "cmi5"];

// Targets with a tracked, not-yet-resolved real-LMS conformance gap. Their
// failures are reported as ⚠ gaps (with the OQ reference) and do NOT fail the
// run — so the net stays green on conformant targets while keeping the gap
// visible. Remove a target here once it conforms.
export const KNOWN_GAPS = {
  scorm2004:
    "OQ-004 — SCO reports completed/passed and commits (verified via live RTE), but SCORM Cloud will not roll it up to the registration; no content-side library exists. Parked.",
};

// ── spike playthroughs ─────────────────────────────────────────────────────────

/** Pass the quiz: completion via required-interactions-passed, score 1.0 ≥ mastery 0.8. */
async function spikePass(ctx) {
  await ctx.expectH1("Introduction");
  await ctx.toc("3. Quiz");
  await ctx.expectH1("Quiz");
  await ctx.clickButton(/four targets/);
}

/**
 * Pass, then author state + leave on a mid-course page so the resume relaunch can
 * prove suspend/location round-trip (mirrors the spike.spec resume test).
 */
async function spikePassThenSuspend(ctx) {
  await spikePass(ctx);
  await ctx.setState("note", "remember-me");
  await ctx.toc("2. Key idea");
  await ctx.expectH1("Key idea");
}

/** After a relaunch of the SAME registration: resumed page + restored state. */
async function spikeVerifyResume(ctx) {
  await ctx.expectH1("Key idea"); // resumed to the saved location
  const page = await ctx.currentPage();
  if (page !== 1) throw new Error(`resume: expected nav.current()===1, got ${page}`);
  const note = await ctx.getState("note");
  if (note !== "remember-me")
    throw new Error(`resume: expected note "remember-me", got ${JSON.stringify(note)}`);
}

/** Fail the mastery gate: wrong answer → score 0.5 < mastery 0.8 ⇒ failed. */
async function spikeFail(ctx) {
  await ctx.expectH1("Introduction");
  await ctx.toc("3. Quiz");
  await ctx.expectH1("Quiz");
  await ctx.clickButton(/incorrect/);
}

// ── components-demo playthrough ─────────────────────────────────────────────────

/** Completion rule is the default `all-pages-viewed` — visit every page. */
async function componentsViewAll(ctx) {
  const count = await ctx.pageCount();
  for (let i = 0; i < count; i++) {
    await ctx.frame.locator(`#oelt-toc button[data-i="${i}"]`).click();
    await ctx.frame.locator("#oelt-page h1").first().waitFor();
  }
}

// ── matrix ──────────────────────────────────────────────────────────────────────

export const EXAMPLES = [
  {
    example: "spike",
    dir: "examples/spike",
    targets: CLOUD_TARGETS,
    scenarios: [
      {
        name: "pass",
        drive: spikePassThenSuspend,
        // score.scaled is normalized 0..1; spike scores 1.0.
        expect: { completion: "COMPLETED", success: "PASSED", scaled: 1 },
        resume: spikeVerifyResume, // relaunch the same registration and verify
      },
      {
        name: "fail",
        drive: spikeFail,
        // The mastery gate must gate: success FAILED, score 0.5. SCORM 1.2 reports
        // lesson_status "failed"; whether Cloud surfaces that as INCOMPLETE vs
        // COMPLETED is target-dependent, so completion is a soft (warn-only) check.
        expect: { success: "FAILED", scaled: 0.5, softCompletionNot: "COMPLETED" },
      },
    ],
  },
  {
    example: "components-demo",
    dir: "examples/components-demo",
    targets: CLOUD_TARGETS,
    scenarios: [
      {
        name: "pass",
        drive: componentsViewAll,
        // No mastery defined → completion only (success/score UNKNOWN).
        expect: { completion: "COMPLETED" },
      },
    ],
  },
];
