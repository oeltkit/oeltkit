# Harness

Fake-LMS preview harness and conformance fixtures. **Scaffold only** — built in [`tasks/02-harness.md`](../tasks/02-harness.md).

Will serve any example course with a fake SCORM 1.2 / 2004 API and a cmi5 stub LRS, rendering a live panel of every tracking call so agents (and humans) can verify behavior, including by screenshot. Run with `npm run harness` once implemented.

- `demos/` — one demo HTML page per component (`<name>.html`), used by the axe/Playwright a11y suite.
- `fixtures/` — SCORM / cmi5 test fixtures.
