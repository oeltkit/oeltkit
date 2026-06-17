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
