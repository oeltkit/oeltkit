# OELTKit — Open E-Learning Toolkit

An open source, **LLM-first** e-learning toolkit: runtime + web components + packager + validators + MCP server, producing SCORM 1.2 / SCORM 2004 / cmi5 / standalone-web courses from a single course tree.

> **Thesis:** keep the bespoke creative layer (the thing LLMs are uniquely good at) and standardize everything underneath it — tracking, accessibility, packaging, conformance. See [`docs/PLAN.md`](docs/PLAN.md).

## Status

Phase 0 — spec & spike. The two foundational decisions are made and written up as normative specs:

- [`specs/manifest-v0.md`](specs/manifest-v0.md) + [`specs/schema/course.schema.json`](specs/schema/course.schema.json) — the `course.json` contract (the highest-leverage artifact in the project).
- [`specs/tracking-semantics.md`](specs/tracking-semantics.md) — how completion/score/progress project onto each target.

Implementation (runtime, components, packager, MCP server) is scaffolded but not yet built — see [`tasks/`](tasks/).

## Repo layout

```
specs/          Behavior contracts (versioned; changes need human sign-off)
packages/
  runtime/      @oeltkit/runtime — tracking, state, navigation, a11y
  components/   @oeltkit/components — <oelt-*> custom elements
  cli/          @oeltkit/cli — oelt package/preview/validate/new
  mcp/          @oeltkit/mcp — MCP server
harness/        Fake-LMS preview harness + SCORM/cmi5 test fixtures
examples/       Example courses (also integration test fixtures)
docs/           Docs + plan
```

## Develop

Requires Node ≥ 20.

```bash
npm install              # install workspace deps + git hooks
npm test                 # vitest unit tests
npm run typecheck        # tsc project-references build, no emit
npm run lint             # eslint + prettier --check
npm run build            # ESM + IIFE bundles for every package
npm run validate:examples # schema-validate every example course
npm run test:a11y        # Playwright + axe (once components exist)
```

Conventions are in [`CLAUDE.md`](CLAUDE.md) — read it before contributing. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint).

## License

[Apache-2.0](LICENSE).
