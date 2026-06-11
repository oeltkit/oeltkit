# Task 03 — Runtime tracking spike (the thesis test, part 1)

**Prerequisites:** Tasks 01–02 merged.

**Session prompt for Claude Code:**

---

Implement the first vertical slice of `@oeltkit/runtime` per `specs/manifest-v0.md` and `specs/tracking-semantics.md`. Goal: **one example course produces correct tracking in all four harness modes from identical content.**

Scope:

1. **Adapter layer:** `adapters/scorm12.ts`, `adapters/scorm2004.ts` (wrap `scorm-again`), `adapters/cmi5.ts` (evaluate `@xapi/cmi5` v1.4 — if it fights the spec, write a minimal client and note why in `specs/OPEN-QUESTIONS.md`), `adapters/web.ts` (localStorage). Auto-detection per launch context.
2. **Public API:** `oelt.track.{complete, score, progress, interaction}`, `oelt.state.{get,set}` (suspend round-trip, quota-enforced), `oelt.nav.{pages, current, go}` driven by `course.json`.
3. **Tracking rules engine:** implement the rule vocabulary from the tracking spec, including the SCORM 1.2 collapse rule, exactly as written.
4. **Build outputs:** ESM + IIFE per CLAUDE.md rule 3.
5. **New example:** `examples/spike/` — 3 pages, one fake "quiz" page using a placeholder `<button>` that calls `oelt.track.interaction(...)` + completion rule `required-interactions-passed`, mastery 0.8.
6. **Tests (use the harness assertion API):** per mode — fresh launch → statuses correct; pass quiz → completion+score correct per spec (incl. 1.2 collapse rule); suspend/resume restores page + state; oversized state write rejected with clear error.

Definition of done: all tests green in all four modes; `examples/spike` drivable by hand in the harness; zero direct SCORM/xAPI API calls outside `adapters/`.

---

**Human gate:** drive `examples/spike` in all 4 modes; check the panel's "as the LMS sees it" summary matches the tracking spec table.
