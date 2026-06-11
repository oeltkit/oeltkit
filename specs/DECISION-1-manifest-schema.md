# Decision 1: Course manifest schema (`course.json`)

**Status: DECIDED — Option C** (Jim, 2026-06-11). This choice gates everything; see PLAN.md §4.0.

The same sample course is expressed in all three options: a 2-module compliance course with an intro page, a branching scenario, and a scored quiz.

---

## Option A — "Structure-only manifest" (HTML-native)

The manifest holds structure, metadata, and tracking rules. **All page content is plain HTML files** authored freely; components are used as custom elements within them. The manifest never describes content.

```json
{
  "oelt": "0.1",
  "id": "com.bcl.data-privacy-101",
  "title": "Data Privacy Essentials",
  "lang": "en",
  "targets": ["scorm12", "scorm2004", "cmi5", "web"],
  "theme": "./theme/tokens.css",
  "tracking": {
    "completion": { "rule": "all-pages-viewed" },
    "score": { "source": "#final-quiz", "mastery": 0.8 }
  },
  "structure": [
    { "id": "m1", "title": "Foundations", "pages": [
      { "id": "m1p1", "title": "Why privacy matters", "src": "pages/m1p1.html" },
      { "id": "m1p2", "title": "A day in the life", "src": "pages/m1p2.html" }
    ]},
    { "id": "m2", "title": "Assessment", "pages": [
      { "id": "m2p1", "title": "Final quiz", "src": "pages/m2p1.html" }
    ]}
  ]
}
```

Page file (`pages/m1p2.html`) is arbitrary HTML — full bespoke freedom:

```html
<section>
  <h1>A day in the life</h1>
  <p>Follow Sam through a workday and spot the privacy risks…</p>
  <!-- any custom HTML/JS/SVG the LLM dreams up -->
  <oelt-branching id="sam-scenario" src="scenarios/sam.json"></oelt-branching>
</section>
```

| Pros | Cons |
|---|---|
| Maximum bespoke freedom — the LLM's strongest output mode (HTML) is untouched | Content not machine-introspectable: `update_page` MCP tool edits raw HTML, validators must parse HTML |
| Simple spec, fast to v0; easy mental model for humans too | Cross-page features (glossary, search, question pools spanning pages) are harder |
| Page files diff/review cleanly | Tracking config references DOM ids — fragile if content edited carelessly |

## Option B — "Content tree" (Adapt-style, fully structured)

The manifest describes **everything** — pages are arrays of typed blocks; HTML is generated. Bespoke content possible only via an `html` block type.

```json
{
  "structure": [
    { "id": "m1", "title": "Foundations", "pages": [
      { "id": "m1p2", "title": "A day in the life", "blocks": [
        { "type": "text", "body": "Follow Sam through a workday…" },
        { "type": "branching", "id": "sam-scenario", "scenario": { "...": "..." } },
        { "type": "html", "src": "blocks/custom-viz.html" }
      ]}
    ]}
  ]
}
```

| Pros | Cons |
|---|---|
| Fully machine-editable; MCP tools and validators operate on clean JSON | **Recreates the template trap** — bespoke creativity squeezed through an escape hatch; the exact failure mode of existing tools |
| Re-theming/re-flowing content is trivial | LLMs writing big JSON content trees are more error-prone than LLMs writing HTML |
| Cross-page features easy | Spec is much larger; v0 takes far longer; renderer becomes a big component |

## Option C — "Structured shell, free body" (hybrid) — **recommended**

Manifest = Option A's structure + tracking, with one addition: pages may declare their **tracked interactions** so tracking config doesn't depend on parsing HTML. Content stays free HTML.

```json
{
  "structure": [
    { "id": "m2", "title": "Assessment", "pages": [
      { "id": "m2p1", "title": "Final quiz", "src": "pages/m2p1.html",
        "interactions": [
          { "id": "final-quiz", "type": "quiz", "weight": 1.0, "required": true }
        ]}
    ]}
  ],
  "tracking": {
    "completion": { "rule": "required-interactions-passed" },
    "score": { "rule": "weighted-interactions", "mastery": 0.8 }
  }
}
```

The validator cross-checks: every declared interaction exists in the page HTML (id match), every required interaction is reachable. The MCP `update_page` tool keeps the declarations in sync.

| Pros | Cons |
|---|---|
| Bespoke freedom of A + machine-checkable tracking contract | Two sources of truth (declaration + HTML) need a sync rule — mitigated by validator |
| Validators/LMS mapping never parse creative content | Slightly more spec than A |
| Natural growth path: more optional structure can be added later without breaking A-style courses | |

---

## Recommendation

**Option C.** It preserves the project's core bet (bespoke HTML is the creative substrate) while giving the packager/validators/MCP a reliable contract. Option B is what incumbents already do, and it's why their output feels templated. Option A is acceptable as a fallback if C's sync rule proves annoying in the spike — C degrades gracefully to A (interactions array is optional for untracked pages).

**Decision:** ☐ A ☐ B ☑ **C** — *2026-06-11, Jim: accepted recommendation. Interactions array optional for untracked pages (graceful degradation to A-style). Validator owns the declaration↔HTML sync check.*
