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

## Develop

```bash
npm run build -w @oeltkit/components   # ESM + IIFE (dist/oelt.min.js)
npm test                               # unit (grading logic)
npm run test:a11y                      # Playwright: axe-clean, keyboard, tracking-in-harness
npm run harness -- examples/components-demo   # drive all three in the fake LMS
```

Demos live in [`harness/demos/`](../../harness/demos/); the in-harness tracking course is [`examples/components-demo/`](../../examples/components-demo/).
