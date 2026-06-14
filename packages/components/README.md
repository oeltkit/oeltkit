# @oeltkit/components

Accessible, themeable, auto-tracked custom elements (`<oelt-*>`) for OELT courses. Vanilla custom elements — **no framework, zero runtime dependencies**. Each is authored as plain HTML; it emits an `oelt-interaction` event that the runtime maps to SCORM/cmi5/web tracking — the author writes no tracking code.

> Status: `beta` (pending manual NVDA/VoiceOver passes). Contracts: [`specs/components/`](../../specs/components/). Base contract: [base.md](../../specs/components/base.md).

Loading the bundle (or importing the ESM entry) registers the elements:

```html
<script src="oelt.min.js"></script>
<!-- or: import "@oeltkit/components"; -->
```

All three are **light DOM** (author CSS/themes reach the content), styled via `--oelt-*` tokens, themeable via `::part()`, fully keyboard-operable, and screen-reader documented in their specs. They persist UI state through `oelt.state` (quota-enforced) and round-trip through suspend/resume.

## `<oelt-mcq>` — multiple choice / multiple response

Single-answer (radio) or multiple-answer (checkbox), built on a native `<fieldset>`.

```html
<!-- single answer -->
<oelt-mcq id="q1" mode="single" key="b">
  <p slot="prompt">Which standard does cmi5 build on?</p>
  <oelt-option value="a">SCORM 1.2</oelt-option>
  <oelt-option value="b">xAPI</oelt-option>
  <oelt-option value="c">AICC</oelt-option>
  <p slot="correct">Right — cmi5 is an xAPI profile.</p>
  <p slot="incorrect">Not quite — cmi5 is built on xAPI.</p>
</oelt-mcq>

<!-- multiple response: key lists every correct value -->
<oelt-mcq id="q2" mode="multiple" key="a c">
  <p slot="prompt">Select every accessibility requirement (choose all that apply).</p>
  <oelt-option value="a">Keyboard operable</oelt-option>
  <oelt-option value="b">Mouse only</oelt-option>
  <oelt-option value="c">Visible focus</oelt-option>
</oelt-mcq>

<!-- ungraded poll: omit key, add manual-grade -->
<oelt-mcq id="poll1" manual-grade>
  <p slot="prompt">How confident are you?</p>
  <oelt-option value="low">Low</oelt-option>
  <oelt-option value="high">High</oelt-option>
</oelt-mcq>
```

Emits `oelt-interaction` on submit (`type: "choice"`). Spec: [mcq.md](../../specs/components/mcq.md).

## `<oelt-branching>` — branching scenario

A decision graph; each choice emits an interaction, resume restores position by stored path (not content).

```html
<oelt-branching id="scenario1" start="n1">
  <script type="application/json">
    {
      "nodes": {
        "n1": {
          "text": "<p>A learner shares a password with you. You…</p>",
          "choices": [
            { "label": "Use it", "to": "bad", "value": "use" },
            { "label": "Report it", "to": "good", "value": "report" }
          ]
        },
        "good": { "text": "<p>Correct — report and rotate it.</p>", "end": "passed" },
        "bad": {
          "text": "<p>That's a breach.</p>",
          "choices": [{ "label": "Back", "to": "n1", "value": "back" }]
        }
      }
    }
  </script>
</oelt-branching>

<!-- or load the graph from a file -->
<oelt-branching id="scenario2" src="scenarios/onboarding.json" start="intro"></oelt-branching>
```

Emits `oelt-interaction` per branch and at the terminal node (`type: "sequencing"`). Spec: [branching.md](../../specs/components/branching.md).

## `<oelt-media>` — accessible media

Wraps native `<video>`/`<audio>`; **refuses to render without captions or a transcript**; adds a transcript disclosure; reports completion at a watched threshold.

