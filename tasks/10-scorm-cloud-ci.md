# Task 10 — SCORM Cloud CI (real-LMS regression net)

**Prerequisites:** exit gate passed ✅; a SCORM Cloud account with an Application created, and its **App ID + Secret Key** added as CI secrets (see "Credentials setup" at the bottom — Jim does this once). Independent — runs parallel to 08/09.

> **Note on OQ-001:** already **closed (keep zero-dep adapters), 2026-06-14**, arbitrated by the exit gate (a fresh-session SCORM 1.2 package imported, completed, and scored cleanly on SCORM Cloud across two LLM clients). This task is **not** about re-deciding that — it builds the **automated regression net that keeps the decision honest**. If CI later surfaces 1.2/2004/cmi5 quirks the hand-written adapters mishandle, **reopen OQ-001** in `specs/OPEN-QUESTIONS.md` with the evidence and a recommendation (patch the adapter vs. adopt `scorm-again`).

**Session prompt for Claude Code:**

---

Wire real-LMS conformance into CI against the **SCORM Cloud v2 REST API**. Commit straight to `main`; the green CI job is the gate.

**API approach (verify against current docs; cite doc URLs in code comments):**
- v2 REST API, base `https://cloud.scorm.com/api/v2/`. Auth is HTTP Basic: Base64-encode `"<APP_ID>:<SECRET_KEY>"` into the `Authorization: Basic …` header. Everything is scoped to the application.
- First **investigate whether a currently-maintained Node/JS client exists**; if not, write a thin `fetch` wrapper (no heavy SDK — keep it a dev-only script, never a runtime dep). Core calls needed: import/create course, create registration, get the launch link, fetch registration result/progress, fetch the registration's runtime/activity detail, and delete course + registration.
- Docs: `https://cloud.scorm.com/docs/v2/reference/api_overview/`, `https://cloud.scorm.com/docs/v2/tutorials/getting_started/getting_started/`, `https://cloud.scorm.com/docs/v2/knowledge_base/authentication_types/`.

**Pipeline (script in `scripts/scorm-cloud/`, orchestrated from a GitHub Actions job):**

1. For every example course, `oelt package` it for **scorm12 + scorm2004 + cmi5**.
2. For each package: import as a course (unique id per run, e.g. `oelt-ci-<sha>-<example>-<target>`), create a registration (unique id), fetch the launch URL.
3. **Drive a deterministic completion headlessly** with Playwright against the launch URL — click through pages and answer the quiz to deliberately *pass* the mastery threshold. Each example needs a small committed "playthrough script" (selectors + answers). If a course can't be driven deterministically to completion, that's a gap — fix the course/example, don't loosen the assertion.
4. **Assert via API:** completion status = completed, success/score reflects the passing playthrough, and on a **relaunch** the suspend-data round-trips (resume lands where it left off). Add a failing-score variant for at least one example to prove the mastery gate actually gates.
5. **Always clean up** (teardown that runs even on failure): delete the test registration and course. SCORM Cloud dev tiers cap registrations — minimize them (one per course-target per run) and never leak them, or runs will start failing on quota.

**Triggers:** `workflow_dispatch` (manual) + a **weekly** `schedule` (cron) + push/PR **path-filtered** to `packages/runtime/**` and `packages/cli/**` (the surfaces that affect packaged output). **Do not run on every push** — it would burn the registration quota.

**Failure artifacts:** upload Playwright screenshots/video/trace, the registration's runtime/activity log fetched from the API, **and** the local harness run of the same course for diffing. "Works in harness, fails in Cloud" is the high-value signal — it means the fake LMS needs a fidelity fix; file it as an issue.

**Secrets & no-credential path (per CLAUDE.md):** read `SCORM_CLOUD_APP_ID` / `SCORM_CLOUD_SECRET_KEY` from CI secrets only — never in the repo. If the secrets are absent (e.g. fork PRs, local runs), the job/script must **skip with a clear notice**, not fail. The harness and all other tests must keep working with no credentials.

**Adapter regression:** if a Cloud run surfaces a quirk the zero-dep adapters mishandle, reopen OQ-001 (see note above) with the evidence; if clean across all examples and targets, the green run is the standing proof the decision holds.

Self-check per CLAUDE.md; document the workflow + how to run it locally with a personal dev app in `docs/` (or a `scripts/scorm-cloud/README.md`).

---

**Async spot-check (non-blocking, one-time):** eyeball one full Cloud run's artifacts to confirm the assertions test what we think they test — a course that "passes" by asserting nothing is the trap. Confirm the failing-score variant actually fails.

## Credentials setup (Jim, once)

1. Log in at **scorm.com** → SCORM Cloud → **Apps & Registrations → Applications** (or "API Access").
2. Create/identify an Application dedicated to CI (so production data stays separate). Copy its **Application ID**.
3. Under that app's **Authorization Keys / Secret Keys**, create a key with read+write scope and copy the **Secret Key** (shown once).
4. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret** — add `SCORM_CLOUD_APP_ID` and `SCORM_CLOUD_SECRET_KEY`.
5. Note the dev-tier registration limit on that account so the weekly matrix stays under it (cleanup keeps active registrations near zero, but there may be a monthly *created* cap).
