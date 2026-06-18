# Task 12 — Document the SCORM 2004 known-limitation (keep positioning honest)

**Prerequisites:** Task 10 merged (SCORM Cloud CI surfaced the gap; `KNOWN_GAPS.scorm2004` already exists in `scripts/scorm-cloud/playthroughs.mjs`). Context: OQ-004 in `specs/OPEN-QUESTIONS.md`.

**Decision (Jim, 2026-06-18):** ship on **SCORM 1.2 + cmi5 + web**; SCORM 2004 completion rollup is an **accepted known-limitation**, not a pending fix. The toolkit must say so honestly everywhere it's relevant, and steer authors toward the conformant targets — never claim 2004 completion works when it doesn't roll up on a real LMS.

**The factual framing to use (don't overstate either way):** SCORM 2004 *packaging* works and imports, and the runtime writes correct RTE values, **but** completion/success does not reliably roll up to the registration on SCORM Cloud (verified via Task 10). So: 2004 export is available and standards-shaped, but **completion reporting is not yet verified across LMSes — use SCORM 1.2 or cmi5 when guaranteed tracking matters.**

**Session prompt for Claude Code (toolkit repo):**

---

Make the SCORM 2004 limitation honest and visible across the published surfaces. Commit straight to `main`; touch the spec + docs + `llms.txt` in the same commits where behavior/claims change (`SPEC CHANGE` where a spec moves).

1. **Authoring guidance (`docs/llms.txt`, `docs/quickstart.md`):** where targets are described, state that 1.2 + cmi5 + web are verified real-LMS-conformant and **2004 completion reporting is a known limitation** — recommend 1.2 or cmi5 for guaranteed tracking. Make the default/whats-recommended unambiguous so an authoring model doesn't reach for 2004 by default or promise it works.

2. **CLI/packager notice (non-fatal):** when `oelt package --target scorm2004` (or a target set including it) runs, emit a clear non-blocking notice to stderr — packaging still succeeds — e.g. *"SCORM 2004: completion rollup is a known limitation (not verified on all LMSes); prefer scorm12 or cmi5 for reliable tracking."* Do **not** turn this into a validation error. Mirror the same caveat as a `message_human`-style note if the validator reports on targets. Document the notice in the relevant CLI/validator spec.

3. **OPEN-QUESTIONS / OQ-004:** mark the SCORM 2004 item as a **deliberate, accepted limitation (decided 2026-06-18)** — shipping without it — rather than an open investigation. Keep the technical findings (RTE correct, rollup fails, no content-side lib fits) as the rationale. If it's later picked up, that's a fresh question.

4. **Don't change the packager's behavior** otherwise — 2004 export stays available for authors who knowingly want it.

Self-check per CLAUDE.md (`npm test`, `npm run validate:examples`, lint).

---

**Website-side companion (do in the website repo, alongside Task 11 Part B):** update the **Standards page** so the SCORM 2004 row/claim reflects "export available; completion reporting not yet verified — 1.2 and cmi5 are the verified targets." Flag it `COPY CHANGE`. (Listed here so it isn't forgotten; it lives with the website session, not this one.)

**Async spot-check (non-blocking):** read the final authoring-guidance wording once — this is the line that stops the AI from confidently shipping a 2004 package that won't track.
