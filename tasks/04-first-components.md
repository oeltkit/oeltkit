# Task 04 — First three components

**Prerequisites:** Task 03 merged. Run as up to three parallel sessions (one per component) — they share only the runtime API and the component base contract.

**Session prompt for Claude Code (per component):**

---

Implement `<oelt-mcq>` | `<oelt-branching>` | `<oelt-media>` in `packages/components`, per the Definition-of-done checklist in CLAUDE.md.

First, write the component spec at `specs/components/<name>.md` (attributes, slots, events, keyboard map, SR behavior, light/shadow DOM decision + rationale, max state size) and **stop for human review of the spec before implementing** (post it as a draft PR).

Component notes:

- **oelt-mcq:** single & multiple response; options as slotted markup (light DOM); emits `oelt-interaction` events; randomization opt-in; feedback slots; works inside a future quiz container (don't build the container yet — emit, don't aggregate).
- **oelt-branching:** scenario graph from a JSON file or inline `<script type="application/json">`; each branch-take emits an interaction event; supports resume mid-scenario within state budget (store path, not content).
- **oelt-media:** wraps `<video>`/`<audio>`; **refuses to render without captions/transcript** (validation-visible error state); transcript panel; completion event at configurable threshold; respects reduced motion for autoplay.

A11y is the merge gate (CLAUDE.md rule 5): keyboard path Playwright test, axe clean, SR behavior documented. Native elements over ARIA. Verify tracking in the harness and include panel screenshots in the PR.

---

**Human gate:** spec review before implementation; NVDA or VoiceOver manual pass before `stable` (component may merge as `beta` pending AT review).
