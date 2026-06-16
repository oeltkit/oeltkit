# Task 09 — MCP server + conformance suite

**Prerequisites:** Task 07 merged (`.oeltcourse` tools exist). The `packages/mcp` stub becomes real. Context: PLAN.md §4.6, SIMPLICITY.md §1/§3.

**Session prompt for Claude Code:**

---

Implement `@oeltkit/mcp` (stdio transport; TypeScript MCP SDK) wrapping the CLI and fs operations. Tools (draft list from PLAN.md §4.6, refine against what the CLI actually exposes):

`scaffold_course`, `get_course`, `update_structure`, `add_page`, `update_page`, `list_components`, `get_component_doc` (serve the component READMEs — never let the model guess APIs), `validate` (machine fields + `message_human`), `preview` (launch harness, return URL), `package`, `export_course`/`import_course` (`.oeltcourse`), `set_theme`.

Requirements:

1. **Tool descriptions are product surface** — write them for model consumption, with the workflow-verb framing from SIMPLICITY.md §3 in mind (the skill does the heavy lifting, but descriptions must not be developer-jargon).
2. **Managed courses directory** by default (`~/Documents/OELTKit Courses/` or configured root); tools take course names, not file paths, with path access constrained to the root (no traversal).
3. **Errors return actionable text**, never stack traces.
4. **Conformance suite** (`packages/mcp/conformance/`): a transport-agnostic test runner that executes a scripted authoring session (scaffold → add pages → validate → fix → package → export) against ANY endpoint (stdio or HTTP URL), asserting tool names, schemas, and behavioral outcomes. This is the parity contract oeltkit-cloud's CI will run against its hosted endpoint (CLOUD-ARCHITECTURE.md §3) — design for that consumer.
5. **`.mcpb` packaging**: build script producing a one-click desktop-extension bundle (manifest + bundled server); document the install flow; CI artifact.
6. Tests: conformance suite green against own stdio server; behavioral assertions for each tool; an end-to-end "LLM transcript replay" test using a canned tool-call sequence from a real authoring session.

The conformance suite green is the gate. Commit straight to `main`. Update `docs/llms.txt` with MCP setup per client (Claude Desktop via `.mcpb`, Claude Code, Cowork).

---

**Async spot-check (non-blocking, high-value):** install the `.mcpb` on a clean Claude Desktop and author a small course conversationally — note every moment that felt technical and file each as an issue. This is the real UX test of the whole "dead simple for an ID" thesis; do it once the build is green, but it doesn't block the build.
