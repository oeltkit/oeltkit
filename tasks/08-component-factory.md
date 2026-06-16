# Task 08 — Component factory (remaining Phase 1 inventory)

**Prerequisites:** exit gate passed ✅. The three beta components are the pattern source. Parallelizable: one component (or small group) per session; chain them freely per CLAUDE.md.

**Inventory (PLAN.md §4.2), suggested batches:**

- **Batch A (assessment core):** `<oelt-text-entry>` (text/numeric, tolerance matching) · `<oelt-quiz>` (question container: pooling, randomization, scoring, weight aggregation — *the most consequential; spec it first and test it hardest*) · `<oelt-likert>` (slider/poll, survey-type interaction)
- **Batch B (manipulation):** `<oelt-ordering>` · `<oelt-matching>` · `<oelt-categorize>` (drag-and-drop family — shared base for pointer+keyboard parity; spec the keyboard operation model for the family together, then one session each)
- **Batch C (presentation):** `<oelt-tabs>` / `<oelt-accordion>` / `<oelt-flip-cards>` (one session, three small components; tracked as viewed-progress only) · `<oelt-hotspot>` (image map; a11y model needs care)
- **Batch D:** `<oelt-reflection>` (free text, stored to state, optionally LLM-evaluated later — design the evaluation hook as an event contract now, implement evaluation never; it's a Tier 3 cloud concern)

**Session prompt template (per component):**

---

Implement `<oelt-NAME>` in `packages/components` following the established pattern (read `specs/components/base.md`, `mcq.md`, and the mcq/branching/media implementations first).

In one pass, committing straight to `main`: (1) write `specs/components/NAME.md` — behavior, attributes/slots, events, full keyboard map, SR behavior, light/shadow DOM decision, max state size, suspend round-trip semantics (commit with `SPEC CHANGE`). (2) Implementation + unit tests + keyboard-only Playwright path + axe scan + demo page in `harness/demos/` + README with canonical examples + tracking events verified in the harness (panel screenshots in the commit/notes). The component merges as `beta`. The axe scan and keyboard Playwright path are the gate — a red suite blocks; do not weaken a test to pass it.

Special attention for the drag-and-drop family: every pointer operation has a documented keyboard equivalent (pick-up/move/drop per WAI-ARIA APG); `prefers-reduced-motion` honored; SR announcements on every state change. Prefer native elements; follow the APG pattern rather than inventing ARIA. If a novel a11y model is genuinely ambiguous, make the APG-aligned call and log it as `DECIDED:` in `specs/OPEN-QUESTIONS.md` — keep moving.

Track the running **suspend-budget tally** in each component's spec; total declared state across the full inventory must stay ≤ 3 KB. Add/extend an automated check that sums declared state and fails if it exceeds budget.

---

**Async spot-check (non-blocking):** manual AT pass (NVDA + VoiceOver) per batch — this is the one thing automation can't cover, and it's the gate for promoting components `beta → stable`. Batch it; don't block implementation on it.
