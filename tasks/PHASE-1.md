# Phase 1 — runner / index

Phase 0 is done: the exit gate passed (fresh-session SCORM 1.2 package, clean import + score on SCORM Cloud, two LLM clients, no hand-fixing). OQ-001 is closed in favor of the zero-dep adapters.

This phase runs under the **solo-fast workflow** in `CLAUDE.md`: commit straight to `main`, the automated suites (`npm test`, `npm run validate:examples`, `npm run test:a11y`, and the new SCORM Cloud CI) are the gate, and there are **no blocking human review stops**. The human passes that remain are async spot-checks — listed per task and collected at the bottom — none of which block an agent from continuing.

## Dependency order

```
07  specs (.oeltcourse, file://, message_human)   ← run FIRST; blocks 09 and the cloud repo
      │
      ├──────────────┬───────────────┐
      ▼              ▼               ▼
08 components    09 MCP server    10 SCORM Cloud CI
(independent)    (needs 07)       (independent)
      └──────────────┴───────────────┘
                     ▼
11  website sync   ← run LAST (needs 07–10 substantially merged)
     Part A = toolkit repo · Part B = website repo (separate session)
```

- **07 first, on its own.** Everything downstream is cheaper once the `.oeltcourse` format and the `file://`/`message_human` contracts exist. It's the only true blocker.
- **08 and 10 are independent** of 07 and of each other — start them whenever; they can interleave with 09.
- **09 needs 07** (it wraps the `.oeltcourse` CLI verbs).
- **11 is last** and is the only cross-repo task: Part A here, Part B in the website repo.

## Realistic session boundaries

Don't try to do all of Phase 1 in one literal session — context will rot and the work spans two repos. Good cut points (each is gate-clean on its own):

1. **Session 1:** Task 07 end to end.
2. **Sessions 2…n:** Task 08, one component or small batch per session (Batch A first; `<oelt-quiz>` is the consequential one). Chain within a batch freely.
3. **Session:** Task 09 (after 07).
4. **Session (anytime):** Task 10.
5. **Session:** Task 12 (SCORM 2004 honesty, toolkit-side) **+** Task 11 Part A (website-export) together here, then a fresh session in the website repo for Part B (which also carries the Task 12 website-side Standards-page caveat).

## Kickoff prompt (paste into a fresh Claude Code session in `~/dev/oeltkit`)

---

Read `CLAUDE.md` and `tasks/PHASE-1.md`, then execute **Task 07** (`tasks/07-phase1-specs.md`). Work under the solo-fast workflow: commit straight to `main`, let the automated suites gate you, and don't stop for review. Land each spec as its own `SPEC CHANGE` commit, then its implementation. If you hit a genuinely cross-cutting ambiguity (manifest or tracking semantics), park it in `specs/OPEN-QUESTIONS.md` and keep going on everything else. When 07's suites are green, stop and tell me what landed so I can sequence 08/09/10.

---

(After 07, kick off 08/09/10 in their own sessions with: "Read `CLAUDE.md` and `tasks/0N-*.md` and execute it.")

## The async human spot-checks (collected — none block the agent)

- **07:** skim `specs/course-file.md` (the one cross-cutting decision; still cheap to change before the cloud repo starts) + ~10 `message_human` strings for tone.
- **08:** manual AT pass (NVDA + VoiceOver) per component batch — the gate for `beta → stable`, not for merging `beta`.
- **09:** install the `.mcpb` on a clean Claude Desktop and author a course conversationally; file every "that felt technical" moment.
- **10:** eyeball one full SCORM Cloud run's artifacts once.
- **11:** website copy review (recipes especially) + honesty pass — before DNS, not before build.
