# `<oelt-quiz>` — question container (pooling, randomization, weighted scoring)

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md). **Interaction type:** `performance` (see §9).
**Tracking:** aggregation is grounded in [tracking-semantics.md §5/§7](../tracking-semantics.md).

A container that holds question components (`<oelt-mcq>`, `<oelt-text-entry>`, …), aggregates their per-question results into a single weighted score, and reports **one** `oelt-interaction` for the quiz. It is the only component that aggregates (base.md §3 reserves aggregation for "a quiz container, built later"). Child questions still report their own item-level interactions independently — the quiz does not suppress them (tracking-semantics §7: always record question-level interactions).

## 1. DOM model

**Light DOM** (content-bearing: it wraps authored question markup, intro text, etc.). The element progressively enhances: it discovers its question children, optionally pools/shuffles them, injects a status/summary region, and listens for their `oelt-interaction` events. It never replaces the questions' own markup.

## 2. Authoring shape

```html
<oelt-quiz id="final" mastery="0.7">
  <p>Answer all questions, then your score is reported.</p>

  <oelt-mcq id="q1" mode="single" key="b" weight="1">
    <p slot="prompt">Which standard is recommended for new content?</p>
    <oelt-option value="a">SCORM 1.2</oelt-option>
    <oelt-option value="b">cmi5</oelt-option>
  </oelt-mcq>

  <oelt-text-entry id="q2" answer="cmi5" weight="2">
    <p slot="prompt">Name that standard (one word).</p>
  </oelt-text-entry>
</oelt-quiz>
```

Questions are the quiz's descendant elements whose tag is a **known question type** (v0: `oelt-mcq`, `oelt-text-entry`; the set extends as scored question components are added) and that carry an `id`. Each MAY declare a `weight` (default `1`) consumed by the quiz; the question component itself ignores `weight`.

## 3. Attributes

| Attribute | Values      | Default | Meaning                                                                                         |
| --------- | ----------- | ------- | ----------------------------------------------------------------------------------------------- |
| `id`      | identifier  | —       | Required. Interaction id; matches the manifest declaration and `detail.id`.                     |
| `mastery` | number 0–1  | absent  | Pass threshold. Set ⇒ result is `passed`/`failed` by score ≥ mastery; absent ⇒ `completed`.     |
| `pool`    | integer ≥ 1 | absent  | Show a random N of the available questions (a question bank). Absent ⇒ all questions are shown. |
| `shuffle` | boolean     | absent  | Randomize the order of the (pooled) questions on upgrade.                                       |

When `pool` ≥ the question count, all questions are shown (no pooling). `weight` is read from each question child (§2).

## 4. Slots & parts

The quiz uses **light-DOM children**, not named slots, for the questions and any author prose. It injects:

Parts: `::part(status)` (the live "answered N of M" / final-score region). Pooled-out questions get the native `hidden` attribute (removed from layout and the a11y tree).

## 5. Scoring & events

- **Per-question score**: each child question's most recent `oelt-interaction` supplies its `score` (0–1; treated as 0 if a question emits `failed` with no score, 1 if `passed` with no score, and the reported `score` otherwise).
- **Aggregate**: `Σ(weightᵢ × scoreᵢ) / Σ(weightᵢ)` over the **active** (pooled-in) questions — identical to the manifest `weighted-interactions` formula (tracking-semantics §5), clamped 0–1.
- **Result**: `mastery` set ⇒ `passed` iff aggregate ≥ mastery, else `failed`; `mastery` absent ⇒ `completed`.

The quiz emits its `oelt-interaction` **once every active question has reported at least once**:

```js
{ id: quizId, type: "performance", result, score }
```

If a question allows `retry` and re-emits, the quiz updates that question's score and re-emits the aggregate (latest answer wins). The quiz never emits before all active questions are answered; the status region shows progress until then.

## 6. Keyboard

The quiz adds **no custom key handling** — each child question keeps its own native keyboard model (mcq radios, text-entry input, …). `Tab` order follows DOM order (which `shuffle`/`pool` may have reordered before upgrade, so visual and focus order match).

## 7. Screen-reader behavior

- The status region is `::part(status)` with `role="status"` `aria-live="polite"`: it announces progress ("Answered 1 of 2 questions") as questions are completed, and the final outcome ("Quiz complete. Score 75%.") once all are answered — outcome is conveyed in text, never colour alone (WCAG 1.4.1).
- Pooled-out questions get `hidden`, so AT never encounters them. Reordering for `shuffle` happens in the DOM before upgrade, so reading order matches visual order.
- The quiz adds no roles to the questions themselves; their native semantics are untouched.
- Documented fully in `README.md`; manual NVDA + VoiceOver pass before `stable`.

## 8. State

Key: the element id. Value: `{ active: string[], scores: Record<string, number>, done: boolean }` — the active question ids in display order (so the same pool/order is restored), the latest per-question scores, and whether the aggregate has been emitted. **Max 512 bytes.** Child questions persist their own UI state under their own ids; on resume the quiz restores the pool/order and its tallies and renders the status/summary **without re-emitting** the aggregate (the runtime already restored the reported score across resume).

## 9. Tracking mapping

The quiz's aggregate is recorded like any interaction (tracking-semantics §7) and, more importantly, is the value a `single-interaction` (`source: quizId`) or `weighted-interactions` **score rule** consumes. Child questions are recorded as their own `cmi.interactions` / xAPI statements.

**Interaction type `performance`** (DECIDED, local & reversible per CLAUDE.md rule 6): the SCORM 1.2 `cmi.interactions.n.type` vocabulary has no aggregate/"other" value (SCORM 2004 has `other`; 1.2 does not). `performance` is the only type valid in **both** 1.2 and 2004 that is not a primitive question format, so the quiz uses it for its composite result. Revisit if a real-LMS run (Task 10) rejects it — at which point the SCORM 1.2 adapter would map it to a 1.2-valid fallback.

## 10. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- Contains at least one known question child with an id.
- `pool`, when present, is an integer ≥ 1; `mastery`, when present, parses as a number in 0–1.

## 11. Open questions

_None blocking. Per-question feedback suppression ("don't reveal answers until the quiz is submitted") and an explicit quiz-level submit button are candidates for a later revision; v0 aggregates as questions are answered and relies on each question's own feedback model._
