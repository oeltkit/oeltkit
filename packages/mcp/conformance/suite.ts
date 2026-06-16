// Transport-agnostic conformance suite. Runs a scripted authoring session
// (scaffold → add pages → validate → fix → package → export) against ANY
// endpoint and asserts tool names, schemas, and behavioral outcomes.
//
// This is the parity contract: oeltkit-cloud CI runs the SAME suite against its
// hosted HTTP endpoint (CLOUD-ARCHITECTURE.md §3). Keep it free of node-only
// assumptions beyond the client abstraction.

import type { MCPClient, Tool } from "./client.js";

export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

// The tools every conforming endpoint MUST expose.
export const REQUIRED_TOOLS = [
  "scaffold_course",
  "get_course",
  "update_structure",
  "add_page",
  "update_page",
  "list_components",
  "get_component_doc",
  "validate",
  "preview",
  "package_course",
  "export_course",
  "import_course",
  "set_theme",
] as const;

function check(name: string, pass: boolean, detail?: string): CheckResult {
  return detail === undefined ? { name, pass } : { name, pass, detail };
}

function text(res: { content: { type: string; text: string }[] }): string {
  return res.content.map((c) => c.text).join("\n");
}

/**
 * Run the full conformance session. Returns a flat list of checks.
 * `courseName` should be unique per run so repeated runs don't collide.
 */
