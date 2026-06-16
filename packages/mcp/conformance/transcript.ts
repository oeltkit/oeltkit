// Canned "LLM transcript replay" — a recorded sequence of tool calls from a
// real authoring session, with the expected outcome of each step. Replaying it
// guards against regressions in the conversational authoring flow (the actual
// way Claude drives the server), distinct from the structural conformance suite.

import type { MCPClient } from "./client.js";

export interface TranscriptStep {
  /** Human label for the step (what the author asked for). */
  step: string;
  tool: string;
  args: Record<string, unknown>;
  /** Substring that MUST appear in the tool's text output. */
  expectContains?: string;
  /** If true, the call is expected to return isError. */
  expectError?: boolean;
}

export interface StepResult {
  step: string;
  pass: boolean;
  detail?: string;
}

// A real-ish authoring session: build a 2-page "Workplace Safety" course with a
// quiz, hit a validation error (typo'd interaction id), fix it, then package.
// {{NAME}} is substituted with the run's course name.
export const SAMPLE_TRANSCRIPT: TranscriptStep[] = [
  {
    step: "Author: 'Start a new course called Workplace Safety'",
    tool: "scaffold_course",
    args: { name: "{{NAME}}", title: "Workplace Safety", targets: ["scorm12", "web"] },
    expectContains: "Created course",
  },
  {
    step: "Author: 'What interaction components are available?'",
    tool: "list_components",
    args: {},
    expectContains: "oelt-mcq",
  },
  {
    step: "Assistant looks up the MCQ spec before authoring",
    tool: "get_component_doc",
    args: { component: "oelt-mcq" },
    expectContains: "oelt-option",
  },
  {
    step: "Author: 'Add a quiz page with one multiple-choice question'",
    tool: "add_page",
    args: {
      name: "{{NAME}}",
      module_id: "m1",
      page_id: "safety-quiz",
      page_title: "Safety Quiz",
      html: '<section><h1>Safety Quiz</h1><oelt-mcq id="hazard-q" mode="single" key="b"><p slot="prompt">What do you do first?</p><oelt-option value="a">Ignore it</oelt-option><oelt-option value="b">Report the hazard</oelt-option></oelt-mcq></section>',
    },
    expectContains: "Added page",
  },
  {
    step: "Assistant declares the interaction — but typos the id (hazard-quiz vs hazard-q)",
    tool: "update_structure",
    args: {
      name: "{{NAME}}",
      structure: [
        {
          id: "m1",
          title: "Module 1",
          pages: [
            { id: "p1", title: "Welcome", src: "pages/p1.html" },
            {
              id: "safety-quiz",
              title: "Safety Quiz",
              src: "pages/safety-quiz.html",
              interactions: [{ id: "hazard-quiz", type: "choice", required: true }],
            },
          ],
        },
      ],
    },
  },
  {
    step: "Assistant validates and sees the typo flagged with a plain-language fix",
    tool: "validate",
    args: { name: "{{NAME}}" },
    expectContains: "interaction-missing",
  },
  {
    step: "Assistant fixes the interaction id to match the element",
    tool: "update_structure",
    args: {
      name: "{{NAME}}",
      structure: [
        {
          id: "m1",
          title: "Module 1",
          pages: [
            { id: "p1", title: "Welcome", src: "pages/p1.html" },
            {
              id: "safety-quiz",
              title: "Safety Quiz",
              src: "pages/safety-quiz.html",
              interactions: [{ id: "hazard-q", type: "choice", required: true }],
            },
          ],
        },
      ],
    },
  },
  {
    step: "Validation now passes",
    tool: "validate",
    args: { name: "{{NAME}}" },
    expectContains: "valid",
  },
  {
    step: "Author: 'Package it for our LMS (SCORM 1.2)'",
    tool: "package_course",
    args: { name: "{{NAME}}", target: "scorm12" },
    expectContains: ".zip",
  },
];

function subst(value: unknown, name: string): unknown {
  if (typeof value === "string") return value.replace(/\{\{NAME\}\}/g, name);
  if (Array.isArray(value)) return value.map((v) => subst(v, name));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, subst(v, name)]));
  }
  return value;
}

export async function replayTranscript(
  client: MCPClient,
  transcript: TranscriptStep[],
  courseName: string,
): Promise<StepResult[]> {
  const out: StepResult[] = [];
  for (const s of transcript) {
    const args = subst(s.args, courseName) as Record<string, unknown>;
    const res = await client.callTool(s.tool, args);
    const txt = res.content.map((c) => c.text).join("\n");

    if (s.expectError) {
      out.push(
        res.isError
          ? { step: s.step, pass: true }
          : {
              step: s.step,
              pass: false,
              detail: `expected an error but got: ${txt.slice(0, 120)}`,
            },
      );
      continue;
    }
    if (res.isError) {
      out.push({ step: s.step, pass: false, detail: `unexpected error: ${txt}` });
      continue;
    }
    if (s.expectContains && !txt.includes(s.expectContains)) {
      out.push({
        step: s.step,
        pass: false,
        detail: `expected "${s.expectContains}" in: ${txt.slice(0, 120)}`,
      });
      continue;
    }
    out.push({ step: s.step, pass: true });
  }
  return out;
}
