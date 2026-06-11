# @oeltkit/runtime

The OELT runtime core: tracking, suspend state, navigation, and per-target adapter selection. Bundled into every course; **zero runtime dependencies**. Implements the contracts in [`specs/manifest-v0.md`](../../specs/manifest-v0.md) and [`specs/tracking-semantics.md`](../../specs/tracking-semantics.md).

> Status: Phase-0 spike. One course → correct tracking in SCORM 1.2 / SCORM 2004 / cmi5 / standalone web from identical content. Components, theming, and the full nav model land later.

## Usage

```js
const rt = oelt.boot(courseManifest); // construct; auto-detects the target
rt.on((evt) => {
  /* observe the semantic event stream */
});
await rt.start(); // run the launch lifecycle (init → resume → first page)
```

After `boot()`, the instance's `track` / `state` / `nav` are also attached to the global `oelt`, so author markup can call them directly:

```html
<button onclick="oelt.track.interaction({ id: 'q1', type: 'mcq', result: 'passed', score: 1 })">
  Submit
</button>
```

## Public API

| Surface                                                 | Purpose                                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oelt.track.complete()`                                 | Mark complete (the `manual` completion rule).                                                                                                                                  |
| `oelt.track.score(scaled)`                              | Report a 0–1 score directly.                                                                                                                                                   |
| `oelt.track.progress(value)`                            | Report 0–1 progress directly.                                                                                                                                                  |
| `oelt.track.interaction({ id, type?, result, score? })` | Report an interaction; the rules engine recomputes completion/score.                                                                                                           |
| `oelt.state.get/set(key, value)`                        | Suspend KV — quota-enforced (3 KB, [tracking-semantics §8](../../specs/tracking-semantics.md)); throws `QuotaExceededError` over budget. Keys starting with `__` are reserved. |
| `oelt.nav.pages / current() / go(i) / next() / prev()`  | Navigation driven by `course.json`.                                                                                                                                            |
| `rt.on(listener)`                                       | Subscribe to the semantic event stream.                                                                                                                                        |
| `rt.terminate()`                                        | End the session (commit + finish/terminate).                                                                                                                                   |

## Architecture

```
runtime.ts ── wires everything; exposes the public API
  ├─ adapters/detect.ts      auto-detect target → pick adapter
  ├─ adapters/{scorm12,scorm2004,cmi5,web}.ts   ← the ONLY code that touches a host LMS API
  ├─ tracking.ts             rules engine: manifest rules → normalized Outcome
  ├─ state.ts                suspend KV + quota + resume hydration
  └─ nav.ts                  page model + current + go
```

**Adapter boundary.** Every SCORM/xAPI/localStorage call lives under `adapters/`. The rules engine computes a normalized `Outcome { completion, success, score, progress }` and hands it to the adapter; the adapter maps it onto its target. The **SCORM 1.2 collapse rule** is expressed by `success`: it is non-null exactly when a score rule + mastery are defined, so the scorm12 adapter collapses `success ?? completion` into the single `lesson_status` field ([tracking-semantics §4.2](../../specs/tracking-semantics.md)).

**Resume.** On reload the LMS retains its status, but the engine's in-memory state is gone — so the engine persists a compact snapshot into a reserved suspend key and rehydrates on `start()`, ensuring re-evaluation reproduces the prior outcome rather than downgrading it.

**Dependencies.** None. `scorm-again` is LMS-side (it provides `window.API`, not a content-side wrapper) and `@xapi/cmi5` pulls in `@xapi/xapi`; see [OQ-001](../../specs/OPEN-QUESTIONS.md) for the evaluation and the decision to keep zero-dep content-side adapters for now.

## Build

```bash
npm run build -w @oeltkit/runtime
```

Produces `dist/esm/` (plain ESM, browser-loadable, `.js`-extension imports) and `dist/oelt.min.js` (single-file IIFE exposing the global `oelt`). The harness serves the IIFE bundle at `/runtime/oelt.min.js`.
