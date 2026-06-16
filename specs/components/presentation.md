# Presentation family — `<oelt-tabs>`, `<oelt-accordion>`, `<oelt-flip-cards>`

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md). **Interaction type:** none (see §1).

Three small layout/disclosure components for organizing content. Unlike the assessment and drag-and-drop families, these are **presentation only**.

## 1. Shared model (DECIDED — local, reversible per CLAUDE.md rule 6)

- **No interaction tracking.** These components do not emit `oelt-interaction` and are not declared as manifest interactions. They organize authored content; engagement is captured by the course's `progress` rule (`pages-viewed`) — "tracked as viewed-progress only" (PLAN.md §4.2 Batch C). If per-component "viewed all tabs" engagement is wanted later, it can be added as an opt-in `completed` emit; deferred to avoid minting an invalid SCORM 1.2 interaction type for a non-question widget.
- **Stateless.** They persist nothing through `oelt.state`; on resume the active tab / open panels / card faces reset to defaults. This keeps the shared suspend budget (base.md §4) for components that need it. (Resume-stable UI state is a candidate for a later revision.)
- **Light DOM**, content-bearing (authored panels/cards/sections are real content themes must reach). Styled via `--oelt-*` tokens; `::part()` exposed.
- **Accessibility is the whole point.** Each follows a native or WAI-ARIA APG pattern exactly; `prefers-reduced-motion` is honored (flip animation suppressed). No improvised ARIA.

## 2. `<oelt-tabs>` — tabbed panels (WAI-ARIA Tabs pattern)

```html
<oelt-tabs id="topics">
  <oelt-tab label="Overview"><p>Overview content…</p></oelt-tab>
  <oelt-tab label="Details"><p>Details content…</p></oelt-tab>
  <oelt-tab label="Examples"><p>Examples content…</p></oelt-tab>
</oelt-tabs>
```

Upgrades to a `role="tablist"` of `role="tab"` buttons + `role="tabpanel"` regions. **Automatic activation:** the focused tab is the selected tab.

| Key                      | Action                                                                       |
| ------------------------ | ---------------------------------------------------------------------------- |
| `Tab`                    | Move into the tablist (lands on the selected tab), then to the active panel. |
| `ArrowLeft`/`ArrowRight` | Move to and select the previous/next tab (wraps).                            |
| `Home`/`End`             | Select the first/last tab.                                                   |

Roving tabindex (only the selected tab is in the tab order). Each tab `aria-selected`, `aria-controls` its panel; each panel `aria-labelledby` its tab and `hidden` unless active. Parts: `::part(tablist)`, `::part(tab)`, `::part(tab selected)`, `::part(panel)`.

## 3. `<oelt-accordion>` — collapsible sections (native disclosure)

```html
<oelt-accordion>
  <!-- add `single` for exclusive open -->
  <oelt-panel label="What is SCORM?"><p>…</p></oelt-panel>
  <oelt-panel label="What is cmi5?"><p>…</p></oelt-panel>
</oelt-accordion>
```

Each panel upgrades to a native **`<details>`/`<summary>`** — accessible by construction (keyboard, SR, focus all native). `single` sets a shared `name` on the `<details>` so the browser enforces exclusive open (one at a time) natively. Parts: `::part(panel)` (the `<details>`), `::part(summary)`, `::part(content)`. No custom keyboard handling — `Enter`/`Space` on the summary toggles, per the platform.

## 4. `<oelt-flip-cards>` — flip cards

```html
<oelt-flip-cards>
  <oelt-card front="Mercury"><p>Closest planet to the Sun.</p></oelt-card>
  <oelt-card front="Venus"><p>Hottest planet.</p></oelt-card>
</oelt-flip-cards>
```

Each card upgrades to a `<button>` showing the `front`; activating it (`Enter`/`Space`/click) flips to reveal the back (the authored content), and again to flip back. `aria-pressed` conveys the flipped state; the hidden face is `hidden` (not just visually hidden) so SR reads only the visible face. The 3D flip animation is **suppressed under `prefers-reduced-motion`** (instant swap). Parts: `::part(grid)`, `::part(card)`, `::part(card flipped)`, `::part(front)`, `::part(back)`.

## 5. Verification (the gate)

axe-core clean scans on the demo; keyboard-only Playwright paths (tab arrow-navigation + selection; accordion toggle; card flip + `aria-pressed`); `prefers-reduced-motion` respected. No tracking/harness step (these don't track). Manual NVDA + VoiceOver before `stable`.
