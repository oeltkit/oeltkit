# Open Questions

When a spec is ambiguous, **stop and write the question here rather than guessing** (CLAUDE.md workflow rule 6). Guessed semantics are the most expensive bug class in this project. A human resolves each entry; the resolution then flows back into the relevant spec.

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

### OQ-001 — Adopt `scorm-again` / `@xapi/cmi5`, or keep zero-dep content-side clients?

- **Context:** `specs/` runtime; surfaced by Task 03 (runtime spike). CLAUDE.md hard-rule 1 _permits_ `scorm-again` and `@xapi/*` as runtime deps; it does not require them.
- **Question:** Should `@oeltkit/runtime` depend on `scorm-again` and/or `@xapi/cmi5`, or keep the hand-written zero-dependency content-side adapters introduced in the spike?
- **Findings (evaluated during the spike):**
  - **`scorm-again` is LMS-side** — it _provides_ `window.API` / `window.API_1484_11` and commits to a backend URL (exactly what the harness does). It is **not** a content-side wrapper that discovers and calls an LMS-provided API. OELT's runtime is content-side, so "wrapping" it does not fit the adapter role. (It _would_ be the right tool for the harness's fake API or a future self-hosted-standalone packaging mode.)
  - **`@xapi/cmi5` is AU/content-side and cmi5-conformant** — it _does_ fit, but depends on `@xapi/xapi`, adding bundle weight against the ~30 KB runtime target. The cmi5 wire protocol is small and already validated end-to-end by the harness.
- **Decision in the spike:** zero-dependency content-side adapters (`adapters/{scorm12,scorm2004,cmi5,web}.ts`). Keeps the IIFE bundle self-contained and the runtime within budget.
- **Blocking?:** No — adapters work and are tested in all four modes. This is a "confirm or revisit before Phase 1 hardening" question.
- **Proposed default:** Keep zero-dep for SCORM (the content-side need is ~60 lines and `scorm-again` doesn't fit it). Reconsider `@xapi/cmi5` for cmi5 in Phase 1 if statement/State edge cases (attachments, batching, auth refresh) grow beyond the minimal client.

### OQ-002 — `<oelt-branching>` loops vs the suspend-state cap

- **Context:** [`components/branching.md`](./components/branching.md) §8; surfaced by Task 04 spec drafting.
- **Question:** A scenario with cycles ("try again" returning to an earlier node) grows the stored visited `path`, which competes with the 256-byte component state cap and the overall 3 KB suspend budget.
- **Options considered:** (a) store the full path (simple analytics, unbounded); (b) store a bounded last-N path (drops early history); (c) store current node + a visited-set (resume works, loses order); (d) disallow cycles in v0.
- **Blocking?:** No — v0 can ship with the full-path approach and a documented cap; only affects loop-heavy scenarios.
- **Proposed default:** (c) current node + visited-set for resume, plus emit each branch-take as an interaction (so ordered analytics live in the LRS, not in suspend). Confirm before implementing `branching`.

## Resolved

_None yet._
