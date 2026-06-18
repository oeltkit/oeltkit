# SIMPLICITY.md — The Non-Technical Author Path

_Companion to PLAN.md and COMPANION-SERVICES.md. Goal: an instructional designer who has never opened a terminal authors, previews, and ships an LMS-ready course entirely from Claude Desktop (or similar)._

## Persona & principle

**Persona:** working ID, comfortable in Claude/ChatGPT, lives in PowerPoint/Word/their LMS's admin screen. Has never used npm, git, or a CLI, and shouldn't have to learn.

**Principle:** _the conversation is the interface, and a course is a file._ The ID never sees: terminal, repo, npm, JSON, file paths, the words "scaffold" or "manifest." Every technical question has a default; every error arrives as a plain-language fix offer.

## 1. Three delivery vehicles, one tool surface

Same `@oeltkit/mcp` server, packaged three ways:

| Vehicle                                                 | Install effort                              | Where courses live                                                                     | Who it's for                                            |
| ------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Desktop extension (`.mcpb`)**                         | Download, double-click                      | `~/Documents/OELTKit Courses/` (managed by the server; ID never navigates it — see §2) | Privacy-conscious orgs, offline, free forever           |
| **Hosted remote connector** ("oeltkit cloud free tier") | Zero — add from Claude's connector settings | Server-side workspace                                                                  | The mass on-ramp; preview URLs, sharing, service upsell |
| **Cowork / Claude Code (today's path)**                 | Technical                                   | Local repo                                                                             | Developers, power users, agencies                       |

Notes:

- `.mcpb` bundles the entire server + dependencies in one file; Claude Desktop handles install/config/secrets natively. Submit to the Connectors Directory for in-app discovery.
- The hosted connector is **the first oeltkit cloud deliverable** — promoted ahead of the media services in COMPANION-SERVICES sequencing, because it's the funnel everything else sells through. Free tier: N courses, preview links, packaging. It must obey the boundary rules: nothing it does is impossible locally.
- Tool parity across vehicles is a conformance requirement: a conversation transcript should work identically against any of the three.

## 2. The course is a file: `.oeltcourse`

Steal H5P's best idea. Define a single-file working format — a zip with the standard course-tree layout inside, extension `.oeltcourse` — as the **unit of possession**:

- MCP tools accept it (attach to a chat → "update this course") and emit it ("here's your course file — keep it with your project files")
- Email-able, shareable, versionable the way IDs already version .pptx files
- Identical semantics across local extension and hosted workspace (hosted = the same file, stored for you)
- Spec addition: `specs/course-file.md` — layout, version field, forward-compatibility rule (newer toolkit always opens older files)

This dissolves "where is my project?", folder management, and the local/hosted migration question (export/import is just… the file).

## 3. Workflow verbs and conversation design

The developer surface (`scaffold/validate/package`) stays for agents. The ID-facing layer — primarily the published skill, plus tool descriptions — speaks workflow:

| ID says                                                | What happens underneath                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| "Start a course on X"                                  | scaffold with defaults: targets `scorm12+web`, default theme, sensible tracking |
| "Show me" / "let me try it"                            | preview: hosted URL (cloud) or double-clickable file (local — see §5)           |
| "Make the file I upload to my LMS"                     | validate → fix loop → package → `.zip` + per-LMS upload instructions            |
| "Here's last year's course, update the policy section" | accepts `.oeltcourse`, edits, re-validates                                      |

Conversation rules encoded in the skill:

- **Never ask a question the persona can't answer.** Not "SCORM 1.2 or 2004?" but "Which LMS do you use?" → look up the right target. Unknown LMS → safe default (scorm12) + web preview.
- **Findings are fix offers, not errors.** Validator JSON is for agents; the ID sees "Page 3's video needs captions — want me to draft them from the audio?" (Where a companion service can do it in one call, that's the natural upsell — and the local/free path is always mentioned per boundary rule 2.)
- **Progressive disclosure.** Mastery thresholds, cmi5, theming tokens exist when asked for; never in the default flow.

## 4. Recipes

Website gets a **Recipes** section: each recipe = one copy-paste prompt + one attachment, tested end-to-end as part of CI (they are executable docs — if a recipe breaks, the build fails). Launch set:

1. **Course from a PowerPoint** (attach .pptx) — the #1 real-world entry point
2. **Storyboard to SCORM** (attach Word/PDF storyboard)
3. **Claude Design prototype to course** (per DESIGN-WORKFLOW.md, simplified)
4. **Update an existing course** (attach .oeltcourse)
5. **Translate my course** (attach .oeltcourse; hosted localization or BYO path)
6. **Quiz from a policy document** (attach the doc)

Same recipes ship as installable skills. Plus **per-LMS upload guides** (Moodle, Cornerstone, Docebo, TalentLMS, SCORM Cloud) with screenshots — "where does the zip go" is a genuine wall.

## 5. Technical constraints this imposes (spec changes, do early)

1. **`file://` viability for the web target:** a packaged-for-web course must run when its `index.html` is double-clicked from the file system — no server, no fetch-dependent loading (inline or relative-load everything; no CORS-sensitive patterns). This is the local preview story for non-technical users. → runtime/packager spec requirement, add now while cheap.
2. **`.oeltcourse` format spec** (§2) — also now, while the layout is young.
3. **Plain-language finding strings** in validator output alongside the machine fields (`message_human` per finding) so every client renders the same friendly text.
4. **Hosted preview links** (cloud connector): unguessable URLs, expiring, no learner data. "Send this link to your SME" is half the value of hosted.
5. **"Test in a real LMS" tool** (cloud, later): wraps SCORM Cloud so the ID's verification is one sentence, not an account signup.

## 6. Roadmap changes

| Item                                                                  | Lands in                                                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `file://` requirement + `.oeltcourse` spec                            | **Phase 1** (spec work, cheap now / expensive later)                                               |
| `.mcpb` packaging of `@oeltkit/mcp` + Connectors Directory submission | **Phase 2**                                                                                        |
| Skill conversation rules (§3) + recipes v1 + per-LMS guides           | **Phase 2**                                                                                        |
| Hosted connector (oeltkit cloud free tier)                            | **First cloud deliverable** — re-sequenced ahead of Tier 1 media services in COMPANION-SERVICES.md |
| "Test in a real LMS" tool                                             | With cloud Tier 4 verification farm                                                                |

## 7. Success metric for this track

The "mom test" for v1.0 marketing: an ID with no dev support, on a fresh Claude Desktop install, goes from "I have this PowerPoint" to "course imported and completing in my LMS" in under 30 minutes, using only recipe #1 and the upload guide. This should be literally tested with 3–5 friendly IDs before launch (same panel as the COMPANION-SERVICES pricing validation).
