# OELT Course Manifest — `course.json` (v0)

**Status:** Normative. Version `0.1`.
**Schema:** [`schema/course.schema.json`](./schema/course.schema.json) (JSON Schema draft 2020-12).
**Derived from:** [Decision 1 — Option C](./DECISION-1-manifest-schema.md) ("structured shell, free body").
**Change control:** This is a versioned spec. Changes require human sign-off and a version bump per the rules in [§8](#8-versioning). Specs win over code.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as in RFC 2119.

---

## 1. Purpose and model

`course.json` is the single source of truth for an OELT course. The packager derives `imsmanifest.xml` / `cmi5.xml` from it, the runtime derives navigation and completion logic from it, the validators check it, and the MCP authoring tools read and write it. No other artifact is authoritative; if generated output disagrees with the manifest, the generator is wrong.

The model is **structured shell, free body**:

- The manifest holds **structure** (modules → pages), **metadata**, **tracking rules**, and a **theme** reference.
- **Page content is free HTML**, referenced by `src`. The manifest never describes content.
- A page MAY additionally declare its **tracked interactions** so that tracking configuration is machine-checkable without parsing creative HTML. This declaration is the only bridge between the structured shell and the free body.

A manifest with no `interactions` and no `tracking` block is a valid, structure-only course (it behaves identically to Decision 1's Option A). Tracking is layered on by declaring interactions and adding a `tracking` block; nothing about the content model changes.

## 2. Top-level object

```jsonc
{
  "oelt": "0.1", // required — manifest schema version
  "id": "com.bcl.data-privacy-101", // required — reverse-DNS course id
  "title": "Data Privacy Essentials", // required
  "lang": "en", // required — BCP-47 tag
  "targets": ["scorm12", "cmi5", "web"], // required — ≥1 distribution target
  "theme": "./theme/tokens.css", // optional — token override CSS
  "tracking": {
    /* §5 */
  }, // optional — absent ⇒ zero-config defaults
  "structure": [
    /* §3 */
  ], // required — ≥1 module
}
```

| Field       | Required | Type              | Notes                                                                                                               |
| ----------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `oelt`      | yes      | string `\d+\.\d+` | Schema version. A consumer MUST refuse a major version it does not understand.                                      |
| `id`        | yes      | string            | Reverse-DNS, lowercase: `^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$`. Becomes the package/activity identifier on every target. |
| `title`     | yes      | string            | 1–255 chars.                                                                                                        |
| `lang`      | yes      | string            | BCP-47 (`en`, `en-GB`, `fr-CA`). Drives the document `lang` attribute — a WCAG 2.2 requirement, hence mandatory.    |
| `targets`   | yes      | string[]          | Non-empty, unique. Each ∈ `scorm12`, `scorm2004`, `cmi5`, `web`.                                                    |
| `theme`     | no       | string            | Path (relative to the manifest) to a CSS file overriding `--oelt-*` tokens.                                         |
| `tracking`  | no       | object            | See §5. **Absent ⇒ zero-config defaults** (§5.1).                                                                   |
| `structure` | yes      | object[]          | See §3.                                                                                                             |

No properties beyond these are permitted at the top level (`additionalProperties: false`). Unknown keys are a validation error, not a silent passthrough — this fails LLM typos loudly.

## 3. Structure: modules and pages

`structure` is an **ordered** array of modules; a module is an ordered array of pages. Order is significant — it is the default linear navigation order.

```jsonc
"structure": [
  { "id": "m1", "title": "Foundations", "pages": [
    { "id": "m1p1", "title": "Why privacy matters", "src": "pages/m1p1.html" },
    { "id": "m1p2", "title": "A day in the life",   "src": "pages/m1p2.html" }
  ]},
  { "id": "m2", "title": "Assessment", "pages": [
    { "id": "m2p1", "title": "Final quiz", "src": "pages/m2p1.html",
      "interactions": [
        { "id": "final-quiz", "type": "quiz", "weight": 1.0, "required": true }
      ]}
  ]}
]
```

**Module** — `id` (required), `title` (required), `pages` (required, ≥1). No other keys.

**Page** — `id` (required), `title` (required), `src` (required), `interactions` (optional, ≥1 when present). No other keys.

- `src` is a path relative to the manifest pointing at the page's HTML body file. The file is free HTML/JS/SVG/CSS and MAY use OELT custom elements (`<oelt-*>`).
- `interactions` declares the page's **tracked** interactions. Omit it for untracked pages.

### 3.1 Identifiers

Every `id` (module, page, interaction) MUST match `^[A-Za-z][A-Za-z0-9_-]*$` and be **unique within the whole course**, not merely within its parent. Ids are used as DOM ids and as the seed for target-specific identifiers, so collisions corrupt both navigation and tracking. Uniqueness across the whole course is a validator rule (the schema enforces only the format).

## 4. Interactions

An interaction is the contract that lets tracking reference page content without parsing it.

```jsonc
{ "id": "final-quiz", "type": "quiz", "weight": 1.0, "required": true }
```

| Field      | Required | Type                       | Default | Notes                                                                                                                                                                  |
| ---------- | -------- | -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | yes      | identifier                 | —       | MUST match the `id` of an element in the page's HTML.                                                                                                                  |
| `type`     | yes      | string `^[a-z][a-z0-9-]*$` | —       | Kind of interaction (`mcq`, `quiz`, `branching`, `text-entry`, …). v0 does not constrain the vocabulary; the validator checks it against the element actually present. |
| `weight`   | no       | number ≥ 0                 | `1.0`   | Relative weight for `score.rule = weighted-interactions`. Ignored otherwise.                                                                                           |
| `required` | no       | boolean                    | `false` | Whether completion rules `required-interactions-*` count this interaction.                                                                                             |

### 4.1 The declaration ↔ HTML sync rule

There are two sources of truth — the declaration and the HTML — bridged by a validator rule, **not** at runtime:

1. **Existence.** Every declared interaction `id` MUST correspond to an element with that `id` in the referenced page HTML. A declaration with no matching element is a validation error.
2. **Type agreement.** Where the element is an OELT component, its kind MUST agree with the declared `type`. (For bespoke elements the validator can only check existence.)
3. **Reachability.** Every interaction referenced by a tracking rule (a `required` interaction under a `required-interactions-*` rule, or a `score.source`) MUST be reachable through navigation from the course entry.

The MCP `update_page` tool keeps declarations and HTML in sync on edit. The runtime trusts the declaration; it does not re-derive interactions from the DOM.

## 5. Tracking

`tracking` selects from a **small closed vocabulary of rules** (Decision 2, Option 2). It is not a formula language. Each sub-block is optional.

```jsonc
"tracking": {
  "completion": { "rule": "required-interactions-passed" },
  "score":      { "rule": "weighted-interactions", "mastery": 0.8 },
  "progress":   { "rule": "pages-viewed" }
}
```

The full semantics — including how each rule maps onto SCORM 1.2 / 2004 / cmi5 / standalone, and the SCORM 1.2 completion/success collapse rule — are normative in [`tracking-semantics.md`](./tracking-semantics.md). This section defines only the manifest shape and the cross-field constraints the schema enforces.

### 5.1 Zero-config defaults

When `tracking` is **absent**, the course behaves as:

```jsonc
{
  "completion": { "rule": "all-pages-viewed" },
  "score": { "rule": "none" },
  "progress": { "rule": "pages-viewed" },
}
```

A present `tracking` block with a missing sub-key uses that sub-key's default above. Authors never need a `tracking` block for the common "view everything to complete" course.

### 5.2 Completion rules

| `rule`                            | Meaning                                                        | Extra fields                         |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `all-pages-viewed`                | Complete when every page has been viewed. (Default.)           | —                                    |
| `pages-viewed`                    | Complete when `threshold` fraction of pages viewed.            | `threshold` **required** (0 < t ≤ 1) |
| `required-interactions-completed` | Complete when all `required: true` interactions are completed. | —                                    |
| `required-interactions-passed`    | Complete when all `required: true` interactions are passed.    | —                                    |
| `manual`                          | Author code calls `oelt.track.complete()`.                     | —                                    |

`threshold` is valid **only** with `pages-viewed`, and is **required** there. The schema enforces both directions.

### 5.3 Score rules

| `rule`                  | Meaning                                            | Extra fields                           |
| ----------------------- | -------------------------------------------------- | -------------------------------------- |
| `none`                  | No score reported. (Default.)                      | — `mastery` MUST NOT be set            |
| `single-interaction`    | Score is the score of one named interaction.       | `source` **required** (interaction id) |
| `weighted-interactions` | Score is the weighted mean of scored interactions. | uses each interaction's `weight`       |

`source` is valid **only** with `single-interaction`, and is **required** there. `mastery` (0–1) MAY be set on `single-interaction` or `weighted-interactions` and maps to passed/failed where the target supports it; it MUST NOT be set when `rule = none`. The schema enforces these.

> **Lint rule (validator, beyond the schema):** `mastery` set without a score-producing rule is an error. A completion rule of `required-interactions-passed` with no `required` interaction declared is an error.

### 5.4 Progress rules

| `rule`         | Meaning                                         |
| -------------- | ----------------------------------------------- |
| `pages-viewed` | Progress = fraction of pages viewed. (Default.) |
| `none`         | No progress reported.                           |

## 6. Worked example

The minimal valid course (see [`../examples/minimal/`](../examples/minimal/course.json)):

```json
{
  "oelt": "0.1",
  "id": "org.oeltkit.minimal",
  "title": "Minimal Course",
  "lang": "en",
  "targets": ["web"],
  "structure": [
    {
      "id": "m1",
      "title": "Module 1",
      "pages": [{ "id": "p1", "title": "Welcome", "src": "pages/p1.html" }]
    }
  ]
}
```

No `tracking`, no `interactions`: a one-page, all-pages-viewed course that builds for the `web` target.

## 7. Validation

A manifest is valid iff it (a) validates against `course.schema.json` **and** (b) passes the validator rules the schema cannot express:

- All ids unique across the whole course (§3.1).
- Declaration ↔ HTML existence, type agreement, reachability (§4.1).
- `mastery` requires a score-producing rule (§5.3).
- `required-interactions-*` requires at least one `required` interaction (§5.3).
- Suspend-data budget (≤ 3 KB enforced) — see `tracking-semantics.md`.

The schema is necessary but not sufficient; `oelt validate` is the authority. Validator output is machine-readable so an LLM can consume and fix its own failures.

## 8. Versioning

The `oelt` field is `MAJOR.MINOR`.

- **MINOR** bump: backward-compatible additions (new optional fields, new enum members). Older courses remain valid.
- **MAJOR** bump: anything that could invalidate an existing course. Requires migration tooling and human sign-off.

A consumer MUST refuse a manifest whose MAJOR version it does not implement, rather than guessing. v0 of the toolkit reads `0.x`.
