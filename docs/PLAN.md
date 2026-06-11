# Open Source E-Learning Toolkit — Project Plan

*Internal working document — Jim / BCL Training — June 2026*
*Working name used throughout: **OELT** (placeholder; naming is an open question)*

---

## 1. Vision

LLMs (Claude, ChatGPT, etc.) are now producing genuinely good bespoke e-learning — interactive HTML, simulations, branching scenarios — but every generation is a one-off. The output is inconsistent in exactly the areas that don't benefit from being bespoke:

- **LMS/LXP integration** — SCORM/xAPI/cmi5 wiring is reinvented (usually badly or not at all) every time
- **Accessibility** — WCAG conformance is hit-or-miss; LLMs produce plausible-looking but broken ARIA
- **Interaction patterns** — every quiz, drag-and-drop, and branching scenario is a new implementation with new bugs
- **Tracking semantics** — what counts as "complete"? What's a score? Rarely defined consistently
- **Maintainability** — single-shot generated artifacts can't be reliably edited later, by humans or LLMs

**The thesis:** keep the bespoke creative layer (the thing LLMs are uniquely good at) and standardize everything underneath it. OELT is a runtime + component library + packaging toolchain + authoring interface, designed *LLM-first*: documented, structured, and exposed (via MCP and skill files) so that any LLM can produce professional, standards-compliant, accessible e-learning by default.

An analogy: OELT aims to be to LLM-generated e-learning what shadcn/ui + Vite are to LLM-generated web apps — the substrate the model reaches for so it doesn't reinvent the foundation.

## 2. Why existing projects don't fill this gap

| Project | What it is | Why it's not this |
|---|---|---|
| **Adapt Framework** | OSS HTML5 authoring framework + plugin ecosystem, SCORM output | Designed for human authors and developers; heavyweight build pipeline (legacy Backbone architecture); not structured for LLM consumption; cmi5 weak |
| **H5P** | 50+ interactive content types, embeds in Moodle/WP/Drupal | Content types, not a course framework; no native SCORM export (needs Lumi wrapper); content authored via its own editor UI, opaque to LLMs |
| **eXe Learning** | Desktop OSS authoring tool | Human-driven GUI tool; dated output |
| **scorm-again** | Modern JS SCORM runtime (LMS-side and content-side API) | A building block, not a toolkit — exactly the kind of library OELT should sit on top of |
| **Parrotbox.ai and similar** | Commercial wrappers reporting AI-chat interactions to LMS via SCORM/xAPI | Proprietary, narrow (chat interactions only) |
| **Vendor AI features** (Rise, Elucidat, Easygenerator…) | AI-assist inside closed authoring tools | Proprietary, locked to template output; the opposite of bespoke |

Nobody has built the **open, LLM-native layer**: a documented contract between "an LLM generating creative learning experiences" and "the standards/compliance machinery." That's the gap, and it's also the moat — incumbents are structurally committed to human-driven GUIs.

## 3. Design principles

1. **LLM-first, human-friendly.** Every API, component, and convention is designed to be reliably *generated* — small consistent surface, declarative over imperative, hard to misuse, fails loudly at validation time rather than silently at runtime. Humans get the same benefits.
2. **The bespoke layer stays free.** OELT constrains the chrome (tracking, navigation, a11y plumbing, packaging), never the pedagogy or the creative content. A course can be 95% custom HTML/JS that merely *plugs into* the runtime.
3. **Standards-compliant by default.** A course scaffolded with OELT is SCORM/cmi5-conformant and WCAG 2.2 AA-capable before the author writes a word.
4. **No build step required.** A generated course must run by opening files — and package by running one command. Build tooling is available, never mandatory.
5. **Single source, multiple targets.** One course tree exports to SCORM 1.2, SCORM 2004, cmi5/xAPI, and plain web (with graceful no-LMS fallback) without content changes.
6. **Validation is a first-class citizen.** Linting for accessibility, tracking semantics, and package conformance is part of the toolkit, not an afterthought — because LLM output *must* be checked mechanically.
7. **Boring technology.** Ten-year horizon. Web platform primitives over frameworks; dependencies chosen for stability and license cleanliness.

## 4. Architecture

Seven pieces, separable and independently useful:

