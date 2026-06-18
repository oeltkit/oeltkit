# Open Questions

When a spec is ambiguous: for a local, reversible call, decide it and log it here as `DECIDED:` (CLAUDE.md workflow rule 6); only park an unresolved **Open** entry when the ambiguity is cross-cutting (manifest schema, tracking semantics) where a wrong guess is expensive to unwind. The resolution then flows back into the relevant spec in the same commit.

## How to use

- Add a new entry under **Open** using the template below. Give it a stable id (`OQ-NNN`).
- Link the spec section and the task/PR that surfaced it.
- When resolved, move the entry to **Resolved**, record the decision and date, and update the spec in the same change.

### Template

```
### OQ-NNN — <short title>
- **Context:** which spec/section, which task or PR surfaced this
- **Question:** the precise ambiguity (not a general musing)
- **Options considered:** A / B / C with one-line trade-offs
- **Blocking?:** yes/no — what is blocked
- **Proposed default:** what we'd do if forced to choose (so work can continue if non-blocking)
```

---

## Open

### OQ-004 — SCORM 2004 + cmi5 real-LMS conformance — cmi5 RESOLVED (@xapi/cmi5), SCORM 2004 PARKED — REOPENS OQ-001

- **Context:** `packages/runtime/adapters/{scorm2004,cmi5}.ts` + `packages/cli` manifest generation; surfaced by Task 10's SCORM Cloud regression net (the first time 2004/cmi5 ran on a real LMS — the Phase 0 exit gate only exercised SCORM 1.2).
- **Question:** OQ-001 kept the zero-dependency adapters, arbitrated solely by a passing **SCORM 1.2** run. The net now exercises all three LMS targets on SCORM Cloud and **1.2 passes but 2004 and cmi5 do not.** Patch the hand-written adapters/manifests, or adopt the permitted libraries (`scorm-again` for SCORM RTE, `@xapi/cmi5` for cmi5)?
- **Evidence (run 27762927481 + 27704984706, artifacts in CI):**
  - **SCORM 1.2 — ✅ conformant.** completion `COMPLETED`, success `PASSED`, score correct on the real LMS (pass + fail variants).
  - **SCORM 2004 — 🔴 reports correctly but does not roll up.** The content-frame read-back of the live RTE just before terminate shows the adapter set everything and the LMS accepted it: `cmi.completion_status=completed`, `cmi.success_status=passed`, `cmi.score.scaled=1`, `GetLastError()=0`. `state.commit()` calls `Commit()` after every mutation. Yet the REST registration (and the activity itself) report `registrationCompletion=UNKNOWN`, no score. **Root cause:** the generated `imsmanifest.xml` (scorm2004) has no `<imsss:sequencing>` — no primary objective / rollup rules / `adlcp:completionThreshold` — so SCORM Cloud never promotes the SCO's reported status to the activity/registration. SCORM 1.2 has no rollup model (its `lesson_status` _is_ the status), which is why 1.2 works and 2004 doesn't.
  - **cmi5 — 🔴 AU never renders.** Import succeeds (after the OQ-003 IRI fix). The player chrome renders but the page body is empty and there is no position indicator → `rt.start()` never completes → the cmi5 `adapter.start()` (auth-token fetch + `LMS.LaunchData` read) throws on the real LRS. Exact failure not yet captured (needs one diagnostic run with the new console capture); candidate causes: token/State endpoint response shape or CORS from the AU origin.
