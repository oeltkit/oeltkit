# Drag-and-drop family — shared interaction & accessibility model

**Status:** Normative for the family. Version `0.1`.
**Base:** [base.md](./base.md). **Applies to:** `<oelt-ordering>`, `<oelt-matching>`, `<oelt-categorize>`.
**Companion specs** (`ordering.md`, `matching.md`, `categorize.md`) layer component specifics on top and MUST NOT contradict this.

The key words MUST, MUST NOT, SHOULD, MAY are per RFC 2119.

---

## 1. Why a family spec

Native HTML5 drag-and-drop is **not keyboard operable** and has weak screen-reader support, so it can never be the only interaction. Every component in this family is **keyboard-first**: a documented pick-up / move / drop model is the primary mechanism, and pointer drag is an optional enhancement layered on top. Specifying the keyboard model once keeps the three components consistent and prevents each from improvising its own (and getting the ARIA wrong — the canonical LLM failure here, CLAUDE.md).

## 2. The movable-item model

Each component manipulates **movable items** among **positions**:

| Component          | Items            | Positions                        |
| ------------------ | ---------------- | -------------------------------- |
| `<oelt-ordering>`  | list entries     | slots in one ordered list        |
| `<oelt-matching>`  | draggable values | one target per prompt            |
| `<oelt-categorize>`| draggable values | N category buckets               |

Items are real focusable **`<button>`** elements (native semantics: in the tab order, operable by Space/Enter, focus-visible for free). Components MUST NOT invent ARIA roles for items; they MUST NOT use the **deprecated** `aria-grabbed` / `aria-dropeffect` (removed in ARIA 1.1). Grabbed state is conveyed by a live-region announcement plus a visual `::part(... grabbed)` state, not by deprecated attributes.

## 3. Keyboard model (APG-aligned pick-up / move / drop)

Every pointer operation has this keyboard equivalent. Focus is on an item `<button>`.

| Key                         | When           | Action                                                                          |
| --------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`         | always         | Move focus between items / controls (native).                                   |
| `Space` / `Enter`           | not grabbed    | **Pick up** the focused item (enter grabbed state).                             |
| `Space` / `Enter`           | grabbed        | **Drop** the item at its current position/target (commit, exit grabbed state).  |
| `ArrowUp`/`Down` (ordering) | grabbed        | **Move** the grabbed item one step earlier/later in the list.                   |
| `ArrowLeft`/`Right` (match/cat) | grabbed    | **Move** the grabbed item to the previous/next target/bucket.                   |
| `Escape`                    | grabbed        | **Cancel** — return the item to its pre-pickup position; exit grabbed state.    |

Rules:

- Only **one** item is grabbed at a time. Picking up while another is grabbed is not possible (the first must be dropped or cancelled).
- Focus stays on the moving item throughout, so the user never loses their place.
- Moving past either end is a no-op (does not wrap), and is not announced as a move.

## 4. Screen-reader announcements (required)

A single visually-hidden live region per component (`aria-live="assertive"`, `role="status"`) announces **every state change**. Assertive (not polite) because these are direct responses to the user's own key/pointer action.

Minimum announcements:

- **Pick up:** "Grabbed {label}. {position}. Use arrow keys to move, Space to drop, Escape to cancel."
- **Move:** the new `{position}` (e.g. "Position 2 of 5." / "Target: Mars." / "Bucket: Mammals.").
- **Drop:** "Dropped {label}. {position}."
- **Cancel:** "Cancelled. {label} returned to {position}."

`{position}` wording is component-specific (list index, target name, bucket name) and defined in each component spec.

## 5. Pointer enhancement

Pointer drag (HTML5 `draggable` or pointer events) MAY be provided as an enhancement. It MUST produce exactly the same committed state as the keyboard model and MUST keep the live region in sync (a pointer drop announces like a keyboard drop). Pointer support is **not** the gate — the keyboard path is. Touch limitations (native DnD is unreliable on touch) are documented per component; the keyboard model is always available.

## 6. Reduced motion

Any reorder/move animation MUST be suppressed when `prefers-reduced-motion: reduce` is set (base.md §6) — the reorder still happens, instantly, with no transition.

## 7. Grading & state

- Each component grades on an explicit **Check** action (a button), emitting one `oelt-interaction` (base.md §3). Score is the fraction of items in their correct position/target/bucket unless the component spec says otherwise; `passed` iff every item is correct.
- State persists the current arrangement (item→position) through `oelt.state`, restored on resume without re-emitting. Each component declares its max state size; the family stays within the shared suspend budget (base.md §4).

## 8. Verification (per component, the gate)

Unit tests for the pure grading/arrangement logic; a **keyboard-only** Playwright path that picks up, moves, drops, and checks; an axe-core clean scan; tracking verified in the harness; manual NVDA + VoiceOver before `stable`. Pointer drag is covered where practical but never substitutes for the keyboard path.
