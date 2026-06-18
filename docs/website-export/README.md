# Website export

Machine-readable artifacts the [oeltkit website](https://oeltkit.org) consumes to build its
components reference, CLI reference, and how-it-works walkthrough. **Generated from repo source —
do not hand-edit the JSON.** (Task 11 Part A.)

| File                              | Source of truth                                 | Used by (website)       |
| --------------------------------- | ----------------------------------------------- | ----------------------- |
| `components.json`                 | `packages/components/README.md`                 | Components page         |
| `cli.json`                        | `packages/cli/src/lib/commands.ts`              | CLI reference           |
| `walkthrough/course.json`         | authored here (the walkthrough course source)   | How-it-works page       |
| `walkthrough/pages/*.html`        | authored here                                   | How-it-works page       |
| `walkthrough/validate-ok.json`    | derived: `oelt validate` on the course (clean)  | How-it-works page       |
| `walkthrough/validate-error.json` | derived: `oelt validate` on a one-mistake copy  | How-it-works "fix loop" |
| `walkthrough/screenshots/*`       | captured out-of-band (see that folder's README) | How-it-works page       |

## Regenerating

```bash
npm run build            # the generator imports the built CLI modules
npm run website-export   # regenerate the JSON + prettier-format
```

The authored walkthrough source (`course.json`, `pages/*.html`, `screenshots/*`) is **not**
regenerated — only the derived JSON is. `components.json` and `cli.json` are fully generated; edit
their sources, not them.

## CI guard (no drift)

`npm run website-export:check` regenerates and fails if anything changed — wired into CI so the
export can never silently drift from source. If CI fails here, run `npm run website-export` and
commit the result.

## Honesty constraints (for the website session)

- `cli.json` marks `scorm12`/`cmi5`/`web` as verified and flags `scorm2004` as a known limitation
  (completion rollup unverified — OQ-004). Don't let the site claim 2004 completion works.
- `components.json` carries each component's `status` (`beta`) and `statusNote` verbatim from the
  package README — show the beta state; don't upgrade it to "stable" until the manual SR passes land.
- The walkthrough `validate-*.json` are real validator output. The site's "caught error" example is
  a genuine finding, not a mockup.
