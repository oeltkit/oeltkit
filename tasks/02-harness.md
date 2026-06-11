# Task 02 — Fake-LMS preview harness (build this BEFORE the runtime)

**Prerequisites:** Task 01 merged. **Why first:** every later session uses this to self-verify; see PLAN.md §8.1.

**Session prompt for Claude Code:**

---

Build `harness/`: a local dev server (`npm run harness -- examples/minimal`) that serves any OELT course directory and simulates LMS environments. Read `specs/manifest-v0.md` and `specs/tracking-semantics.md` first.

Requirements:

1. **Mode switcher** (query param + UI toggle): `scorm12`, `scorm2004`, `cmi5`, `web`.
2. **SCORM modes:** inject a faithful fake API (`API` / `API_1484_11`) implementing the data-model elements OELT uses (status, score, suspend_data with the 4 KB limit *enforced*, interactions, session_time). Persist state to a local JSON file so resume can be tested across reloads.
3. **cmi5 mode:** stub launch sequence (launch URL params, auth-token fetch endpoint, State API, statements endpoint) backed by an in-memory LRS that the panel can display. Conform to the cmi5 spec's launch semantics — do not improvise; cite spec sections in code comments.
4. **Inspector panel:** live, timestamped log of every API call/statement, current data-model state, suspend-data byte count, and a "completion/score as the LMS sees it" summary. Panel must be usable via screenshot (clear text, no hover-only info) so agent sessions can verify visually.
5. **Assertion API:** `harness/assert.ts` — programmatic access to the call log for Playwright tests (`expectStatement(...)`, `expectScormValue(...)`). This is what later tasks' tests import.
6. Playwright smoke test: load `examples/minimal` in all four modes, assert page render + (scorm modes) initialize/terminate called.

Definition of done: smoke tests green; README in `harness/` documenting modes, the assertion API, and screenshots of the panel.

---

**Human gate:** 15-minute hands-on drive of the panel in all four modes.
