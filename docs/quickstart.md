# OELTKit Quickstart

Build a standards-compliant, accessible e-learning course from a single source and package it for
any LMS. This walkthrough builds a short course with a quiz that requires 80% to complete, then
produces a SCORM 1.2 package.

> Companion: [`llms.txt`](./llms.txt) is the complete, copy-pasteable reference (manifest schema,
> components, runtime API, CLI). This page is the narrative path.

## 0. Prerequisites

Node ≥ 20. In this repo the CLI runs as `node packages/cli/dist/esm/index.js` after
`npm install && npm run build`; once published it is the `oelt` binary. Below we write `oelt`.

## 1. Scaffold

```bash
oelt new privacy-basics --title "Privacy Basics"
```

This creates:

```
privacy-basics/
  course.json        # the manifest — your source of truth
  pages/p1.html      # a starter page
```

## 2. Define structure, tracking, and the 80% gate

Edit `course.json`. A course is modules → pages. To require an 80% quiz score to complete, use a
scoring rule with `mastery: 0.8` and gate completion on passing the required interaction:

```json
{
  "oelt": "0.1",
  "id": "org.oelt.privacy-basics",
  "title": "Privacy Basics",
  "lang": "en",
  "targets": ["scorm12", "scorm2004", "cmi5", "web"],
  "tracking": {
    "completion": { "rule": "required-interactions-passed" },
    "score": { "rule": "weighted-interactions", "mastery": 0.8 }
  },
  "structure": [
    {
      "id": "m1",
      "title": "Privacy Basics",
      "pages": [
        { "id": "intro", "title": "Why privacy matters", "src": "pages/intro.html" },
        { "id": "rules", "title": "The rules", "src": "pages/rules.html" },
        {
          "id": "quiz",
          "title": "Knowledge check",
          "src": "pages/quiz.html",
          "interactions": [
            { "id": "q1", "type": "choice", "weight": 1, "required": true },
            { "id": "q2", "type": "choice", "weight": 1, "required": true }
          ]
        }
      ]
    }
  ]
}
```

Two equally-weighted questions, both required and passed → 100% ≥ 80% mastery → `passed`. (On SCORM
1.2 the single status field will report `passed`; on SCORM 2004/cmi5, completion and success are
reported separately. The runtime handles the mapping.)

## 3. Author the pages

Pages are free HTML fragments. Keep one `<h1>` per page and use components for interactions.

`pages/intro.html`:

```html
<section>
  <h1>Why privacy matters</h1>
  <p>
    Mishandled personal data erodes trust and breaks the law. This course covers the essentials.
  </p>
</section>
```

`pages/quiz.html` — two `<oelt-mcq>` whose ids match the manifest:

```html
<section>
  <h1>Knowledge check</h1>

  <oelt-mcq id="q1" mode="single" key="b">
    <p slot="prompt">What is personal data?</p>
    <oelt-option value="a">Only government IDs</oelt-option>
    <oelt-option value="b">Any information relating to an identifiable person</oelt-option>
    <oelt-option value="c">Only data marked "confidential"</oelt-option>
    <p slot="correct">Correct.</p>
    <p slot="incorrect">Personal data is any information relating to an identifiable person.</p>
  </oelt-mcq>

  <oelt-mcq id="q2" mode="single" key="a">
    <p slot="prompt">A colleague asks for a customer's record "to help out." You…</p>
    <oelt-option value="a">Verify they have a legitimate need first</oelt-option>
    <oelt-option value="b">Send it immediately</oelt-option>
  </oelt-mcq>
</section>
```

No tracking code: each `<oelt-mcq>` emits an interaction the runtime maps to the manifest's rules.

## 4. Preview with a live tracking panel

```bash
oelt preview privacy-basics
# open the printed URL; switch modes (SCORM 1.2 / 2004 / cmi5 / Web) and watch the
# inspector panel show exactly what each LMS records as you answer.
```

## 5. Validate

```bash
oelt validate privacy-basics            # human-readable
oelt validate privacy-basics --json     # machine-readable (consume + fix programmatically)
```

It checks the schema, id uniqueness, that each declared interaction exists in its page, media
captions/transcripts, and that completion is reachable. Fix any errors — packaging refuses
otherwise.

## 6. Package

```bash
oelt package privacy-basics --target scorm12
# → org.oelt.privacy-basics-scorm12.zip
```

Upload the zip to your LMS (or [SCORM Cloud](https://cloud.scorm.com) to verify). The same source
packages for `scorm2004`, `cmi5`, and `web` with no content changes.

## What you did not have to do

Write SCORM/xAPI wiring, hand-edit `imsmanifest.xml`, reinvent an accessible MCQ, or define what
"complete" means per LMS. That is the point: author the learning; OELT standardizes the rest.
