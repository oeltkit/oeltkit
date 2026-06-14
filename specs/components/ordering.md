# `<oelt-ordering>` — sequence / ranking

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md) + [dnd-family.md](./dnd-family.md). **Interaction type:** `sequencing`.

Reorder a set of items into the correct sequence (steps in a process, events in time, a ranking). Keyboard-first per the family model; pointer drag is an enhancement. Reports one `oelt-interaction` on **Check**.

## 1. DOM model

**Light DOM** (the item content is authored). Enhances authored `<oelt-item>` children into an `<ol>` of `<li>`s, each containing a movable `<button>` (the family's item handle). No shadow root.

## 2. Authoring shape

```html
<oelt-ordering id="lifecycle">
  <p slot="prompt">Put the steps in order, first to last.</p>
  <oelt-item value="plan">Plan</oelt-item>
  <oelt-item value="build">Build</oelt-item>
  <oelt-item value="test">Test</oelt-item>
  <oelt-item value="ship">Ship</oelt-item>
</oelt-ordering>
```

**Authored order is the correct order.** On upgrade the items are shuffled (and re-shuffled until the start order differs from the answer when possible) so the task is non-trivial; the learner restores the intended sequence.

## 3. Attributes

| Attribute      | Values     | Default          | Meaning                                                                  |
| -------------- | ---------- | ---------------- | ------------------------------------------------------------------------ |
| `id`           | identifier | —                | Required. Interaction id; matches the manifest declaration & `detail.id`. |
| `submit-label` | string     | `"Check order"`  | Label of the Check button.                                               |
| `retry`        | boolean    | absent           | Allow re-checking after feedback (re-emits each Check).                  |

## 4. Slots & parts

Slots: `prompt` (instructions; labels the list), default slot (`<oelt-item>`s).

Parts: `::part(list)` (the `<ol>`), `::part(item)` (each handle button), `::part(item grabbed)` (the picked-up item), `::part(item correct)` / `::part(item incorrect)` (per-item state after Check), `::part(submit)`, `::part(feedback)`.

## 5. Interaction & grading

Keyboard pick-up/move/drop per [dnd-family.md §3](./dnd-family.md): focus an item, `Space` to pick up, `ArrowUp`/`ArrowDown` to move it, `Space` to drop, `Escape` to cancel. Pointer drag reorders the same way (enhancement).

On **Check**, emits `oelt-interaction`:

```js
{ id, type: "sequencing", result, score, response }
```

- `score` = (items in their correct position) / (item count), 0–1.
- `result` = `passed` iff every item is in its correct position, else `failed`.
- `response` = current order as `value`s joined by `,` (matches the authored ids).

Without `retry`, items lock and the interaction emits once. Per-item correctness after Check is shown in text + `::part(item correct|incorrect)`, never colour alone.

## 6. Keyboard & screen reader

Family model ([dnd-family.md §3–4](./dnd-family.md)). `{position}` is announced as "Position {i} of {n}." Pick-up announces the full instruction; each move announces the new position; drop/cancel announce per the family contract. The `<ol>` is labelled by the prompt. After Check, focus moves to the `aria-live="polite"` feedback so the score is announced.

## 7. State

Key: the element id. Value: `{ order: string[], submitted: boolean }` — the current item values in display order + submitted flag. **Max 256 bytes.** On resume, restore the arrangement and submitted/locked UI without re-emitting.

## 8. Tracking mapping

`cmi.interactions.n.*` with `type=sequencing`, `student_response` = the ordered values, `result` correct/wrong. cmi5/xAPI: an `answered` statement. Contributes to completion/score rules as the manifest specifies.

## 9. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- At least two `<oelt-item>`s, each with a unique `value` (defaults to its text).

## 10. Open questions

_None blocking. Partial-credit by adjacency (Kendall-tau-style) instead of exact-position is a candidate for a later revision; v0 scores by correct absolute position._