```html
<oelt-media id="intro-video" threshold="0.9">
  <video controls preload="metadata" width="480">
    <source src="media/intro.mp4" type="video/mp4" />
    <track kind="captions" src="media/intro.en.vtt" srclang="en" label="English" default />
  </video>
  <div slot="transcript">
    <p>Full transcript of the introduction…</p>
  </div>
</oelt-media>
```

A `<video>` without a captions track (and no transcript) renders a visible error instead of the player — this also fails `oelt validate a11y`. Emits `oelt-interaction` (`type: "media"`, `result: "completed"`) once past the threshold. Spec: [media.md](../../specs/components/media.md).

## `<oelt-text-entry>` — short text / numeric response

A single-line free-response question. Enhances the authored prompt into a native `<label>` + `<input>`; grades on submit and reports one `oelt-interaction`. Text mode matches case-insensitively after trimming/collapsing whitespace; numeric mode matches within an absolute `tolerance`.

```html
<!-- text: one accepted answer, or several via | -->
<oelt-text-entry id="capital" answer="Paris">
  <p slot="prompt">What is the capital of France?</p>
  <p slot="correct">Correct — Paris.</p>
  <p slot="incorrect">Not quite — it's Paris.</p>
</oelt-text-entry>

<!-- numeric with tolerance -->
<oelt-text-entry id="pi" mode="numeric" answer="3.14" tolerance="0.01">
  <p slot="prompt">Estimate π to two decimal places.</p>
</oelt-text-entry>

<!-- open response (no key): captured, marked completed -->
<oelt-text-entry id="why" manual-grade>
  <p slot="prompt">In a word, how did this lesson feel?</p>
</oelt-text-entry>
```

`Enter` in the input submits. Emits `oelt-interaction` with `type: "fill-in"` (text) or `type: "numeric"`, `result` passed/failed (or `completed` for `manual-grade`), and `response` set to the raw input. `case-sensitive` forces exact-case text matching; `retry` allows re-answering. Spec: [text-entry.md](../../specs/components/text-entry.md).

**Screen-reader:** the prompt is the input's `<label>`; on submit, focus moves to the `aria-live="polite"` feedback and correctness is conveyed in text (visually-hidden "Correct"/"Incorrect" prefix), never colour alone. Numeric mode uses `inputmode="decimal"` on a text input (not `type="number"`) for a numeric soft keyboard without spinbutton/locale pitfalls.

## `<oelt-quiz>` — question container

Wraps question components, aggregates their results into one **weighted** score, and reports a single interaction. Children (`<oelt-mcq>`, `<oelt-text-entry>`, …) still report their own item-level interactions; the quiz adds the aggregate the score rule consumes.

```html
<oelt-quiz id="final" mastery="0.7">
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

Each question may carry a `weight` (default 1); the quiz score is `Σ(weightᵢ·scoreᵢ)/Σ(weightᵢ)`. `mastery` (0–1) makes the result `passed`/`failed` (else `completed`). `pool="N"` shows a random N of the questions (a question bank); `shuffle` randomizes order. The quiz emits `oelt-interaction` (`type: "performance"`) once every active question is answered.

**Screen-reader:** a `::part(status)` live region announces progress ("Answered 1 of 2 questions") and the final outcome ("Quiz complete. Score 75%."); pooled-out questions get `hidden`. Spec: [quiz.md](../../specs/components/quiz.md).

## `<oelt-likert>` — rating-scale / survey item

A single-select rating scale. Survey semantics: no correct answer, so it emits `result: "completed"` with no score (and the quiz ignores it). Give explicit labels per point, or generate a numeric scale with end anchors.

```html
<!-- explicit labels (recommended) -->
<oelt-likert id="confidence">
  <p slot="prompt">I feel confident applying what I learned.</p>
  <oelt-option value="1">Strongly disagree</oelt-option>
  <oelt-option value="3">Neutral</oelt-option>
  <oelt-option value="5">Strongly agree</oelt-option>
</oelt-likert>

