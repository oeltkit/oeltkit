# Component base contract (v0)

**Status:** Draft for human review (Task 04). Normative once signed off.
**Applies to:** every `<oelt-*>` custom element. Component specs (`mcq.md`,
`branching.md`, `media.md`, …) layer on top of this and MUST NOT contradict it.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, MAY are per RFC 2119.

---

## 1. Platform

Vanilla custom elements only — no framework, no Lit (CLAUDE.md hard-rule 2). TypeScript source compiled to ESM + a single-file IIFE; generated courses run with no build step. Browser targets: evergreen, ~2 years past baseline.

## 2. DOM model: light vs shadow

Per CLAUDE.md: **content-bearing components use light DOM** (so author/theme CSS reaches the content and authors can slot real markup); **chrome-only components MAY use shadow DOM**. Each component spec records its decision and rationale. All three v0 components (mcq, branching, media) are **light DOM** — they are content.

A light-DOM component progressively enhances the markup it already contains rather than replacing it; it MUST be functional as plain HTML before upgrade where feasible, and MUST NOT destroy author content on upgrade.

## 3. The `oelt-interaction` event (component → runtime contract)

Components never call the LMS or `oelt.track` directly. They emit a DOM event; the runtime maps it to tracking per the manifest's rules ([tracking-semantics.md](../tracking-semantics.md)). This keeps components target-agnostic and testable in isolation.

```js
this.dispatchEvent(
  new CustomEvent("oelt-interaction", {
    bubbles: true,
    composed: true,
    detail: {
      id: "quiz1", // MUST equal the element id and the manifest interaction id
      type: "choice", // interaction kind (see per-component spec)
      result: "passed", // "passed" | "failed" | "completed"
      score: 1, // optional, 0–1 scaled
      response: "b", // optional, learner response for cmi.interactions / xAPI
    },
  }),
);
```

`detail` is a superset of the runtime's `InteractionReport` (`{ id, type?, result, score? }`) plus an optional `response`. The runtime installs one delegated `oelt-interaction` listener and forwards to `oelt.track.interaction(detail)`; the `response` is recorded in `cmi.interactions` / the xAPI statement where supported.

- A component MUST set its element `id` to the declared interaction id and put that same id in `detail.id` (the manifest declaration ↔ HTML sync rule, [manifest-v0.md §4.1](../manifest-v0.md)).
- `composed: true` is required so the event escapes any shadow boundary above it.
- Components emit; they **do not aggregate** (a quiz container, built later, aggregates).

## 4. State & resume

- Components persist only through `oelt.state` (never the LMS API directly) so the suspend budget is enforced ([tracking-semantics.md §8](../tracking-semantics.md)).
- State is namespaced by the element id: a component reads/writes `oelt.state.get/set` under its own id (e.g. the key `mcq1`), storing a small plain-JSON value.
- **Store references, not content.** Persist selected indices / a node-id path / a playback position — never re-serialize authored content.
- Each component spec declares a **max state size in bytes**; the sum across a course's components plus runtime overhead MUST stay ≤ 3 KB. The validator fails the build if declared sizes over-subscribe the budget.
- State MUST round-trip through suspend/resume: after resume, the component restores its prior UI state from `oelt.state` without re-emitting completed interactions.

## 5. Styling: tokens & parts

- Components consume `--oelt-*` design tokens only; they MUST NOT hardcode colors, sizes, or fonts (CLAUDE.md hard-rule 4). No Tailwind in toolkit code.
- Token vocabulary v0 (theme authors override these): `--oelt-color-fg`, `--oelt-color-bg`, `--oelt-color-primary`, `--oelt-color-correct`, `--oelt-color-incorrect`, `--oelt-color-focus`, `--oelt-space-1..4`, `--oelt-radius`, `--oelt-font`, `--oelt-motion-duration`. A component using a token not in this list MUST add it here in the same change.
- Each component exposes named `::part()`s for theme authors (listed per spec). Parts are the supported theming surface; internal structure is not.

## 6. Accessibility baseline (merge gate — CLAUDE.md rule 5)

Every component MUST:

- **Prefer native elements over ARIA.** Use `<button>`, `<input type=radio/checkbox>`, `<fieldset>/<legend>`, `<details>` etc. Add `role`/`aria-*` only when no native element fits, and only as documented in the component spec. Plausible-but-wrong ARIA is the canonical failure here — do not improvise it.
- Be fully **keyboard operable** with a documented key map, and show a **visible focus indicator** (`--oelt-color-focus`).
- Respect **`prefers-reduced-motion`** (no nonessential animation/autoplay when set).
- Document **screen-reader behavior** in the component `README.md` and meet **WCAG 2.2 AA**.
- Manage focus on state transitions deliberately (move focus where the user expects; never trap).
- Announce dynamic changes (feedback, scenario transitions) via an appropriate live region — `aria-live="polite"` for feedback, not `assertive`, unless the spec says otherwise.

Verification per component (Definition of done, CLAUDE.md): unit tests, a keyboard-only Playwright path, an axe-core clean scan on the demo page, tracking verified in the harness (with panel screenshots), and a manual NVDA/VoiceOver pass before `stable` (may merge `beta` pending that pass).

## 7. The escape hatch

Bespoke one-off interactions extend a documented `CustomInteraction` base (emits `oelt-interaction`, gets the a11y/state services) without being in the library — the library is a floor, not a ceiling. Spec'd separately when built.
