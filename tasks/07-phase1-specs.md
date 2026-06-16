# Task 07 — Phase 1 spec additions (.oeltcourse, file:// target, friendly findings)

**Prerequisites:** exit gate (05B) passed ✅. **This task blocks the oeltkit-cloud repo** (its workspace tools need the `.oeltcourse` spec) — run it first in Phase 1. Context: SIMPLICITY.md §2/§5 (in `docs/` or attach).

**Session prompt for Claude Code:**

---

Three spec additions plus their implementations. Per CLAUDE.md, commit straight to `main`: land each spec as its own commit with `SPEC CHANGE` in the body, then its implementation. No draft PR, no waiting — the automated suites are the gate.

1. **`specs/course-file.md` — the `.oeltcourse` single-file format.** A zip containing the standard course tree (`course.json` at root). Define: layout, required/optional entries, `oelt` version field semantics, forward-compat rule (newer toolkit always opens older files; opening a *newer* file → clear error naming the required version), max-size guidance, zip-slip safety requirements for consumers. Then implement: `oelt export <dir>` → `.oeltcourse`, `oelt import <file> <dir>`, and make `validate`/`package`/`preview` accept a `.oeltcourse` directly. Tests: round-trip (export→import→identical tree), version errors, malicious-zip rejection (path traversal, absolute paths).

2. **`file://` viability for the web target** — add to `specs/manifest-v0.md` packaging section: a web-target package must run when `index.html` is opened from the file system. No `fetch()` of local resources at runtime (inline JSON/scenario data or load via relative `<script>`), no module loading that breaks under `file://` (use the IIFE bundle), no absolute paths. Implement in the packager; add a Playwright test that loads the packaged output via a `file://` URL for all three example courses and asserts render + web-adapter tracking.

3. **`message_human` in validator findings** — every finding gains a plain-language, action-oriented sibling to the machine fields ("Page 3's video has no captions — add a captions file or remove the video"; name the page by title, not id). Spec the field in the validator output contract; implement across all existing rules; tests assert every rule emits one.

Self-check per CLAUDE.md (`npm test`, `npm run validate:examples`); update `docs/llms.txt` for the new CLI verbs and the `.oeltcourse` concept.

---

**Async spot-checks (non-blocking — do when convenient):** the `.oeltcourse` format is the one cross-cutting decision here because oeltkit-cloud builds on it — skim `specs/course-file.md` once it lands and flag anything before the cloud repo starts (it's still cheap to change now; nothing depends on it yet). Also eyeball ~10 `message_human` strings for tone — they're the ID-facing voice.