<!-- generated N-point scale with end anchors -->
<oelt-likert id="ease" scale="5" low-label="Very hard" high-label="Very easy">
  <p slot="prompt">How easy was this lesson?</p>
</oelt-likert>
```

Emits `oelt-interaction` (`type: "likert"`, `result: "completed"`, `response` = chosen value). Built on a native `<fieldset>` of radios — arrow keys move/select, the prompt is the `<legend>`. In generated mode the end anchors fold into the first/last radio labels ("1 — Very hard"). Spec: [likert.md](../../specs/components/likert.md).

## `<oelt-ordering>` — sequence / ranking

Reorder items into the correct sequence. **Keyboard-first** drag-and-drop (the family model — see [dnd-family.md](../../specs/components/dnd-family.md)); pointer drag is an enhancement.

```html
<oelt-ordering id="lifecycle">
  <p slot="prompt">Put the steps in order, first to last.</p>
  <oelt-item value="plan">Plan</oelt-item>
  <oelt-item value="build">Build</oelt-item>
  <oelt-item value="test">Test</oelt-item>
  <oelt-item value="ship">Ship</oelt-item>
</oelt-ordering>
```

Authored order is correct; items start shuffled. **Keyboard:** focus an item, `Space` to pick up, `↑`/`↓` to move, `Space` to drop, `Esc` to cancel — every step announced via an assertive live region. On **Check** emits `oelt-interaction` (`type: "sequencing"`, `score` = fraction in the correct position, `passed` iff exact, `response` = ordered values). Spec: [ordering.md](../../specs/components/ordering.md).

## `<oelt-matching>` — match values to prompts

Assign each value to its correct prompt. Same keyboard-first model as ordering.

```html
<oelt-matching id="capitals">
  <p slot="prompt">Match each country to its capital.</p>
  <oelt-pair prompt="France" value="paris">Paris</oelt-pair>
  <oelt-pair prompt="Japan" value="tokyo">Tokyo</oelt-pair>
  <oelt-pair prompt="Egypt" value="cairo">Cairo</oelt-pair>
</oelt-matching>
```

Values start shuffled in a bank. **Keyboard:** focus a value, `Space` to pick up, `←`/`→` to move it across the prompt targets (and the bank), `Space` to drop, `Esc` to cancel — every step announced. One value per target (dropping displaces the previous one to the bank). On **Check** emits `oelt-interaction` (`type: "matching"`, `score` = fraction of targets holding the correct value, `passed` iff all, `response` = `prompt=value` pairs). Spec: [matching.md](../../specs/components/matching.md).

## `<oelt-categorize>` — sort items into categories

Sort tokens into category buckets. A bucket holds many tokens (unlike matching's 1:1).

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

Tokens start shuffled in a bank. **Keyboard:** focus a token, `Space` to pick up, `←`/`→` across buckets (and the bank), `Space` to drop, `Esc` to cancel — every step announced. On **Check** emits `oelt-interaction` (`type: "matching"`, `score` = fraction of tokens in their correct bucket, `passed` iff all, `response` = `token=bucket` pairs). Spec: [categorize.md](../../specs/components/categorize.md).

> The drag-and-drop family (`<oelt-ordering>`, `<oelt-matching>`, `<oelt-categorize>`) shares one keyboard pick-up/move/drop model, documented once in [dnd-family.md](../../specs/components/dnd-family.md) and implemented by a shared `GrabController`. Native `<button>` items, no deprecated `aria-grabbed`, SR announcement on every state change, `prefers-reduced-motion` honored.

## Develop

```bash
npm run build -w @oeltkit/components   # ESM + IIFE (dist/oelt.min.js)
npm test                               # unit (grading logic)
npm run test:a11y                      # Playwright: axe-clean, keyboard, tracking-in-harness
npm run harness -- examples/components-demo   # drive all three in the fake LMS
```

Demos live in [`harness/demos/`](../../harness/demos/); the in-harness tracking course is [`examples/components-demo/`](../../examples/components-demo/).
