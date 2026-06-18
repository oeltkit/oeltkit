# Validator Output Contract

**Status:** Normative.
**Implemented by:** `@oeltkit/cli` (`packages/cli/src/lib/course.ts`).
**Consumed by:** `oelt validate`, the MCP server, and any LLM tool that reads validation results.

---

## 1. The Finding object

Every validator finding is a JSON-serialisable object with these fields:

| Field           | Type                   | Required | Notes                                                                                                                             |
| --------------- | ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `level`         | `"error" \| "warning"` | yes      | `error` blocks packaging; `warning` does not.                                                                                     |
| `code`          | string                 | yes      | Machine-stable key (kebab-case). Never changes once assigned; used by LLM clients to match and fix a specific class of problem.   |
| `message`       | string                 | yes      | Terse technical description: what failed and the id or path involved. Used in human-readable terminal output.                     |
| `message_human` | string                 | yes      | Plain-language, action-oriented sentence naming the page by title (not id). Tells the author exactly what to fix and how. See §2. |
| `where`         | string                 | no       | An id or path narrowing the scope (page id, module id, file path). Optional; callers must not assume it is present.               |

Findings array contract: `oelt validate --json` emits:

```json
{
  "ok": false,
  "findings": [
    {
      "level": "error",
      "code": "interaction-missing",
      "message": "declared interaction \"q1\" has no element with that id in pages/quiz.html",
      "message_human": "The page \"Final quiz\" declares an interaction \"q1\" but no element with that id was found in pages/quiz.html — add id=\"q1\" to the element.",
      "where": "quiz"
    }
  ]
}
```

`ok` is `true` iff no finding has `level === "error"`.

## 2. `message_human` style rules

1. **Action-oriented.** Start with the problem; end with the fix. "Page X has Y — do Z."
2. **Name by title.** Reference pages by their `title`, not their `id`. Authors see titles in their editor; ids are internal.
3. **Be specific.** Include the file path, element id, or rule name the author needs to act on.
4. **Plain language.** No spec jargon, no code references beyond what the author touches. Do not say "interaction declaration ↔ HTML sync rule §4.1" — say "add `id=...` to the element".
5. **One sentence per finding.** Two sentences max if the fix needs context.

## 3. Rule code registry

| Code                      | Level   | Trigger                                                        | Example `message_human`                                                                                                                                                                                                                                                  |
| ------------------------- | ------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`                  | error   | JSON Schema violation                                          | "The manifest has a structural error: `{instancePath}` {message}."                                                                                                                                                                                                       |
| `id-unique`               | error   | Duplicate id across course                                     | "The id \"m1\" is used more than once — every id in the course must be unique; rename one of the duplicates."                                                                                                                                                            |
| `page-missing`            | error   | `src` file not found                                           | "Page \"Welcome\" references a file that doesn't exist (`pages/p1.html`) — create the file or fix the path in course.json."                                                                                                                                              |
| `interaction-missing`     | error   | Declared interaction absent from page HTML                     | "Page \"Final quiz\" declares an interaction \"q1\" but no element with that id was found in pages/quiz.html — add `id=\"q1\"` to the element."                                                                                                                          |
| `media-no-alt`            | error   | `<oelt-media>` without captions or transcript                  | "Page \"Introduction video\" has a media element without captions or a transcript — add a `<track kind=\"captions\">` or a `<div slot=\"transcript\">` element."                                                                                                         |
| `no-required-interaction` | error   | Completion rule needs `required` interaction but none declared | "The completion rule `{rule}` requires at least one interaction marked `required: true`, but none are declared — set `\"required\": true` on at least one interaction."                                                                                                  |
| `score-source`            | error   | `single-interaction` score names missing interaction           | "The score rule `single-interaction` names \"{source}\" as its source, but no interaction with that id is declared — add an interaction with `\"id\": \"{source}\"` or change the score source."                                                                         |
| `scorm2004-rollup`        | warning | Course `targets` include `scorm2004`                           | "This course targets SCORM 2004, whose completion/success reporting is a known limitation — it is not yet verified to roll up on every LMS. Use SCORM 1.2 or cmi5 when guaranteed tracking matters; SCORM 2004 packaging still works for authors who knowingly want it." |

## 4. Known-limitation notices (non-blocking)

Some findings are not defects in the authored course but honest caveats about a delivery target.
They are emitted at `level: "warning"` so they surface to the author without blocking packaging.

- **`scorm2004-rollup`** — emitted by `oelt validate` whenever `targets` includes `scorm2004`.
  SCORM 2004 _packaging_ works and the runtime writes correct RTE values, **but** completion/success
  do not reliably roll up to the registration on a real LMS (OQ-004; verified on SCORM Cloud via
  Task 10). The `message_human` steers authors to the verified targets (SCORM 1.2, cmi5).

`oelt package --target scorm2004` additionally prints the same caveat to **stderr** as a `notice:`
line _after_ a successful package — packaging is never refused over this. The notice text mirrors
the `scorm2004-rollup` warning. This is the only target-conditional packaging notice; do not extend
it to a validation error.

## 5. Stability guarantee

`code` values are stable once shipped. They MUST NOT be renamed or removed in a MINOR version
bump. Adding new codes is a MINOR change. Removing or renaming a code is a MAJOR change.
