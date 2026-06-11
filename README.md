# OELTKit — Open E-Learning Toolkit

An open source, **LLM-first** e-learning toolkit: runtime + web components + packager + validators + MCP server, producing SCORM 1.2 / SCORM 2004 / cmi5 / standalone-web courses from a single course tree.

> **Thesis:** keep the bespoke creative layer (the thing LLMs are uniquely good at) and standardize everything underneath it — tracking, accessibility, packaging, conformance. See [`docs/PLAN.md`](docs/PLAN.md).

## Status

Phase 0 — the full author→package loop works end to end; the human-run exit gate (PLAN.md §8, Task 05 Part B) is the remaining step before Phase 1.

- **Specs:** [`specs/manifest-v0.md`](specs/manifest-v0.md) + [`course.schema.json`](specs/schema/course.schema.json) (the `course.json` contract) and [`specs/tracking-semantics.md`](specs/tracking-semantics.md) (completion/score/progress → each target).
- **Runtime** ([`@oeltkit/runtime`](packages/runtime)) — tracking, suspend state, navigation, four target adapters; one course → correct tracking in all four modes.
- **Components** ([`@oeltkit/components`](packages/components)) — `<oelt-mcq>`, `<oelt-branching>`, `<oelt-media>` (beta, pending manual AT pass).
- **CLI** ([`@oeltkit/cli`](packages/cli)) — `oelt new` / `validate` / `preview` / `package` (SCORM 1.2 · SCORM 2004 · cmi5 · web).
- **Docs for LLMs** — [`docs/llms.txt`](docs/llms.txt) + [`docs/quickstart.md`](docs/quickstart.md).

Not yet built: the MCP server ([`@oeltkit/mcp`](packages/mcp) is scaffolding) and a default theme. See [`tasks/`](tasks/) and [`docs/PLAN.md`](docs/PLAN.md).

```bash
oelt new my-course && oelt package my-course --target scorm12   # → my-course-id-scorm12.zip
```

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
