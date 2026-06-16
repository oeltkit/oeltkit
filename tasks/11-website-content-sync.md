# Task 11 — Website content sync (unblock the website's open questions)

**Prerequisites:** Tasks 07–10 substantially merged. Two halves in two repos: **Part A** runs here (toolkit repo) and produces the export; **Part B** runs in the **website repo** (separate Claude Code session) and consumes it.

## Part A — toolkit repo session:

---

Create `docs/website-export/`: machine-readable artifacts the website consumes —

- `components.json` (per component: name, status beta/stable, one-line description, a11y summary, canonical example markup, README slug),
- `cli.json` (verbs + flags + one-line docs),
- `walkthrough/` (the real artifacts SITE-STRUCTURE.md's how-it-works page needs: an actual `course.json`, a page HTML with a component, real validator output including one caught error, screenshots of harness + an LMS import).

Add a CI check that the export regenerates cleanly from source (no hand-maintained duplication). Commit straight to `main`.

---

## Part B — website repo session:

---

The website's `OPEN-QUESTIONS.md` items 2–5 are now answerable from the toolkit repo's `docs/website-export/` (provide the path or copy it in). Populate: the components page from `components.json` (keep `DEMOS_ENABLED` gating for live demos; static examples can show now), the CLI reference from `cli.json`, the how-it-works walkthrough from `walkthrough/`, and replace the tracking-guide TODO with the real SCORM 1.2 collapse rule from `specs/tracking-semantics.md` (quote it, don't paraphrase). Add the **Recipes** section per SIMPLICITY.md §4 — structure + the six recipe pages with prompts marked `draft: true` pending recipe CI (recipes become executable-tested later; don't claim tested yet). Update the website's OPEN-QUESTIONS, resolving what's resolved. Follow the website repo's own CLAUDE.md.

---

**Async spot-check (non-blocking, but do before DNS):** the Part B **copy review** — recipes especially, since they're the first thing IDs will paste — and a pass confirming nothing on the site claims more than CI verifies (the honesty constraints). Per the website CLAUDE.md, user-visible copy is flagged `COPY CHANGE` for your read; the build itself doesn't wait on it.