```
┌─────────────────────────────────────────────────────────┐
│  5. Authoring interface (MCP server + CLI + skills)      │
├─────────────────────────────────────────────────────────┤
│  4. Validators (a11y, tracking, package conformance)     │
├─────────────────────────────────────────────────────────┤
│  3. Packager (SCORM 1.2 / 2004 / cmi5 / web)             │
├──────────────────────────┬──────────────────────────────┤
│  2. Component library    │  Theme system (design tokens) │
├──────────────────────────┴──────────────────────────────┤
│  1. Runtime core (tracking, state, navigation, a11y)     │
├─────────────────────────────────────────────────────────┤
│  0. Course manifest spec (course.json)                   │
└─────────────────────────────────────────────────────────┘
```

### 4.0 Course manifest spec (`course.json`)

A single JSON document (with published JSON Schema) describing the course: metadata, structure (modules → pages → blocks), tracking rules (completion criteria, scoring, pass threshold), theme reference, and target standards. This is the **source of truth** that everything else consumes:

- The packager derives `imsmanifest.xml` / `cmi5.xml` from it — authors and LLMs never touch those formats
- The runtime derives navigation and completion logic from it
- The validators check it
- The LLM reads/writes it via MCP tools — it is *the* artifact an LLM edits to restructure a course

Designing this schema well is the single highest-leverage task in the project. It should be versioned and treated as a spec (like a small W3C-style document), not as an implementation detail.

### 4.1 Runtime core (`@oeltkit/runtime`)

A small (~30 KB target, gzipped) zero-dependency-at-runtime JS library bundled into every course:

- **Tracking abstraction.** One API — `oelt.track.complete()`, `oelt.track.score(0.85)`, `oelt.track.interaction({...})`, `oelt.track.progress(0.4)` — with pluggable backends:
  - SCORM 1.2 and SCORM 2004 (wrap **scorm-again**, the actively-maintained modern runtime, rather than rebuilding)
  - cmi5/xAPI (cmi5 launch semantics, statements to the LRS; xAPI Profile published for OELT verbs/activities)
  - Standalone fallback: localStorage persistence + optional JSON download/webhook, so courses degrade gracefully outside an LMS
  - The backend is auto-detected at launch; content code is identical across targets
- **State & resume.** Key-value suspend data with automatic serialization to the right place per backend (SCORM suspend_data with size guarding, xAPI State API, localStorage).
- **Navigation & sequencing.** Page/module model from `course.json`; simple linear + menu + conditional unlock. Deliberately *not* SCORM 2004 sequencing — a small comprehensible model instead.
- **A11y services.** Focus management on page change, live-region announcer, reduced-motion detection, keyboard-trap prevention — the cross-cutting plumbing components rely on.
- **Event bus.** Components emit semantic events (`question-answered`, `scenario-branch-taken`); the runtime maps them to tracking statements per the manifest's rules.

### 4.2 Interaction component library (`@oeltkit/components`)

**Web Components (custom elements)** implementing the canonical interaction inventory. Each component is:

- Accessible by construction (keyboard, screen reader, WCAG 2.2 AA), with a11y behavior *tested*, not asserted
- Auto-wired to tracking (a `<oelt-mcq>` reports its interaction; the author writes zero tracking code)
- Themeable via CSS custom properties / parts, never via internal style overrides
- Declarative: configured through attributes and slotted/JSON content so LLMs generate it as markup, not imperative code

**Initial inventory (v1):** multiple choice / multiple response, text/numeric entry, drag-and-drop (ordering, matching, categorization), hotspot/image map, branching scenario block, flip cards / accordion / tabs (presentation), media player wrapper (captions/transcript enforced), slider/poll, free-text reflection (optionally LLM-evaluated at runtime — see §10), question pool/quiz container with scoring.

**Escape hatch:** a documented `CustomInteraction` base class + event contract, so bespoke one-off interactions get tracking and a11y services without being in the library. This preserves the "amazing bespoke output" property — the library is a floor, not a ceiling.

### 4.3 Theme system

- **Design tokens** (CSS custom properties) as the contract: color, type scale, spacing, radius, motion. A theme is one CSS file; org branding is a 20-line override.
- Ships with a default theme that is WCAG-AA-contrast-safe out of the box, plus a high-contrast variant.
- **Not Tailwind** (rationale in §5).

