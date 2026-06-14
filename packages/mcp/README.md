# @oeltkit/mcp

The OELT MCP server — wraps `@oeltkit/cli` and filesystem operations as tools so an LLM client (Claude Desktop, Claude Code, Cowork, …) can author standards-compliant e-learning courses conversationally. **stdio transport**, no framework, errors come back as actionable text rather than stack traces.

The authoring tool for this audience *is the LLM client* (PLAN.md §4.6). This package is the tool surface; the knowledge surface is `docs/llms.txt` + the published skill.

## Tools

| Tool | Purpose |
|---|---|
| `scaffold_course` | Create a new course (tree + manifest) in the managed directory |
| `get_course` | Read the full `course.json` manifest |
| `update_structure` | Replace the modules/pages structure |
| `add_page` / `update_page` | Page content CRUD |
| `list_components` / `get_component_doc` | Component discovery + full specs (so the model never guesses an API) |
| `validate` | Schema + a11y + tracking checks; returns machine codes **and** `message_human` action sentences |
| `preview` | Launch the fake-LMS harness, return a URL |
| `package_course` | Build a SCORM/cmi5/web artifact (validates first) |
| `export_course` / `import_course` | `.oeltcourse` single-file round-trip |
| `set_theme` | Write `--oelt-*` design tokens |

## Managed courses directory

All course operations are sandboxed to a single root. Tools take **course names**, never file paths; names are validated (`^[A-Za-z0-9][A-Za-z0-9 _-]*$`) so traversal is impossible.

- Default root: `~/Documents/OELTKit Courses/`
- Override: set the `OELT_COURSES_DIR` environment variable.

## Install

### Claude Desktop (one-click `.mcpb`)

```bash
npm run build:mcpb -w @oeltkit/mcp   # → packages/mcp/dist/oelt-mcp.mcpb
```

Open the `.mcpb` in Claude Desktop (**Settings → Extensions → Install**). The bundle is self-contained — it carries the component specs, schema, runtime/components bundles, and preview harness, so it works with no repo checkout. You can optionally point it at a custom courses folder during install.

### Claude Code

```bash
claude mcp add oelt -- node /absolute/path/to/packages/mcp/dist/esm/index.js
```

(Run `npm run build -w @oeltkit/mcp` first.)

### Any stdio MCP host

Command: `node <path>/dist/esm/index.js`. Set `OELT_COURSES_DIR` in the host's env block to relocate the courses folder.

## Conformance suite

`conformance/` is a **transport-agnostic** runner that executes a scripted authoring session (scaffold → add pages → validate → fix → package → export) against **any** endpoint and asserts tool names, schemas, and behavioral outcomes. This is the parity contract oeltkit-cloud CI runs against its hosted HTTP endpoint.

```bash
npm run build -w @oeltkit/mcp
node packages/mcp/dist/conformance/run.js --stdio "node packages/mcp/dist/esm/index.js"
# or against a remote endpoint:
node packages/mcp/dist/conformance/run.js --http https://cloud.example/mcp
```

The same suite (plus a canned LLM-transcript replay) runs under `npm test` against the local stdio server — that green run is the gate.
