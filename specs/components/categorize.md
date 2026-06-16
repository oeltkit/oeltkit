# `<oelt-categorize>` — sort items into categories

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md) + [dnd-family.md](./dnd-family.md). **Interaction type:** `matching`.

Sort each item (token) into its correct category bucket. Unlike `<oelt-matching>` (a 1:1 bijection), a bucket holds **many** tokens and several tokens can share a category. Keyboard-first per the family model; pointer drag is an enhancement. Reports one `oelt-interaction` on **Check**.

## 1. DOM model

**Light DOM**. Enhances authored `<oelt-bucket>` and `<oelt-token>` children into: a row of **buckets** (drop zones) and a **bank** of unplaced token `<button>`s. No shadow root.

## 2. Authoring shape

```html
<oelt-categorize id="animals">
  <p slot="prompt">Sort each animal into its group.</p>
  <oelt-bucket value="mammals">Mammals</oelt-bucket>
  <oelt-bucket value="birds">Birds</oelt-bucket>

  <oelt-token bucket="mammals" value="dog">Dog</oelt-token>
  <oelt-token bucket="birds" value="eagle">Eagle</oelt-token>
  <oelt-token bucket="mammals" value="cat">Cat</oelt-token>
</oelt-categorize>
```

`<oelt-bucket value>` defines a category (text = its label, in authored order). Each `<oelt-token bucket value>` declares the correct bucket for that token (text = its label). On upgrade the **tokens shuffle into the bank**; buckets stay in authored order. A token is correct when it sits in its declared `bucket`.

## 3. Attributes

| Attribute      | Values     | Default   | Meaning                                                                   |
| -------------- | ---------- | --------- | ------------------------------------------------------------------------- |
| `id`           | identifier | —         | Required. Interaction id; matches the manifest declaration & `detail.id`. |
| `submit-label` | string     | `"Check"` | Label of the Check button.                                                |
| `retry`        | boolean    | absent    | Allow re-checking after feedback.                                         |

## 4. Slots & parts

Slots: `prompt` (instructions), default slot (`<oelt-bucket>`s and `<oelt-token>`s).

Parts: `::part(buckets)` (the bucket row), `::part(bucket)`, `::part(bucket-label)`, `::part(bucket cursor)` (the move cursor), `::part(bank)`, `::part(token)`, `::part(token grabbed)`, `::part(token correct)` / `::part(token incorrect)` after Check, `::part(submit)`, `::part(feedback)`.

## 5. Interaction & grading

Positions a token can occupy: **each bucket** and the **bank**. Keyboard per [dnd-family.md §3](./dnd-family.md): focus a token, `Space` to pick up, `ArrowLeft`/`ArrowRight` to move it across buckets (and the bank), `Space` to drop into the current bucket, `Escape` to cancel. A bucket holds any number of tokens (no displacement). Pointer drag does the same.

On **Check**, emits `oelt-interaction`:

```js
{ id, type: "matching", result, score, response }
```

- `score` = (tokens in their correct bucket) / (token count), 0–1.
- `result` = `passed` iff every token is in its correct bucket, else `failed`.
- `response` = `token=bucket` assignments joined by `,` (unplaced token → `token=`).

Without `retry`, controls lock and the interaction emits once. Per-token correctness shown in text + `::part(token correct|incorrect)`, never colour alone.

## 6. Keyboard & screen reader

Family model ([dnd-family.md §3–4](./dnd-family.md)). `{position}` is announced as the bucket label ("Bucket: Mammals.") or "Bank.". Pick-up announces the token, its current position, and the move instructions; each move announces the new bucket/bank; drop/cancel per the family contract. After Check, focus moves to the `aria-live="polite"` feedback.

## 7. State

Key: the element id. Value: `{ placed: Record<string, string>, submitted: boolean }` — a map of `token → bucket` for placed tokens (unplaced absent) plus the submitted flag. **Max 256 bytes.** On resume, restore placements and submitted/locked UI without re-emitting.

## 8. Tracking mapping

`cmi.interactions.n.*` with `type=matching` (SCORM has no distinct "categorize" type; categorization is a matching of items to groups), `student_response` = the assignments, `result` correct/wrong. cmi5/xAPI: an `answered` statement. Contributes to completion/score rules as the manifest specifies.

## 9. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- At least one `<oelt-bucket>` and at least two `<oelt-token>`s; every token's `bucket` matches a declared bucket `value`; token `value`s unique.

## 10. Open questions

_None blocking. Per-bucket capacity limits and "no incorrect bucket shown until Check" are candidates for a later revision; v0 allows any token in any bucket and grades on Check._
