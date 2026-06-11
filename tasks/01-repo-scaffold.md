# Task 01 — Repo scaffold

**Prerequisites:** Decisions 1 & 2 made (see `specs/DECISION-*.md` — they must show a checked box). Name chosen (replace `oelt` everywhere if different).

**Session prompt for Claude Code:**

---

Initialize this repo as an npm-workspaces monorepo for OELT per `CLAUDE.md` (already in repo root).

1. Create the layout exactly as described in CLAUDE.md "Repo layout": `specs/`, `packages/{runtime,components,cli,mcp}`, `harness/`, `examples/`, `docs/`.
2. Convert `specs/DECISION-1-manifest-schema.md` (the chosen option only) into `specs/manifest-v0.md` — a clean normative spec with a JSON Schema file at `specs/schema/course.schema.json`. Same for Decision 2 → `specs/tracking-semantics.md`.
3. Tooling: TypeScript 5.x strict, esbuild for bundling (ESM + IIFE per CLAUDE.md rule 3), vitest for unit tests, Playwright + axe-core configured at workspace root, prettier + eslint (minimal config), conventional-commit lint.
4. CI (GitHub Actions): lint, test, build on PR. Leave a stubbed (commented) SCORM Cloud job.
5. Create `specs/OPEN-QUESTIONS.md` (empty template) and `examples/minimal/` — the smallest valid course (one page, no tracking config) with its `course.json` validating against the schema.
6. Verify: `npm test` green, schema validates the example, build outputs exist.

Do NOT implement runtime logic, components, or the packager yet.

---

**Human gate after this task:** review `specs/manifest-v0.md` + JSON Schema line by line. This is the most important review of the project.
