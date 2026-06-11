# Decision 2: Tracking semantics

**Status: DECIDED — Option 2** (Jim, 2026-06-11), with Option 1 as zero-config default and Option 3 as the `manual` escape hatch. Sub-decisions all accepted as recommended. PLAN.md §4.1.

## The mapping problem

One authoring model must project onto four targets:

| Concept | SCORM 1.2 | SCORM 2004 | cmi5 | Standalone |
|---|---|---|---|---|
| Completion | `lesson_status` (completed/passed/failed…) | `completion_status` + `success_status` (separate) | `completed` / `passed` / `failed` statements | localStorage record |
| Score | `score.raw` 0–100 | `score.scaled` −1…1 | `result.score.scaled` | number |
| Progress | (none; convention via suspend_data) | `progress_measure` | progress extension | number |
| Interactions | `cmi.interactions` (limited) | `cmi.interactions` (richer) | xAPI statements per interaction | event log |

Note SCORM 1.2 conflates completion and success in one field — the semantics model must define the collapse rule, not leave it to the adapter.

## Option 1 — Convention only ("viewed = complete")

Completion = all pages viewed. Score = whatever the single quiz container reports. No manifest config.

Pros: zero configuration, impossible to misconfigure. Cons: can't express "pass the quiz to complete," mastery, or weighted assessments — real courses outgrow it immediately. **Reject as the only model**, but it's the right *default* when no tracking block is present.

## Option 2 — Declarative rules in manifest — **recommended**

A small closed vocabulary of rules (not a formula language):

```json
"tracking": {
  "completion": { "rule": "required-interactions-passed" },
  "score":      { "rule": "weighted-interactions", "mastery": 0.8 },
  "progress":   { "rule": "pages-viewed" }
}
```

Completion rules (v0): `all-pages-viewed` (default) · `pages-viewed` with `threshold` · `required-interactions-completed` · `required-interactions-passed` · `manual` (author code calls `oelt.track.complete()`).
Score rules (v0): `none` (default) · `single-interaction` with `source` · `weighted-interactions`. `mastery` (0–1) maps to passed/failed where the target supports it.

**Collapse rule for SCORM 1.2:** if a score+mastery is defined → report `passed`/`failed`; else → `completed`/`incomplete`. (Document this prominently; it's the classic gotcha.)

Pros: covers ~95% of real courses; machine-validatable ("mastery set but no score rule" = lint error); LLMs fill in enums reliably. Cons: vocabulary must be curated; weird cases need the `manual` escape hatch.

## Option 3 — Imperative API only

Author (or LLM) calls `track.complete()`, `track.score()` directly. Maximum flexibility, but: completion logic lives in generated JS where validators can't see it, every course reinvents it, and LLMs will get edge cases (resume, partial credit) wrong. **Reject as primary**; survives as Option 2's `manual` rule.

## Recommendation

**Option 2, with Option 1 as the zero-config default and Option 3 as the escape hatch.** All three coexist cleanly: absence of a `tracking` block = Option 1 behavior; `"rule": "manual"` = Option 3.

Also decide (sub-decisions, recommendations inline):

- **Interaction reporting:** always record question-level interactions where the target supports it (cmi.interactions / xAPI statements) — it's free analytics value. ✔ recommended
- **Suspend data budget:** SCORM 1.2 guarantees only 4 KB. Runtime enforces a quota with compression and fails validation if components over-subscribe. ✔ recommended
- **xAPI verb vocabulary:** adopt cmi5-defined verbs + ADL verbs; publish an OELT xAPI Profile in Phase 3 rather than inventing verbs now. ✔ recommended

**Decision:** ☐ 1 ☑ **2** ☐ 3 — *2026-06-11, Jim: accepted recommendation incl. all three sub-decisions (always record interactions; 3 KB enforced suspend budget; cmi5/ADL verbs now, OELT xAPI Profile in Phase 3).*
