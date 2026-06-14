# `<oelt-reflection>` — free-text reflection

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md). **Interaction type:** `fill-in`.

An open-ended written response — "what will you apply from this lesson?". Not auto-graded: the learner's text is captured and reported as a **completed** interaction. A future evaluator (the Tier-3 cloud LLM grader) can assess it via the **evaluation hook** (§5); v0 ships no evaluator.

## 1. DOM model

**Light DOM**. Enhances the authored prompt into a `<label>` + `<textarea>` + a Save button. No shadow root.

## 2. Authoring shape

```html
<oelt-reflection id="takeaway" maxlength="500">
  <p slot="prompt">What is one thing you will apply from this lesson?</p>
</oelt-reflection>
```

## 3. Attributes

| Attribute      | Values      | Default   | Meaning                                                                       |
| -------------- | ----------- | --------- | ----------------------------------------------------------------------------- |
| `id`           | identifier  | —         | Required. Interaction id; matches the manifest declaration & `detail.id`.      |
| `maxlength`    | integer ≥ 1 | `500`     | Max characters. Bounds the persisted state (§7). Larger values must respect the suspend budget. |
| `rows`         | integer     | `4`       | Initial visible rows of the textarea.                                         |
| `submit-label` | string      | `"Save"`  | Label of the Save button.                                                     |

There is no `correct`/grading — reflections are never auto-scored in v0.

## 4. Slots & parts

Slots: `prompt` (the question; becomes the textarea's `<label>`).

Parts: `::part(prompt)` (the label), `::part(input)` (the textarea), `::part(count)` (the live character counter), `::part(submit)`, `::part(feedback)`.

## 5. Events & the evaluation hook (contract designed now, evaluation never implemented)

On **Save** (non-empty text):

1. Emits `oelt-interaction` (base.md §3): `{ id, type: "fill-in", result: "completed", response: text }`. No score.
2. Dispatches an **`oelt-reflection`** `CustomEvent` (`bubbles`, `composed`) — the evaluation hook:

```js
detail = {
  id: "takeaway",
  text: "the learner's response",
  provideFeedback(feedback: { message: string }): void,  // an evaluator calls this to display qualitative feedback
}
```

An evaluator (e.g. the Tier-3 cloud LLM grader) MAY listen for `oelt-reflection`, assess `text`, and call `provideFeedback({ message })` to surface a comment in the `::part(feedback)` region. **v0 ships no evaluator and never calls it** — the reflection is recorded as `completed`, full stop. The hook exists so evaluation can be added later without changing the component contract. Auto-scoring reflections (mapping evaluator output to a score/result) is explicitly out of scope for v0.

Saving with empty text shows "Write a response first." and does not emit. Re-saving updates the response (the latest Save wins); the textarea stays editable (reflections are revisable, not locked).

## 6. Keyboard & screen reader

- The `<label for>` associates the prompt with the `<textarea>`; `Enter` inserts newlines (it does **not** submit — a multi-line field). `Tab` moves to the Save button.
- A live character counter (`::part(count)`, `aria-live="polite"`) announces remaining characters as the learner types (not on every keystroke — throttled to avoid chatter; announced politely).
- On Save, focus moves to the `aria-live="polite"` feedback region ("Response saved.").

## 7. State

Key: the element id. Value: `{ text: string, submitted: boolean }`. **Max 600 bytes** (bounds `maxlength` to ~500 characters plus overhead; this is the largest single-component budget in the inventory — see base.md §4). On resume, restore the textarea content and the saved feedback without re-emitting.

> **SCORM 1.2 note:** `cmi.interactions.n.student_response` for `fill-in` is capped at 255 characters by the LMS, so the recorded response may be truncated there; the full text always round-trips via suspend state (resume) regardless of target. SCORM 2004 / cmi5 record the full response.

## 8. Tracking mapping

`cmi.interactions.n.*` with `type=fill-in`, `student_response` = the text (1.2 truncation per §7), `result=neutral` (SCORM mapping of `completed`). cmi5/xAPI: an `answered` statement. A reflection contributes to completion rules (it can be `required`) but never to score.

## 9. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- `maxlength`, when present, is an integer ≥ 1.

## 10. Open questions

_None blocking. LLM evaluation (consuming `oelt-reflection`, scoring, and feeding back a grade) is a Tier-3 cloud concern, deliberately unimplemented here; the event contract is the entire v0 surface._
