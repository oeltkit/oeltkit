# SCORM Cloud conformance runner

The real-LMS regression net (Task 10). It packages every example course for each
LMS target, imports it to **SCORM Cloud**, drives a deterministic playthrough
with Playwright, and asserts the result over the **v2 REST API**. The green
weekly run is the standing proof that OELT's zero-dependency adapters (decision
[OQ-001](../../specs/OPEN-QUESTIONS.md)) keep conforming on a real LMS.

## What it does

For each `example × target` in the matrix (`playthroughs.mjs`):

1. `oelt package <example> --target <scorm12|scorm2004|cmi5>` (via the built CLI).
2. Import the zip as a course (`oelt-ci-<sha>-<example>-<target>-<runId>`).
3. For each scenario: create a registration, get a launch link, open it with
   Playwright, run the committed playthrough (selectors + answers), and
   **terminate** so the LMS commits.
4. Assert over the API: `registrationCompletion`, `registrationSuccess`, and
   `score.scaled`.
5. On the `pass` scenario for `spike`, **relaunch the same registration** and
   verify suspend/location round-trip (resume lands on the saved page with state
   intact) and that completion is not downgraded.
6. **Always tear down** — delete every registration and the course, even on
   failure. SCORM Cloud dev tiers cap registrations; we create one per
   course-target-scenario per run and never leak them.

The matrix deliberately includes a **failing-score variant** (`spike` / `fail`):
a wrong answer scores 0.5 < mastery 0.8, so the mastery gate must report
`FAILED`. This proves the gate actually gates. `examples/minimal` is web-only
(declares no LMS target), so it is excluded — the runner logs nothing for it.

## Files

| File               | Role                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `client.mjs`       | Thin `fetch` wrapper over the SCORM Cloud v2 REST API (dev-only) |
| `driver.mjs`       | Playwright content-frame discovery + playthrough helpers         |
| `playthroughs.mjs` | The matrix + committed per-example playthrough scripts           |
| `run.mjs`          | Orchestrator (live + `--dry-run`), teardown, failure artifacts   |

### Why a hand-written client, not the official SDK

The official `@rusticisoftware/scormcloud-api-v2-client-javascript` is a
swagger-codegen `1.0.0-beta` (superagent/callback-based, browser+node, no longer
actively maintained). For the seven calls we make, a ~150-line `fetch` wrapper is
clearer and avoids a dependency. It is a **dev/CI script only** — never imported
by `@oeltkit/runtime` or `@oeltkit/components`, never shipped (CLAUDE.md rule 1).

## Running it

### Locally, with no credentials (`--dry-run`)

```bash
npm run build
npx playwright install chromium      # first time only
node scripts/scorm-cloud/run.mjs --dry-run
```

Dry-run packages the **web** target, serves it locally, and drives the _same_
playthroughs, asserting against the standalone `localStorage` record. This
verifies the playthroughs reach their expected outcome **without** SCORM Cloud.
It does **not** exercise the SCORM/cmi5 adapters — that is exactly what the live
run against Cloud is for.

### Locally, against your own SCORM Cloud dev app (live)

1. Create a SCORM Cloud Application dedicated to testing and copy its
   **Application ID** + a read/write **Secret Key**.
2. Export them and run:

   ```bash
   export SCORM_CLOUD_APP_ID=...        # never commit these
   export SCORM_CLOUD_SECRET_KEY=...
   npm run build
   npx playwright install --with-deps chromium
   node scripts/scorm-cloud/run.mjs --example spike --target scorm12
   ```

Flags: `--dry-run`, `--example <name>`, `--target <scorm12|scorm2004|cmi5>`,
`--keep` (leave courses/registrations on Cloud for debugging — remember the
quota).

### In CI

`.github/workflows/scorm-cloud.yml` runs on **`workflow_dispatch` (manual)** and
**weekly** (Mondays 06:17 UTC) only — it is intentionally NOT triggered on push
or PR, because a full run creates ~7 registrations and the SCORM Cloud account
has a lifetime registration cap. After changing `packages/runtime`,
`packages/cli`, or this pipeline, trigger a run manually (Actions → "SCORM Cloud
conformance" → Run workflow). If `SCORM_CLOUD_APP_ID` / `SCORM_CLOUD_SECRET_KEY`
are absent (fork PRs), the runner **skips with a notice and exits 0** — it never
fails the build, and the rest of CI works with no credentials.

## Failure artifacts

When an assertion fails, the runner writes to `scorm-cloud-artifacts/` (uploaded
by CI on failure):

- `<label>.cloud.json` — the registration's runtime/activity detail from the API.
- `<label>.png` — a screenshot of the launched course.
- `<label>.trace.zip` — the Playwright trace (open with `npx playwright show-trace`).
- `<label>.local-web.json` — a local web run of the **same** playthrough, for
  diffing. **"Works locally, fails on Cloud"** is the high-value signal: it means
  the adapter mishandles a target quirk (reopen OQ-001 with the evidence) or the
  fake-LMS harness needs a fidelity fix.

## API reference (verified June 2026)

- Base: `https://cloud.scorm.com/api/v2/` — Basic auth, `base64("<APP_ID>:<SECRET_KEY>")`.
  - <https://cloud.scorm.com/docs/v2/reference/api_overview/>
  - <https://cloud.scorm.com/docs/v2/knowledge_base/authentication_types/>
- Endpoints used are documented inline in `client.mjs`.