### 4.4 Packager (`@oeltkit/cli`)

`oelt package --target scorm2004` (or `scorm12`, `cmi5`, `web`). Node CLI that reads `course.json`, generates manifests, injects the right runtime adapter, zips. Also: `oelt preview` (local server with a **fake-LMS harness** showing live tracking calls — invaluable for both human QA and LLM self-checking) and `oelt new` (scaffold).

### 4.5 Validators

- `oelt validate a11y` — axe-core driven via Playwright across every page, plus OELT-specific rules (e.g., media without transcript fails)
- `oelt validate tracking` — completion reachable? score defined if mastery set? suspend data within SCORM 1.2 limits?
- `oelt validate package` — manifest conformance; CI integration with SCORM Cloud's test harness for real-LMS verification
- Machine-readable (JSON) output so an LLM can consume failures and fix its own work — this closes the generation loop and is a key differentiator

### 4.6 Authoring / MCP interface (`@oeltkit/mcp`)

The authoring system should be **MCP-primary, GUI-later**. The insight: the "authoring tool" for this audience *is the LLM client* (Claude, Cowork, Copilot, etc.). What's needed is not another editor UI but a well-designed tool surface:

**MCP tools (draft):**

| Tool | Purpose |
|---|---|
| `scaffold_course` | Create course tree + manifest from title/structure/targets |
| `get_course` / `update_structure` | Read & restructure the manifest |
| `add_page` / `update_page` | Page content CRUD |
| `list_components` / `get_component_doc` | Component discovery with usage docs + examples (so the model doesn't hallucinate APIs) |
| `validate` | Run validators, return machine-readable findings |
| `preview` | Launch preview harness, return URL (+ screenshot capability) |
| `package` | Produce SCORM/cmi5/web artifact |
| `set_theme` | Apply/override design tokens |

**Equally important — the static LLM interface:**

- `llms.txt` + `llms-full.txt` in the repo and on the docs site
- A published **Claude/agent skill** (SKILL.md) encoding methodology: instructional design conventions, component selection guidance, tracking-semantics decisions, a11y requirements
- Prompt-ready component reference: every component documented with intent, a11y notes, and 2–3 canonical examples

This dual surface (MCP for tooling, skills/llms.txt for knowledge) means OELT works in *any* agentic environment, not just MCP hosts.

**GUI authoring** is explicitly out of scope for v1. If demand emerges, a thin web editor over the same MCP/HTTP API is the natural phase-3+ project — the API-first design keeps that door open.

## 5. Technology recommendations

| Decision | Recommendation | Rationale |
|---|---|---|
| Component model | **Web Components (vanilla custom elements)**, no framework | Framework-agnostic (works in plain HTML, React, Vue hosts); no build step for consumers; 10-year stability; encapsulation via shadow DOM where appropriate (light DOM for content-heavy components to keep author CSS workable); LLMs generate declarative markup more reliably than imperative wiring. **Lit considered** — nice DX, but it's a dependency treadmill and the component count is finite; raw custom elements with a tiny internal base class is enough |
| Source language | **TypeScript**, shipped as plain ESM + a single-file IIFE bundle | Types catch errors and *are documentation* (published types help LLM tooling); consumers never need the toolchain |
| Styling | **Plain CSS + design tokens. Not Tailwind.** | Tailwind requires a build (CDN version is incomplete/discouraged for production), bloats single-file output, couples markup to a styling fashion, and makes a11y/contrast auditing harder. Tokens give LLMs a small named vocabulary (`var(--oelt-color-primary)`) instead of an open-ended utility space. Authors *may* use Tailwind in bespoke content; the toolkit itself must not |
| SCORM runtime | **scorm-again** (wrap, don't fork) | Actively maintained, modern, handles both content-side API discovery and edge cases; pipwerks wrapper is venerable but stagnant |
| xAPI/cmi5 | **xAPI.js ecosystem** (`@xapi/xapi`, `@xapi/cmi5`); evaluate vs. small in-house client | TinCanJS is legacy; cmi5 launch semantics are finicky — use maintained code where it exists |
| Packaging/CLI | **Node 20+**, minimal deps | It's where the JS ecosystem is; contributors expect it |
| Testing | **Playwright + axe-core**; SCORM Cloud (free dev tier) in CI for conformance | Real-browser a11y and tracking tests are non-negotiable for the value proposition |
| Reference LRS for dev | **Yet Analytics SQL LRS** (Apache 2.0) in docker-compose | The maintained OSS LRS; gives contributors a real xAPI target locally |
| Docs | Static site (Astro or similar) + versioned spec + llms.txt | Docs are a primary product surface here, for two audiences (humans and models) |
| Media/charts etc. | No bundled deps; *recommended-libraries registry* (e.g., Chart.js, Mermaid) with vetted versions + a11y notes | Keeps core lean while giving LLMs a sanctioned answer to "what do I use for X" |

**Browser support:** evergreen browsers only. Corporate-locked-down environments are accommodated by avoiding bleeding-edge platform features for ~2 years after baseline availability.

## 6. Accessibility strategy

A11y is a headline feature, not a checkbox — arguably the strongest selling point to enterprise/government L&D, and the thing LLM-generated content most reliably gets wrong today.

- Target **WCAG 2.2 AA** for all components and runtime chrome; document the conformance status per component (modeled on US/VA design-system practice)
- Every component PR requires: keyboard interaction spec, screen-reader behavior notes, automated axe pass, and a manual AT check (NVDA + VoiceOver minimum) before `stable` status
- The validator enforces content-level rules the components can't (alt text, transcript presence, heading order, contrast of custom-themed tokens)
- Publish an **a11y conformance statement template** so organizations can use OELT output in procurement (Section 508 / EN 301 549 mapping)
- The skill/llms.txt explicitly teaches LLMs the content-level rules, so generated bespoke sections start compliant

## 7. Governance & maintenance

### 7.1 Honest effort assessment (agentic development model)

The toolkit will be **built by agentic coding agents (Claude Code etc.), directed by humans**. That changes the economics fundamentally: code volume is nearly free; the scarce resources are **decision-making, review, and physical-world verification**. The work splits into three buckets:

**Agent-fast (hours–days each):** runtime implementation, component code + unit/Playwright tests, packager, validators, MCP server, docs/llms.txt drafting, example courses. Agents can also run much of the verification loop themselves (axe scans, fake-LMS harness, screenshot review).

**Human-paced (the real timeline):**

- **Spec decisions** — the manifest schema, tracking semantics, component behavior contracts. Agents can draft options; a human must *choose*, and choices compound. This is design taste, not labor
- **Manual AT testing** — NVDA/VoiceOver/JAWS behavior cannot be fully automated; each component needs a human a11y pass before `stable`
- **Real-LMS verification** — SCORM Cloud is CI-able, but enterprise LMS quirks (Cornerstone, SuccessFactors, Moodle versions) need human-run smoke tests
- **Review bandwidth** — agent output at this volume must be reviewed by someone who understands both e-learning standards and the codebase; this is the governing rate limit
- **Community/governance** — recruiting co-maintainers, RFC discussions, vendor outreach: zero agent acceleration

**Realistic shape:** one technically-strong director (Jim) at ~0.25–0.5 FTE driving agents, plus a part-time a11y reviewer and occasional ID review — instead of 2–3 devs × 9–12 months. The calendar compresses roughly 3–4×, not 10× (the human-paced bucket dominates the critical path). Budget line shifts from salaries to **agent compute + SCORM Cloud + a11y review hours**.

**Maintenance floor** also transforms: scheduled agents handle dependency drift, browser-regression sweeps, issue triage, and draft fixes; the irreducible human floor drops to **a few hours/week of review and release sign-off** — but it never reaches zero, and a11y re-verification after component changes remains human work. Plans that ignore this floor are how OSS projects die (see: Adapt authoring tool's stagnation).

### 7.2 Governance model (phased)

- **Phase 0–1: Benevolent-maintainer model.** BCL (or Jim personally) as founding maintainer with 1–2 co-maintainers recruited early — ideally from an LMS vendor and an L&D consultancy, for ecosystem credibility and to avoid single-company optics
- **Phase 2: Technical Steering Committee** (4–6 people) once there are ≥3 organizations contributing; RFC process for spec changes (the manifest spec and component contracts are the things needing real change control)
- **Fiscal home:** start with **Open Collective** (lightweight, transparent funding); evaluate moving to a foundation (Software Freedom Conservancy, or Linux Foundation if it gets big) only if/when trademark + vendor-neutrality pressure warrants it. Joining the **Adapt/ADL orbit** socially (conferences, xAPI community, ADL liaison for the cmi5 profile) without organizational entanglement
- **Spec vs. implementation split:** the manifest spec, xAPI profile, and component behavior contracts should be governed more conservatively than the implementation — that's what lets alternative implementations and forks coexist

### 7.3 Sustainability / funding

- **License: MIT or Apache 2.0** (Apache 2.0 recommended — patent grant matters if LMS vendors adopt it). Explicitly *not* GPL: the output ships inside customer LMSes and corporate firewalls; copyleft anxiety would kill enterprise adoption (Adapt's GPLv3 is a known friction point)
- Revenue-adjacent sustainability options that don't compromise openness:
  - Paid **conformance/certification mark** for tools claiming OELT compatibility
  - Sponsored maintenance (LMS vendors benefit directly — clean cmi5 content is in their interest)
  - BCL and similar shops sell services/training on top (the Red Hat model at small scale) — also BCL's strategic rationale for incubating it
  - Grant funding is plausible: ADL, EU digital-education programs, and a11y-focused funders all touch this space
- **Contributor funnel:** components are the ideal first contribution (bounded, testable, well-specified). A "component proposal" RFC template + conformance test suite makes drive-by contributions reviewable

### 7.4 What kills this project (pre-mortem)

1. **Scope creep into authoring GUI** before the foundation is proven — resist
2. **Spec churn** that breaks generated courses — version the manifest from day 1, commit to migration tooling
3. **A11y claims that don't survive audit** — the credibility loss would be fatal; under-claim, over-test
4. **Review bottleneck / rubber-stamping** — with agents generating at volume, the failure mode isn't burnout from writing code, it's the human reviewer falling behind and waving things through (or becoming the single point of failure). Mitigations: specs + conformance suites that make review cheap, a second reviewer before public launch, and resisting the temptation to merge unreviewed agent output just because it exists
5. **LLM-vendor platform shift** (e.g., MCP superseded) — mitigated by the static-knowledge surface (llms.txt/skills) and API-first design; the knowledge layer ports, whatever the protocol

## 8. Roadmap (agentic build)

Phases are gated by **human decisions and verification**, not code volume. Each phase: agents build in parallel streams against written specs; the phase ends when the human gate passes.

**Phase 0 — Spec & spike (weeks 1–3)**
*Human work first:* manifest schema v0 and tracking-semantics decisions (agents draft 2–3 alternatives with worked examples; Jim picks). *Then agents build:* tracking-abstraction spike proving one course → SCORM 1.2 + cmi5 + standalone from identical content; 3 components (MCQ, branching block, media); fake-LMS preview harness. *Exit gate: a fresh Claude session, given only the docs, produces a working SCORM package on the first try.* That gate is the whole thesis — test it before building more. The spec decisions are the long pole here; the spike itself is days of agent work.

**Phase 1 — Core toolkit (weeks 3–10)**
Agents build the full surface in parallel streams: runtime hardening (resume, suspend-data limits, cmi5 launch flow), 8–10 components with automated a11y tests, packager all 4 targets, validators v1, docs site + llms.txt, SCORM Cloud CI. *Human gates:* manual AT pass per component (the pacing item — batch components for a11y review sessions), spec sign-offs on component behavior contracts, real-LMS smoke tests.

**Phase 2 — LLM-native authoring (weeks 6–14, overlapping)**
MCP server; published skill; validate-fix loop demonstrated end-to-end; recommended-libraries registry; example course gallery (the marketing artifact). *Human gates:* skill quality (does it encode sound ID methodology?), exit-criterion re-test across ≥2 LLM clients, launch readiness review. v1.0 + public launch — timing driven by community calendar (DevLearn / xAPI community), not build speed.

**Phase 3 — Ecosystem (month 4+)**
Component contribution program (contributions will themselves be largely agent-written — see §8.1); LMS vendor outreach for cmi5 co-testing; OELT xAPI Profile registered; i18n; evaluate GUI editor and runtime LLM interactions (§10) based on demand.

### 8.1 Building *for* and *with* agents: repo as agent environment

Because agents are both the builders and the eventual users, the repository itself must be engineered as an agent workspace from day 1:

- **Spec-first development.** Every layer gets a written spec (behavior contract + acceptance tests) before implementation. Specs are the human leverage point; implementations are regenerable. If an implementation rots, regenerate it against the spec
- **CLAUDE.md / AGENTS.md + conventions doc** maintained as carefully as the code — they're the build instructions for the workforce
- **Verification harnesses as guardrails:** the fake-LMS harness, axe/Playwright suites, and package validators exist *first* so agents self-check every change. An agent that can run `oelt validate` on its own output converges fast; one that can't compounds errors
- **Parallel work streams** (runtime / components / packager / docs) with the manifest spec as the only coupling point — this is what makes weeks-not-months real
- **Conformance tests as the contribution contract:** an external (human or agent) component contribution is acceptable iff it passes the component conformance suite + human AT review. This scales review, which is the bottleneck
- **Maintenance automation:** scheduled agent runs for dependency updates, browser-regression sweeps, issue triage with draft fixes — human role reduces to review and release sign-off

A useful side effect: dogfooding. If the repo's specs and harnesses aren't good enough for Claude Code to build the toolkit, they're not good enough for Claude to *use* the toolkit — same skill of writing for model consumption, exercised from day 1.

## 9. Success metrics

- Phase 0 exit criterion passes with ≥2 different LLM clients
- 6 months post-launch: ≥3 external contributors with merged component PRs; courses verified on ≥4 real LMSes (SCORM Cloud, Moodle, an enterprise LMS, an LXP)
- Qualitative: L&D practitioners with no dev support shipping LMS-ready bespoke courses from a chat session

## 10. Open questions

1. **Name & trademark** — check collisions early; the npm scope and domain matter for LLM discoverability
2. **Runtime LLM interactions** (AI role-plays, evaluated free-text *inside* the delivered course): huge demand, but introduces API keys, cost, and privacy into shipped packages. Likely a separate optional module (`@oeltkit/ai-runtime`) with a proxy-server pattern — Parrotbox's existence proves the demand. Deliberately post-v1
3. **How opinionated on instructional design?** The skill could encode methodology (objectives → practice → assessment alignment). Recommendation: ship ID guidance as *defaults in the skill*, never as constraints in the toolkit
4. **Course manifest: invent vs. adopt?** Nothing existing fits (IMS manifests are output formats, not authoring models), but a deliberate review of Adapt's course JSON and PCM/CMI5 structures before finalizing v0 is due diligence
5. **Relationship to BCL** — incubate in-house then donate? Define the line early to keep "vendor-neutral" credible

## Appendix A — Key sources

- Standards trajectory: ADL has ended SCORM development; cmi5 is the recommended target for new content while SCORM 1.2 remains the enterprise installed base ([lmspedia](https://lmspedia.org/scorm-vs-xapi-guide/), [tsquare](https://tsquare.com.tr/scorm-2004-vs-xapi-cmi5-2026/), [easygenerator](https://www.easygenerator.com/en/blog/results-tracking/cmi5-what-it-is-and-why-you-need-it/))
- Landscape: [Adapt Framework](https://github.com/adaptlearning/adapt_framework), [H5P overview](https://atomisystems.com/elearning/what-is-h5p-the-ultimate-guide-to-interactive-learning-in-2026/), [OSS authoring tools 2026](https://www.compozer.com/post/open-source-elearning-authoring-tools)
- Libraries: [scorm-again](https://github.com/jcputney/scorm-again), [pipwerks wrapper](https://github.com/pipwerks/scorm-api-wrapper), [Yet Analytics SQL LRS](https://github.com/yetanalytics/lrsql)
- AI-to-LMS demand signal: [Parrotbox.ai](https://parrotbox.ai/ai-scorm/), [SCORM-wrapping Claude interactions](https://www.linkedin.com/posts/jeffbatt_claudeai-elearning-activity-7457454401738391552-j4PT)
- A11y practice: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [VA design system a11y testing](https://design.va.gov/accessibility/accessibility-testing-for-design-system-components)
