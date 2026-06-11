# OELT Tracking Semantics (v0)

**Status:** Normative. Version `0.1`.
**Derived from:** [Decision 2 — Option 2](./DECISION-2-tracking-semantics.md) (declarative rules), with Option 1 as the zero-config default and Option 3 (`manual`) as the escape hatch.
**Companion:** manifest shape and cross-field constraints live in [`manifest-v0.md` §5](./manifest-v0.md#5-tracking). This document defines what the rules _mean_ and how they project onto each target.
**Change control:** versioned spec; changes require human sign-off. Specs win over code.

The key words MUST, MUST NOT, SHOULD, MAY are to be interpreted as in RFC 2119.

---

## 1. The mapping problem

One authoring model projects onto four targets that disagree about what completion and score even are:

| Concept      | SCORM 1.2                                       | SCORM 2004                                              | cmi5                                         | Standalone (web)    |
| ------------ | ----------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- | ------------------- |
| Completion   | `cmi.core.lesson_status` (one field, conflated) | `completion_status` **and** `success_status` (separate) | `completed` / `passed` / `failed` statements | localStorage record |
| Score        | `cmi.core.score.raw` 0–100                      | `score.scaled` −1…1                                     | `result.score.scaled`                        | number 0–1          |
| Progress     | (none; convention via suspend_data)             | `progress_measure` 0–1                                  | progress extension                           | number 0–1          |
| Interactions | `cmi.interactions` (limited)                    | `cmi.interactions` (richer)                             | one xAPI statement per interaction           | event log           |

SCORM 1.2 collapses completion and success into a single field. The semantics model — not the adapter — defines the collapse rule (§4). Leaving it to the adapter is how the classic SCORM 1.2 gotcha gets reinvented wrong every time.

## 2. The author-facing model

Authors and LLMs configure tracking **declaratively** in `course.json` (`tracking` block). They do **not** write per-target code. The runtime auto-detects the backend at launch and applies the rules below; identical content runs on every target.

The imperative API exists but is normally driven by the runtime, not the author:

```js
oelt.track.complete();          // mark complete (used by the `manual` completion rule)
oelt.track.score(0.85);         // report a 0–1 score
oelt.track.interaction({ ... }); // report a question-level interaction
oelt.track.progress(0.4);       // report 0–1 progress
```

Authors call these directly only under the `manual` completion rule or from a `CustomInteraction`. Everything else is derived by the runtime from the declarative rules + emitted component events.

### 2.1 Three models coexist

- **No `tracking` block** ⇒ Option 1 behavior (zero-config defaults, §3).
- **`tracking` block with rules** ⇒ Option 2 (declarative; the normal case).
- **`"rule": "manual"`** ⇒ Option 3 (author owns completion via the imperative API).

## 3. Zero-config defaults (Option 1)

Absent any `tracking` block, the course behaves as:

```jsonc
{
  "completion": { "rule": "all-pages-viewed" },
  "score": { "rule": "none" },
  "progress": { "rule": "pages-viewed" },
}
```

This is the right default — impossible to misconfigure, correct for "read everything to finish." It is deliberately insufficient for assessment-gated courses; those declare rules explicitly.

## 4. Completion semantics

### 4.1 Completion rules

| Rule                              | Complete when…                                           |
| --------------------------------- | -------------------------------------------------------- |
| `all-pages-viewed`                | every page in `structure` has been viewed                |
| `pages-viewed` (`threshold` t)    | at least ⌈t × pageCount⌉ pages viewed                    |
| `required-interactions-completed` | every interaction with `required: true` is **completed** |
| `required-interactions-passed`    | every interaction with `required: true` is **passed**    |
| `manual`                          | author code calls `oelt.track.complete()`                |

"Viewed" means the page became the active page at least once (navigation event), persisted across resume. "Completed" vs "passed" for an interaction is defined by the component's own contract (e.g. an MCQ is _completed_ when answered, _passed_ when answered correctly).

### 4.2 The SCORM 1.2 collapse rule (normative — do not improvise)

SCORM 1.2 has one status field for both completion and success. OELT collapses as follows:

> **If a score rule producing a score is defined together with a `mastery` value**, the course reports **`passed` / `failed`** in `lesson_status`, decided by score ≥ mastery.
> **Otherwise** the course reports **`completed` / `incomplete`** in `lesson_status`, decided by the completion rule.

Consequences:

- `mastery` set ⇒ `lesson_status` carries success, and a learner who finishes but scores below mastery is **`failed`**, not merely incomplete.
- No `mastery` ⇒ `lesson_status` carries only completion; score (if any) is reported in `score.raw` but does not change status.
- `browsed` / `not attempted` are runtime lifecycle states, never authored.

On SCORM 2004 and cmi5 no collapse happens: completion and success are reported on their own channels (`completion_status` + `success_status`; `completed` then `passed`/`failed` statements).

## 5. Score semantics

| Rule                            | Score is…                                                 |
| ------------------------------- | --------------------------------------------------------- |
| `none`                          | not reported (default)                                    |
| `single-interaction` (`source`) | the 0–1 score of the named interaction                    |
| `weighted-interactions`         | Σ(weightᵢ × scoreᵢ) / Σ(weightᵢ) over scored interactions |

The canonical internal score is a **0–1 scaled** value. Per target:

- **SCORM 1.2** — `score.raw` = round(scaled × 100). (`score.min`/`max` set to 0/100.)
- **SCORM 2004** — `score.scaled` = scaled; `score.raw`/`min`/`max` also set for legacy LMS display.
- **cmi5 / xAPI** — `result.score.scaled` = scaled.
- **Standalone** — stored as the 0–1 number.

`mastery` (0–1) compares against the scaled score to decide pass/fail wherever the target carries success (§4.2 for SCORM 1.2; native channels elsewhere).

## 6. Progress semantics

| Rule           | Progress is…                               |
| -------------- | ------------------------------------------ |
| `pages-viewed` | viewedPageCount / totalPageCount (default) |
| `none`         | not reported                               |

Mapping: SCORM 2004 `progress_measure`; cmi5 a progress extension; standalone a stored number. SCORM 1.2 has no progress field — progress is omitted there (it is _not_ smuggled into suspend_data as status).

## 7. Interaction reporting

**Always record question-level interactions where the target supports it** (sub-decision, accepted). It is free analytics value and costs the author nothing.

- SCORM 1.2 / 2004 → `cmi.interactions.n.*` (id, type, result, learner response, correct response where available; 1.2 within its tighter field limits).
- cmi5 / xAPI → one statement per interaction with the appropriate verb (§9).
- Standalone → appended to the local event log.

Interaction reporting is independent of the completion and score rules: a course with `completion: all-pages-viewed` and `score: none` still emits interaction records for any declared interaction that fires.

## 8. State, resume, and the suspend-data budget

- All persisted state goes through `runtime/state`. Components and authors MUST NOT call the LMS API directly. (Direct calls bypass size guarding and break resume.)
- Per backend: SCORM `suspend_data` (size-guarded), xAPI State API, or localStorage — chosen automatically.
- **Budget: 3 KB enforced.** SCORM 1.2 guarantees only 4 KB of `suspend_data`; OELT enforces a stricter 3 KB ceiling (after compression) to keep headroom. Every component declares its maximum state size; the validator **fails the build** if declared component state plus runtime overhead exceeds the budget. This catches over-subscription before an LMS silently truncates state in the field.

## 9. xAPI / cmi5 verb vocabulary

v0 adopts the **cmi5-defined verbs plus ADL verbs**; OELT does not invent verbs. A dedicated **OELT xAPI Profile** is deferred to Phase 3 rather than minting verbs prematurely. Until then:

- Course-level: cmi5 `initialized`, `completed`, `passed`, `failed`, `terminated` per cmi5 launch rules.
- Interaction-level: ADL verbs (`answered`, `interacted`, `experienced`, …) as appropriate to the interaction type.

cmi5 launch specifics (one-time auth-token fetch; the exact context template from the launch parameters on every statement) are handled by `runtime/adapters/cmi5.ts` helpers only — never hand-rolled per course.

## 10. Validator obligations

`oelt validate tracking` MUST check:

1. Completion is **reachable** (e.g. a `required` interaction sits on a page navigable from entry).
2. `mastery` is set only with a score-producing rule (also schema-enforced).
3. A `required-interactions-*` completion rule has at least one `required` interaction.
4. `single-interaction` `source` names a declared interaction.
5. Declared component state totals within the 3 KB suspend budget.

Findings are emitted as machine-readable JSON so an LLM can consume failures and repair its own output.