- **Blocking?:** was yes; cmi5 now resolved, SCORM 2004 parked (tracked, non-blocking). The net (Task 10) itself is complete and is what surfaced this.
- **Resolution (2026-06-18):**
  - **cmi5 — ✅ RESOLVED, conformant on SCORM Cloud (runs 27767973728 + 27768125599).** Two bugs: (1) the launch `endpoint` lacked a trailing slash, so `start()` threw and the AU never rendered — fixed by normalizing the endpoint; with that, the AU rendered but the hand-written client's statements were rejected (400/403). (2) Adopted **`@xapi/cmi5`** (hard-rule 1 amended to permit it; costs ~12 KB → ~97 KB runtime bundle from `axios`/`@xapi/xapi`). A final ordering bug — `completed` + `passed` fired concurrently let `passed` arrive out of order and get dropped — fixed by serializing the statement sends. cmi5 pass + fail now report COMPLETED/PASSED/FAILED + score correctly.
  - **SCORM 2004 — ⏸ PARKED (still open).** The manifest `<imsss:deliveryControls completionSetByContent/objectiveSetByContent="true">` fix did **not** work: the live RTE still reads `completion_status=completed, success_status=passed, score.scaled=1, lastError=0`, but SCORM Cloud still reports the registration `UNKNOWN`. There is **no content-side library** for SCORM 2004 (`scorm-again` is LMS-side — confirmed against its README — so it does not fit OELT's content-side runtime), so this needs further hand-debugging of the 2004 rollup (candidates: `cmi.exit`, a primary objective with `minNormalizedMeasure`, `adlcp:completionThreshold`). Tracked as a **known gap** in `scripts/scorm-cloud/playthroughs.mjs` (`KNOWN_GAPS.scorm2004`): the net reports it as a ⚠ gap and does not fail on it. SCORM 1.2 + cmi5 + web are conformant.
  - **scorm-again is NOT adopted** (wrong side of the API).
- **Remaining:** resolve the SCORM 2004 registration rollup, then remove `scorm2004` from `KNOWN_GAPS`.

## Resolved

### OQ-001 — Adopt `scorm-again` / `@xapi/cmi5`, or keep zero-dep content-side clients? — RESOLVED (keep zero-dep), 2026-06-14 · **REOPENED 2026-06-18, see OQ-004**

> **Reopened (2026-06-18):** the 2026-06-14 decision was arbitrated by a SCORM **1.2**-only exit-gate run. Task 10's net ran all three LMS targets on SCORM Cloud: 1.2 passes, **2004 and cmi5 initially failed real-LMS conformance** (evidence + resolution in OQ-004). Note: the "scorm-again is LMS-side only" finding below is **correct** (re-confirmed against its README) — it does not fit the content-side runtime, so the 2004 fix was a manifest change, not a library. Only `@xapi/cmi5` is a candidate dependency, and only if the cmi5 patch proves insufficient.

- **Context:** `specs/` runtime; surfaced by Task 03 (runtime spike). CLAUDE.md hard-rule 1 _permits_ `scorm-again` and `@xapi/*` as runtime deps; it does not require them.
- **Question:** Should `@oeltkit/runtime` depend on `scorm-again` and/or `@xapi/cmi5`, or keep the hand-written zero-dependency content-side adapters introduced in the spike?
- **Findings (evaluated during the spike):**
  - **`scorm-again` is LMS-side** — it _provides_ `window.API` / `window.API_1484_11` and commits to a backend URL (exactly what the harness does). It is **not** a content-side wrapper that discovers and calls an LMS-provided API. OELT's runtime is content-side, so "wrapping" it does not fit the adapter role. (It _would_ be the right tool for the harness's fake API or a future self-hosted-standalone packaging mode.)
  - **`@xapi/cmi5` is AU/content-side and cmi5-conformant** — it _does_ fit, but depends on `@xapi/xapi`, adding bundle weight against the ~30 KB runtime target. The cmi5 wire protocol is small and already validated end-to-end by the harness.
- **Decision (Jim, 2026-06-14):** Keep the zero-dependency content-side adapters (`adapters/{scorm12,scorm2004,cmi5,web}.ts`). **Arbitrated by the Phase 0 exit gate:** a fresh-session SCORM 1.2 package imported, completed, and scored correctly on SCORM Cloud across two different LLM clients with no hand-fixing — the hand-written adapters pass real-LMS conformance, so there's no case for pulling in `scorm-again`. Revisit `@xapi/cmi5` only if cmi5 statement/State edge cases (attachments, batching, auth refresh) later outgrow the minimal client.

### OQ-003 — cmi5/xAPI activity IRI for a reverse-DNS `course.id` — DECIDED (synthesize under oeltkit namespace), 2026-06-17

- **Context:** `packages/cli` cmi5 manifest generation + `runtime/adapters/cmi5.ts`; surfaced by Task 10's second live SCORM Cloud run.
- **Question:** cmi5 (and xAPI) require the course/AU `id` to be an **absolute IRI**, and the AU id becomes the xAPI activity id the LMS hands the AU at launch. But `course.id` is a reverse-DNS string (e.g. `org.oeltkit.spike`), which is not a URI — SCORM Cloud rejects the import (`Activity ID 'org.oeltkit.spike' is not an absolute URI`).
- **Options considered:** (a) require authors to write a URI `course.id` — breaks SCORM/cmi5 parity and existing examples; (b) synthesize an IRI from `course.id` only for cmi5; (c) URN scheme (`urn:oelt:<id>`) — valid but less conventional for xAPI.
- **Blocking?:** no — local to the cmi5 surface and reversible.
- **Decision:** option (b). `courseActivityIri(id)` keeps an author-supplied absolute IRI as-is, else mints `https://oeltkit.org/cmi5/<id>` (AU = `<that>/au`). The runtime needs no change: the cmi5 adapter already reads `activityId` from the launch parameters, so it uses whatever IRI the LMS derived from the AU id. The harness keeps using `course.id` internally (its own fake-launch identity) — unaffected. If a course-structure/identity spec later formalizes activity ids, fold this in there.

### OQ-002 — `<oelt-branching>` loops vs the suspend-state cap — RESOLVED (c), 2026-06-11

- **Context:** [`components/branching.md`](./components/branching.md) §8; surfaced by Task 04 spec drafting.
- **Question:** A scenario with cycles ("try again" returning to an earlier node) grows the stored visited path, which competes with the 256-byte component state cap and the 3 KB suspend budget.
- **Decision (Jim, "proceed"):** option (c) — store **current node + a visited-set** (unique node ids) for resume; emit **each branch-take as an interaction** so ordered analytics live in the LRS, not in suspend. Bounded by node count, not by loop count. Reflected in branching.md §5/§8.
