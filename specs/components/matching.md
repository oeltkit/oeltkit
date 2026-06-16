# `<oelt-matching>` — match values to prompts

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md) + [dnd-family.md](./dnd-family.md). **Interaction type:** `matching`.

Assign each draggable value to its correct prompt (country → capital, term → definition). Keyboard-first per the family model; pointer drag is an enhancement. Reports one `oelt-interaction` on **Check**.

## 1. DOM model

**Light DOM**. Enhances authored `<oelt-pair>` children into: a list of **prompt rows** (each with a drop **target**) and a **bank** of unplaced value `<button>`s. No shadow root.

## 2. Authoring shape

```html
<oelt-matching id="capitals">
  <p slot="prompt">Match each country to its capital.</p>
  <oelt-pair prompt="France" value="paris">Paris</oelt-pair>
  <oelt-pair prompt="Japan" value="tokyo">Tokyo</oelt-pair>
  <oelt-pair prompt="Egypt" value="cairo">Cairo</oelt-pair>
</oelt-matching>
```

Each `<oelt-pair>` declares a `prompt` (the fixed left side) and the correct `value` for it; the element's text is the value's visible label. On upgrade the **values are shuffled into the bank**; prompts stay in authored order. The correct matching is `prompt_i ↔ value_i`.

## 3. Attributes

| Attribute      | Values     | Default           | Meaning                                                                   |
| -------------- | ---------- | ----------------- | ------------------------------------------------------------------------- |
| `id`           | identifier | —                 | Required. Interaction id; matches the manifest declaration & `detail.id`. |
| `submit-label` | string     | `"Check matches"` | Label of the Check button.                                                |
| `retry`        | boolean    | absent            | Allow re-checking after feedback.                                         |

## 4. Slots & parts

Slots: `prompt` (instructions), default slot (`<oelt-pair>`s).

Parts: `::part(prompts)` (the prompt-rows list), `::part(prompt-row)`, `::part(target)` (a drop slot), `::part(bank)` (unplaced values), `::part(value)` (a value button), `::part(value grabbed)`, `::part(target correct)` / `::part(target incorrect)` after Check, `::part(submit)`, `::part(feedback)`.

## 5. Interaction & grading

Positions a value can occupy: **each prompt's target** and the **bank**. Keyboard per [dnd-family.md §3](./dnd-family.md): focus a value, `Space` to pick up, `ArrowLeft`/`ArrowRight` to move it across targets (and the bank), `Space` to drop into the current target, `Escape` to cancel. Dropping a value onto an occupied target displaces the previous value back to the bank (one value per target). Pointer drag does the same.

On **Check**, emits `oelt-interaction`:

```js
{ id, type: "matching", result, score, response }
```

- `score` = (targets holding their correct value) / (pair count), 0–1.
- `result` = `passed` iff every target holds its correct value, else `failed`.
- `response` = `prompt=value` assignments joined by `,` (e.g. `France=paris,Japan=tokyo`), empty targets as `prompt=`.

Without `retry`, controls lock and the interaction emits once. Per-target correctness shown in text + `::part(target correct|incorrect)`, never colour alone.

## 6. Keyboard & screen reader

Family model ([dnd-family.md §3–4](./dnd-family.md)). `{position}` is announced as the target's prompt ("Target: Japan.") or "Bank.". Pick-up announces the value and its current position plus the move instructions; each move announces the new target/bank; drop/cancel per the family contract. After Check, focus moves to the `aria-live="polite"` feedback.

## 7. State

Key: the element id. Value: `{ placed: Record<string, string>, submitted: boolean }` — a map of `value → prompt` for placed values (unplaced values are absent) plus the submitted flag. **Max 512 bytes.** On resume, restore placements and submitted/locked UI without re-emitting.

## 8. Tracking mapping

`cmi.interactions.n.*` with `type=matching`, `student_response` = the assignments, `result` correct/wrong. cmi5/xAPI: an `answered` statement. Contributes to completion/score rules as the manifest specifies.

## 9. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- At least two `<oelt-pair>`s, each with a `prompt` and a unique `value`.

## 10. Open questions

_None blocking. Distractor values (more values than prompts) and many-to-one matches are candidates for a later revision; v0 is a 1:1 bijection._
