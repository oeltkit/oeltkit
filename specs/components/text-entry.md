# `<oelt-text-entry>` — short text / numeric response

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md). **Interaction type:** `fill-in` (text mode) / `numeric` (numeric mode).

A single-line free-response question. The learner types an answer into a native `<input>`; on submit the element grades it against an author-supplied key — exact/normalized matching for text, absolute-tolerance matching for numbers — and reports one `oelt-interaction`. It does not aggregate; a quiz container (later) does that.

## 1. DOM model

**Light DOM** (content-bearing: the prompt and feedback are authored content themes must reach). The element enhances its authored markup into a native `<label>` + `<input>` + submit `<button>`; no shadow root. Pre-upgrade the prompt text is readable content.

## 2. Authoring shape

```html
<oelt-text-entry id="capital" answer="Paris">
  <p slot="prompt">What is the capital of France?</p>
  <p slot="correct">Correct — Paris.</p>
  <p slot="incorrect">Not quite — it's Paris.</p>
</oelt-text-entry>

<!-- numeric with tolerance -->
<oelt-text-entry id="pi" mode="numeric" answer="3.14" tolerance="0.01">
  <p slot="prompt">Estimate π to two decimal places.</p>
</oelt-text-entry>

<!-- multiple accepted spellings (text mode, pipe-separated) -->
<oelt-text-entry id="color" answer="grey|gray">
  <p slot="prompt">Spell the colour of the sky at dusk (either spelling).</p>
</oelt-text-entry>
```

## 3. Attributes

| Attribute        | Values              | Default          | Meaning                                                                                                            |
| ---------------- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `id`             | identifier          | —                | Required. Interaction id; matches the manifest declaration and `detail.id`.                                        |
| `mode`           | `text` \| `numeric` | `text`           | Matching mode.                                                                                                     |
| `answer`         | string              | —                | Accepted answer(s). Text: one or more, `\|`-separated. Numeric: the target number. Required unless `manual-grade`. |
| `tolerance`      | number ≥ 0          | `0`              | (numeric) Absolute tolerance: passed iff `\|input − answer\| ≤ tolerance`.                                         |
| `case-sensitive` | boolean             | absent           | (text) Match case exactly. Default: case-insensitive.                                                              |
| `placeholder`    | string              | absent           | Input placeholder text.                                                                                            |
| `submit-label`   | string              | `"Check answer"` | Label of the submit button.                                                                                        |
| `retry`          | boolean             | absent           | Allow re-answering after feedback (re-emits on each submit).                                                       |
| `manual-grade`   | boolean             | absent           | No `answer`; emits `result:"completed"` (no pass/fail) — capture an open response.                                 |

## 4. Slots & parts

Slots: `prompt` (the question; becomes the input's `<label>`), `correct` / `incorrect` (feedback shown after submit).

Parts: `::part(prompt)` (the label), `::part(input)`, `::part(submit)`, `::part(feedback)`. Correctness state exposed via `::part(feedback correct)` / `::part(feedback incorrect)` after submit.

## 5. Grading & events

Normalization (text mode): trim, collapse internal whitespace to a single space, and lowercase — unless `case-sensitive` is set, which skips the lowercasing. The same normalization is applied to each `|`-separated accepted answer.

Emits `oelt-interaction` (per [base.md §3](./base.md)) on submit:

- **text**: `{ id, type:"fill-in", result: normalized(input) ∈ normalized(answers) ? "passed":"failed", score: passed?1:0, response: rawInput }`.
- **numeric**: parse `input` as a number; if it is not a finite number → `failed`, `score:0`. Otherwise `passed` iff `|input − answer| ≤ tolerance`, compared float-safely (a magnitude-scaled epsilon is added to `tolerance`) so values exactly on the boundary pass **symmetrically** — e.g. with `answer=3.14 tolerance=0.01`, both `3.13` and `3.15` pass. `{ id, type:"numeric", result, score: passed?1:0, response: rawInput }`.
- **manual-grade**: `{ id, type:"fill-in", result:"completed", response: rawInput }`, no `score`.

Submitting an empty input shows "Enter an answer first." and does **not** emit. Without `retry`, the input + submit disable after the first submit and the interaction emits once.

## 6. Keyboard

Native semantics; no custom roving focus:

| Key                 | Action                                                   |
| ------------------- | -------------------------------------------------------- |
| `Tab` / `Shift+Tab` | Move between the input and the submit button.            |
| `Enter` (in input)  | Submit the answer (equivalent to activating the button). |
| `Enter` (on button) | Submit the answer.                                       |

## 7. Screen-reader behavior

- The `<label for>` associates the prompt with the input, so the question is announced on focus.
- Numeric mode sets `inputmode="decimal"` on a `type="text"` input (not `type="number"`) — this gives a numeric soft keyboard without the spinbutton/locale pitfalls of `type="number"`, and lets the component parse and tolerance-check the raw value.
- On submit, focus moves to the `aria-live="polite"` feedback region so the result is announced; pass/fail is conveyed in the feedback text (and a visually-hidden "Correct"/"Incorrect" prefix), never by colour alone (WCAG 1.4.1).
- Documented fully in the component `README.md`; manual NVDA + VoiceOver pass before `stable`.

## 8. State

Key: the element id. Value: `{ val: string, submitted: boolean }` — the learner's entered text and the submitted flag. **Max 256 bytes** (the stored response is the learner's answer, bounded to a short response; see [base.md §4](./base.md) and the suspend-budget registry). On resume, restore the input value and submitted/disabled UI without re-emitting the interaction.

## 9. Tracking mapping

The runtime records the emitted interaction as `cmi.interactions.n.*` (SCORM: `type=fill-in`/`numeric`, `student_response` = the raw input, `result` = correct/wrong/neutral) and an xAPI `answered` statement (cmi5), per tracking-semantics §7. Pass/fail and score contribute to completion/score rules only as the manifest specifies.

## 10. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- `answer` present unless `manual-grade` is set.
- `tolerance`, when present, parses as a number ≥ 0 and is only meaningful with `mode="numeric"`.

## 11. Open questions

_None blocking. Per-answer regex/pattern matching and "contains" matching are candidates for a later revision after authoring feedback; v0 is exact-normalized / pipe-alternatives only._
