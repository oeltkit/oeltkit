# `<oelt-mcq>` — multiple choice / multiple response

**Status:** Draft for human review (Task 04). Implementation gated on sign-off.
**Base:** [base.md](./base.md). **Interaction type:** `choice`.

A single-answer (radio) or multiple-answer (checkbox) question. Options are authored as light-DOM markup; the element reports one `oelt-interaction` on submit. It does not aggregate — a quiz container (later) does that.

## 1. DOM model

**Light DOM** (content-bearing: the prompt, options, and feedback are authored content that themes and author CSS must reach). The element progressively enhances its authored children into a native `<fieldset>` of radios/checkboxes; no shadow root.

## 2. Authoring shape

```html
<oelt-mcq id="quiz1" mode="single" key="b">
  <p slot="prompt">Which statement is true?</p>
  <oelt-option value="a">OELT wires each LMS by hand.</oelt-option>
  <oelt-option value="b">OELT maps one model to four targets.</oelt-option>
  <oelt-option value="c">OELT requires a build step.</oelt-option>

  <p slot="correct">Correct — one model, four targets.</p>
  <p slot="incorrect">Not quite — review the Key idea page.</p>
</oelt-mcq>
```

On upgrade, each `<oelt-option value>` becomes a `<label>` wrapping a native `<input type="radio">` (single) or `<input type="checkbox">` (multiple), grouped in a `<fieldset>` whose `<legend>` is the `prompt` content. Authoring with native `<input>`s directly is also supported; the element then manages only grading/feedback/state. Pre-upgrade the markup is still readable content.

## 3. Attributes

| Attribute      | Values                   | Default          | Meaning                                                                     |
| -------------- | ------------------------ | ---------------- | --------------------------------------------------------------------------- |
| `id`           | identifier               | —                | Required. Interaction id; matches the manifest declaration and `detail.id`. |
| `mode`         | `single` \| `multiple`   | `single`         | Radio vs checkbox semantics.                                                |
| `key`          | space-separated `value`s | —                | Correct option value(s). Required unless `manual-grade` is set.             |
| `shuffle`      | boolean                  | absent           | Randomize option order on upgrade (opt-in).                                 |
| `submit-label` | string                   | `"Check answer"` | Label of the submit button.                                                 |
| `retry`        | boolean                  | absent           | Allow re-answering after feedback (re-emits on each submit).                |
| `manual-grade` | boolean                  | absent           | No `key`; emits `result:"completed"` (no pass/fail) — for surveys/polls.    |

## 4. Slots & parts

Slots: `prompt` (the question; becomes the `<legend>`), `correct` / `incorrect` (feedback shown after submit), default slot (the `<oelt-option>`s).

Parts: `::part(group)` (the fieldset), `::part(option)`, `::part(option-input)`, `::part(option-label)`, `::part(submit)`, `::part(feedback)`. Correctness state exposed via `::part(option correct)` / `::part(option incorrect)` after submit.

## 5. Events

Emits `oelt-interaction` (per [base.md §3](./base.md)) on submit:

- `mode="single"`: `{ id, type:"choice", result: chosenValue===key ? "passed":"failed", score: passed?1:0, response: chosenValue }`.
- `mode="multiple"`: passed iff the selected set equals the `key` set exactly; `score` = (|correctly selected| − |incorrectly selected|) clamped to 0–1 of the key size; `response` = selected values joined by `,`.
- `manual-grade`: `{ result:"completed", response }`, no `score`.

Without `retry`, controls disable after the first submit and the interaction is emitted once.

## 6. Keyboard

Native semantics — no custom key handling beyond what the elements provide:

| Key                 | Action                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `Tab` / `Shift+Tab` | Move between the radio group / each checkbox / the submit button. |
| `↑`/`↓`/`←`/`→`     | (single/radio) Move and select within the group.                  |
| `Space`             | (multiple/checkbox) Toggle the focused option.                    |
| `Enter`             | Activate the submit button.                                       |

## 7. Screen-reader behavior

- The `<fieldset>`/`<legend>` associates the prompt with the group; radios announce "n of m"; checkboxes announce checked state.
- Submit moves focus to the feedback region, which is `aria-live="polite"` so the result is announced; each option's correctness is conveyed in text (a visually-hidden "Correct"/"Incorrect" prefix), not by color alone (WCAG 1.4.1).
- `shuffle` reorders DOM before upgrade so SR reading order matches visual order; nothing is announced as "shuffled".
- Documented fully in the component `README.md`; manual NVDA + VoiceOver pass before `stable`.

## 8. State

Key: the element id. Value: `{ sel: string[], submitted: boolean }` (selected values + submitted flag). **Max 64 bytes.** On resume, restore the selection and submitted/disabled UI without re-emitting the interaction.

## 9. Tracking mapping

The runtime records the emitted interaction as `cmi.interactions.n.*` (SCORM, `type=choice`, learner response, result) and an xAPI `answered` statement (cmi5), per tracking-semantics §7. Pass/fail and score contribute to completion/score rules only as the manifest specifies (e.g. as a `required`/weighted interaction).

## 10. Validator obligations

- Element id present and unique; matches a manifest interaction declaration of `type` compatible with `choice` when declared.
- `key` present unless `manual-grade`; every `key` value matches some `<oelt-option value>`.
- At least two options.

## 11. Open questions

_None blocking. Partial-credit formula for `multiple` (§5) is a candidate for revisiting after authoring feedback._
