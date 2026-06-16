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

_None._

## Resolved

### OQ-001 — Adopt `scorm-again` / `@xapi/cmi5`, or keep zero-dep content-side clients? — RESOLVED (keep zero-dep), 2026-06-14

- **Context:** `specs/` runtime; surfaced by Task 03 (runtime spike). CLAUDE.md hard-rule 1 _permits_ `scorm-again` and `@xapi/*` as runtime deps; it does not require them.
- **Question:** Should `@oeltkit/runtime` depend on `scorm-again` and/or `@xapi/cmi5`, or keep the hand-written zero-dependency content-side adapters introduced in the spike?
- **Findings (evaluated during the spike):**
  - **`scorm-again` is LMS-side** — it _provides_ `window.API` / `window.API_1484_11` and commits to a backend URL (exactly what the harness does). It is **not** a content-side wrapper that discovers and calls an LMS-provided API. OELT's runtime is content-side, so "wrapping" it does not fit the adapter role. (It _would_ be the right tool for the harness's fake API or a future self-hosted-standalone packaging mode.)
  - **`@xapi/cmi5` is AU/content-side and cmi5-conformant** — it _does_ fit, but depends on `@xapi/xapi`, adding bundle weight against the ~30 KB runtime target. The cmi5 wire protocol is small and already validated end-to-end by the harness.
- **Decision (Jim, 2026-06-14):** Keep the zero-dependency content-side adapters (`adapters/{scorm12,scorm2004,cmi5,web}.ts`). **Arbitrated by the Phase 0 exit gate:** a fresh-session SCORM 1.2 package imported, completed, and scored correctly on SCORM Cloud across two different LLM clients with no hand-fixing — the hand-written adapters pass real-LMS conformance, so there's no case for pulling in `scorm-again`. Revisit `@xapi/cmi5` only if cmi5 statement/State edge cases (attachments, batching, auth refresh) later outgrow the minimal client.

### OQ-002 — `<oelt-branching>` loops vs the suspend-state cap — RESOLVED (c), 2026-06-11

- **Context:** [`components/branching.md`](./components/branching.md) §8; surfaced by Task 04 spec drafting.
- **Question:** A scenario with cycles ("try again" returning to an earlier node) grows the stored visited path, which competes with the 256-byte component state cap and the 3 KB suspend budget.
- **Decision (Jim, "proceed"):** option (c) — store **current node + a visited-set** (unique node ids) for resume; emit **each branch-take as an interaction** so ordered analytics live in the LRS, not in suspend. Bounded by node count, not by loop count. Reflected in branching.md §5/§8.
