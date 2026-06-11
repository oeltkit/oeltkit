# Task 05 — Minimal packager + Phase 0 exit gate

**Prerequisites:** Tasks 03–04 merged.

## Part A — Session prompt for Claude Code:

---

Implement the minimum `@oeltkit/cli` to close the loop: `oelt new <dir>`, `oelt preview` (launches harness), `oelt package --target scorm12|scorm2004|cmi5|web`, and `oelt validate` v0 (schema check; interactions declared in `course.json` exist in page HTML; media has transcripts; completion reachable). Manifest generation (`imsmanifest.xml`, `cmi5.xml`) from `course.json` only — templates live in the generator, never hand-edited. Machine-readable (`--json`) validator output.

Then write `docs/llms.txt` and `docs/quickstart.md`: everything a fresh LLM session needs to scaffold, author, validate, and package a course — runtime API, the three components with canonical examples, CLI usage. Write for model consumption: complete, copy-pasteable, no implied context.

Definition of done: `oelt new && oelt package --target scorm12` yields a zip that imports and tracks correctly in SCORM Cloud (manual upload acceptable at this stage).

---

## Part B — The exit gate (human-run, do not delegate)

In a **fresh** Claude session (no repo context beyond `docs/`), prompt: *"Using the OELT docs at <docs>, build a short course on <novel topic> with a quiz requiring 80% to complete, and give me a SCORM 1.2 package."*

Pass criteria: package imports into SCORM Cloud; completes/scores correctly; axe scan of the content is clean; **no manual fixes**. Run it with at least 2 different LLM clients.

- **Pass →** Phase 0 thesis validated. Proceed to Phase 1 (PLAN.md §8).
- **Fail →** diagnose whether the gap is docs, API design, or validator coverage — fix and re-run. Do not proceed to Phase 1 with a failing gate; this gate *is* the product.
