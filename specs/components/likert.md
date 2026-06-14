# `<oelt-likert>` — rating-scale / survey item

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md). **Interaction type:** `likert`.

A single-select rating scale (Likert item): a statement plus an ordered scale the learner rates. It is a **survey** interaction — there is no correct answer, so it always reports `result: "completed"` with no score (tracking-semantics §4.1: "completed" vs "passed" is the component's own contract). It does not aggregate and is **not** a quiz-scored question (the quiz ignores it).

## 1. DOM model

**Light DOM** (content-bearing: the statement and scale labels are authored content). Enhances into a native `<fieldset>` of radios with a `<legend>` statement; no shadow root. Mirrors `<oelt-mcq mode="single">` structurally but without a key/grading.

## 2. Authoring shape

Two ways to define the scale — explicit options (most accessible: a real label per point) or a generated numeric scale with end anchors.

```html
<!-- explicit: one label per point (recommended) -->
<oelt-likert id="confidence">
  <p slot="prompt">I feel confident applying what I learned.</p>
  <oelt-option value="1">Strongly disagree</oelt-option>
  <oelt-option value="2">Disagree</oelt-option>
  <oelt-option value="3">Neutral</oelt-option>
  <oelt-option value="4">Agree</oelt-option>
  <oelt-option value="5">Strongly agree</oelt-option>
</oelt-likert>

<!-- generated: N points with end anchors -->
<oelt-likert id="ease" scale="5" low-label="Very hard" high-label="Very easy">
  <p slot="prompt">How easy was this lesson?</p>
</oelt-likert>
```

In generated mode the points are numbered `1…N`; the first and last radio labels incorporate `low-label` / `high-label` (e.g. "1 — Very hard", "5 — Very easy") so the anchors are part of each end point's accessible name, not floating text.

## 3. Attributes

| Attribute      | Values      | Default    | Meaning                                                                  |
| -------------- | ----------- | ---------- | ------------------------------------------------------------------------ |
| `id`           | identifier  | —          | Required. Interaction id; matches the manifest declaration & `detail.id`. |
| `scale`        | integer ≥ 2 | `5`        | (generated mode) Number of scale points. Ignored if `<oelt-option>`s given. |
| `low-label`    | string      | absent     | (generated mode) Anchor for point 1.                                     |
| `high-label`   | string      | absent     | (generated mode) Anchor for point N.                                     |
| `submit-label` | string      | `"Submit"` | Label of the submit button.                                              |
| `retry`        | boolean     | absent     | Allow changing the response after submit (re-emits).                     |

## 4. Slots & parts

Slots: `prompt` (the statement; becomes the `<legend>`), default slot (`<oelt-option>`s in explicit mode).

Parts: `::part(group)` (the fieldset), `::part(option)`, `::part(option-input)`, `::part(option-label)`, `::part(submit)`, `::part(feedback)`.

## 5. Events

Emits `oelt-interaction` (per [base.md §3](./base.md)) on submit:

```js
{ id, type: "likert", result: "completed", response: chosenValue }
```

No `score` (surveys are not scored). Submitting with nothing selected shows "Select a rating first." and does not emit. Without `retry`, the radios + submit lock after the first submit and the interaction emits once.

## 6. Keyboard

Native radio-group semantics — no custom key handling:

| Key                 | Action                                              |
| ------------------- | --------------------------------------------------- |
| `Tab` / `Shift+Tab` | Move between the radio group and the submit button. |
| `↑`/`↓`/`←`/`→`     | Move and select within the scale.                   |
| `Enter`             | Activate the submit button.                         |

## 7. Screen-reader behavior

- The `<fieldset>`/`<legend>` associates the statement with the group; radios announce position ("3 of 5") and their label.
- On submit, focus moves to the `aria-live="polite"` feedback region, which confirms "Response recorded." There is no correct/incorrect state (survey), so nothing is announced as right or wrong.
- Documented fully in `README.md`; manual NVDA + VoiceOver pass before `stable`.

## 8. State

Key: the element id. Value: `{ sel: string, submitted: boolean }` — selected value + submitted flag. **Max 48 bytes.** On resume, restore the selection and submitted/locked UI without re-emitting.

## 9. Tracking mapping

Recorded as `cmi.interactions.n.*` with `type=likert`, `student_response` = the chosen value, and `result` = `neutral` (SCORM mapping of `completed`). cmi5/xAPI: an `answered` statement. A survey item contributes to completion rules (it can be `required`) but never to score.

## 10. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- At least two scale points (explicit options or `scale` ≥ 2).
- `scale`, when present, is an integer ≥ 2.

## 11. Open questions

_None blocking. Named scale presets (agree / frequency / satisfaction) and a "not applicable" option are candidates for a later revision; v0 is explicit options or a numeric scale with end anchors._