export async function runConformance(
  client: MCPClient,
  courseName: string,
  opts: { runPreview?: boolean } = {},
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const r = (c: CheckResult) => results.push(c);

  // ── 1. Tool discovery + schema shape ─────────────────────────────────────
  const tools = await client.listTools();
  const byName = new Map<string, Tool>(tools.map((t) => [t.name, t]));

  for (const required of REQUIRED_TOOLS) {
    const t = byName.get(required);
    r(check(`tool present: ${required}`, !!t));
    if (t) {
      r(
        check(
          `tool has non-empty description: ${required}`,
          typeof t.description === "string" && t.description.length > 20,
          t.description?.slice(0, 40),
        ),
      );
      r(
        check(
          `tool has object inputSchema: ${required}`,
          t.inputSchema?.type === "object" && typeof t.inputSchema.properties === "object",
        ),
      );
    }
  }

  // ── 2. scaffold_course ────────────────────────────────────────────────────
  const scaffold = await client.callTool("scaffold_course", {
    name: courseName,
    title: "Conformance Test Course",
    targets: ["scorm12", "web"],
  });
  r(check("scaffold_course succeeds", !scaffold.isError, text(scaffold)));

  // ── 3. get_course returns valid manifest ──────────────────────────────────
  const got = await client.callTool("get_course", { name: courseName });
  r(check("get_course succeeds", !got.isError));
  let manifest: { course?: { structure?: { id: string; pages: unknown[] }[]; title?: string } } =
    {};
  try {
    manifest = JSON.parse(text(got));
  } catch {
    /* leave empty */
  }
  r(
    check(
      "get_course returns a manifest with structure",
      Array.isArray(manifest.course?.structure) && manifest.course!.structure!.length >= 1,
    ),
  );
  r(check("scaffolded title round-trips", manifest.course?.title === "Conformance Test Course"));

  // ── 4. list_components + get_component_doc ────────────────────────────────
  const comps = await client.callTool("list_components");
  r(check("list_components succeeds", !comps.isError));
  let compList: { components?: { element: string }[] } = {};
  try {
    compList = JSON.parse(text(comps));
  } catch {
    /* leave empty */
  }
  const hasMcq = compList.components?.some((c) => c.element === "oelt-mcq") ?? false;
  r(check("list_components includes oelt-mcq", hasMcq));

  const doc = await client.callTool("get_component_doc", { component: "oelt-mcq" });
  r(check("get_component_doc(oelt-mcq) succeeds", !doc.isError));
  r(check("get_component_doc returns substantive spec", text(doc).length > 200));

  const badDoc = await client.callTool("get_component_doc", { component: "oelt-nonexistent" });
  r(
    check(
      "get_component_doc rejects unknown component with actionable error",
      !!badDoc.isError && /available/i.test(text(badDoc)),
      text(badDoc),
    ),
  );

  // ── 5. add_page (with a component that needs an interaction declaration) ──
  const moduleId = manifest.course?.structure?.[0]?.id ?? "m1";
  const addQuiz = await client.callTool("add_page", {
    name: courseName,
    module_id: moduleId,
    page_id: "quiz",
    page_title: "Quiz",
    html: '<section><h1>Quiz</h1><oelt-mcq id="q1" mode="single" key="b"><p slot="prompt">Pick b</p><oelt-option value="a">A</oelt-option><oelt-option value="b">B</oelt-option></oelt-mcq></section>',
  });
  r(check("add_page succeeds", !addQuiz.isError, text(addQuiz)));

  // Add an interaction declaration via update_structure so tracking references it.
  const cur = JSON.parse(text(await client.callTool("get_course", { name: courseName }))) as {
    course: { structure: { id: string; pages: { id: string; interactions?: unknown[] }[] }[] };
  };
  for (const m of cur.course.structure) {
    for (const p of m.pages) {
      if (p.id === "quiz") p.interactions = [{ id: "q1", type: "choice", required: true }];
    }
  }
  const restructure = await client.callTool("update_structure", {
    name: courseName,
    structure: cur.course.structure,
  });
  r(check("update_structure succeeds", !restructure.isError, text(restructure)));

  // ── 6. validate: should surface a finding for the orphaned tracking rule? ─
  // The course has a required interaction but default completion is all-pages-viewed,
  // which is valid. So this validate should pass (declared interaction exists in HTML).
  const validOk = await client.callTool("validate", { name: courseName });
  r(check("validate succeeds on a well-formed course", !validOk.isError, text(validOk)));
  r(check("validate output mentions validity", /valid/i.test(text(validOk))));

  // ── 7. validate detects an injected error + message_human present ─────────
  // Break the course: point a page at a missing interaction declaration.
  const broken = JSON.parse(text(await client.callTool("get_course", { name: courseName }))) as {
    course: {
      structure: { pages: { id: string; interactions?: { id: string; type: string }[] }[] }[];
    };
  };
  broken.course.structure[0]!.pages.find((p) => p.id === "quiz")!.interactions = [
    { id: "does-not-exist", type: "choice" },
  ];
  await client.callTool("update_structure", {
    name: courseName,
    structure: broken.course.structure,
  });
  const validBad = await client.callTool("validate", { name: courseName });
  r(
    check(
      "validate reports interaction-missing for a bad declaration",
      /interaction-missing/.test(text(validBad)),
      text(validBad),
    ),
  );
  r(
    check(
      "validate output includes message_human (plain-language fix)",
      /message_human/.test(text(validBad)) || /add id=/.test(text(validBad)),
    ),
  );

  // ── 8. fix the error (LLM-style auto-fix using the finding) ───────────────
  broken.course.structure[0]!.pages.find((p) => p.id === "quiz")!.interactions = [
    { id: "q1", type: "choice" },
  ];
  await client.callTool("update_structure", {
    name: courseName,
    structure: broken.course.structure,
  });
  const validFixed = await client.callTool("validate", { name: courseName });
  r(check("validate passes after fix", !/✗/.test(text(validFixed)), text(validFixed)));

  // ── 9. package_course (web target — no LMS needed) ────────────────────────
  const pkg = await client.callTool("package_course", { name: courseName, target: "web" });
  r(check("package_course(web) succeeds", !pkg.isError && /\.zip/.test(text(pkg)), text(pkg)));

  // ── 10. export_course → .oeltcourse ───────────────────────────────────────
  const exp = await client.callTool("export_course", { name: courseName });
  r(check("export_course succeeds", !exp.isError && /\.oeltcourse/.test(text(exp)), text(exp)));

  // ── 11. set_theme ─────────────────────────────────────────────────────────
  const theme = await client.callTool("set_theme", {
    name: courseName,
    tokens: { "--oelt-color-primary": "#e63946" },
  });
  r(check("set_theme succeeds", !theme.isError, text(theme)));

  // ── 12. error handling: scaffold a duplicate → actionable, no stack trace ─
  const dup = await client.callTool("scaffold_course", {
    name: courseName,
    title: "Duplicate",
  });
  r(
    check(
      "duplicate scaffold returns actionable error (no stack trace)",
      !!dup.isError && /already exists/i.test(text(dup)) && !/\bat \w+.*:\d+:\d+/.test(text(dup)),
      text(dup),
    ),
  );

  // ── 13. preview (optional — spawns a server; skip in CI by default) ───────
  if (opts.runPreview) {
    const prev = await client.callTool("preview", { name: courseName });
    r(
      check(
        "preview returns a URL",
        !prev.isError && /http:\/\/localhost:\d+/.test(text(prev)),
        text(prev),
      ),
    );
  }

  return results;
}
