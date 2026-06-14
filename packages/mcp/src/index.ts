#!/usr/bin/env node
/**
 * @oeltkit/mcp — stdio MCP server for LLM-first e-learning authoring.
 *
 * Tools: scaffold_course, get_course, update_structure, add_page, update_page,
 *        list_components, get_component_doc, validate, preview, package_course,
 *        export_course, import_course, set_theme.
 *
 * Managed courses directory: ~/Documents/OELTKit Courses/
 * Override with OELT_COURSES_DIR env var.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import * as T from "./tools.js";

// ── tool catalogue ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "scaffold_course",
    description:
      "Create a new OELT course in the managed courses directory. Returns the path and a suggested next step. Call this when an author wants to start a new course.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Directory name (letters, numbers, spaces, hyphens, underscores)" },
        title: { type: "string", description: "Human-readable course title (shown in the player)" },
        targets: {
          type: "array",
          items: { type: "string", enum: ["scorm12", "scorm2004", "cmi5", "web"] },
          description: "Delivery targets. Default: all four.",
        },
        lang: { type: "string", description: "BCP-47 language code. Default: en" },
      },
      required: ["name", "title"],
    },
  },
  {
    name: "get_course",
    description:
      "Return the full course.json manifest for an existing course. Use this to inspect structure, tracking rules, or interaction declarations before making changes.",
    inputSchema: {
      type: "object" as const,
      properties: { name: { type: "string", description: "Course directory name" } },
      required: ["name"],
    },
  },
  {
    name: "update_structure",
    description:
      "Replace the modules-and-pages structure of a course.json. The structure must match the manifest-v0 format (array of modules, each with id/title/pages). Call validate after to confirm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Course name" },
        structure: { type: "array", description: "New modules array (manifest-v0 §3 format)" },
      },
      required: ["name", "structure"],
    },
  },
  {
    name: "add_page",
    description:
      "Add a new page to an existing module. Creates the HTML file and updates course.json. Optionally supply the page HTML; defaults to a heading stub.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Course name" },
        module_id: { type: "string", description: "Id of the module to add the page to" },
        page_id: { type: "string", description: "Unique page id (^[A-Za-z][A-Za-z0-9_-]*$)" },
        page_title: { type: "string", description: "Page title" },
        html: { type: "string", description: "Page HTML body (no <html>/<body> wrapper). Defaults to a heading stub." },
      },
      required: ["name", "module_id", "page_id", "page_title"],
    },
  },
  {
    name: "update_page",
    description:
      "Replace the full HTML content of an existing page. Use get_course to find the page src path first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Course name" },
        src: { type: "string", description: "Page src path relative to the course root (e.g. pages/p1.html)" },
        html: { type: "string", description: "New page HTML body content" },
      },
      required: ["name", "src", "html"],
    },
  },
  {
    name: "list_components",
    description:
      "List all available OELT component elements (oelt-mcq, oelt-branching, oelt-media, etc.) with one-line descriptions. Use get_component_doc to get the full spec before using a component in a page.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_component_doc",
    description:
      "Return the full behavioral spec for one OELT component — attributes, slots, events, keyboard map, accessibility notes, and canonical usage examples. Always call this before writing a component into a page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        component: { type: "string", description: "Component name: oelt-mcq, oelt-branching, oelt-media, etc. (with or without the oelt- prefix)" },
      },
      required: ["component"],
    },
  },
  {
    name: "validate",
    description:
      "Validate a course: schema check, id uniqueness, interaction declarations, media accessibility, and tracking consistency. Returns both machine codes and plain-language action sentences (message_human) so findings can be fed directly back to the LLM for auto-fix.",
    inputSchema: {
      type: "object" as const,
      properties: { name: { type: "string", description: "Course name" } },
      required: ["name"],
    },
  },
  {
    name: "preview",
    description:
      "Launch the local preview harness for a course and return the URL. The harness simulates SCORM 1.2/2004, cmi5, and standalone-web delivery in one browser window with a live tracking panel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Course name" },
        port: { type: "number", description: "Port number. Default: auto-assigned." },
      },
      required: ["name"],
    },
  },
  {
    name: "package_course",
    description:
      "Build a distributable package (zip) for a course. Validates first and refuses if there are errors. Returns the output file path.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Course name" },
        target: {
          type: "string",
          enum: ["scorm12", "scorm2004", "cmi5", "web"],
          description: "Delivery target",
        },
        out: { type: "string", description: "Output file path. Default: <course-dir>/<id>-<target>.zip" },
      },
      required: ["name", "target"],
    },
  },
  {
    name: "export_course",
    description:
      "Export a course as a portable .oeltcourse single-file archive. Use this to hand off a course to another tool or store it for transport.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Course name" },
        out: { type: "string", description: "Output .oeltcourse path. Default: <courses-root>/<name>.oeltcourse" },
      },
      required: ["name"],
    },
  },
  {
    name: "import_course",
    description:
      "Import a .oeltcourse archive into the managed courses directory. The course becomes available by name for all other tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file: { type: "string", description: "Absolute path to the .oeltcourse file to import" },
        name: { type: "string", description: "Course name to create in the managed directory" },
      },
      required: ["file", "name"],
    },
  },
  {
    name: "set_theme",
    description:
      "Write a CSS design-token file for a course and update course.json to reference it. Tokens are --oelt-* custom properties.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Course name" },
        tokens: {
          type: "object",
          description: "CSS custom property map, e.g. { \"--oelt-color-primary\": \"#e63\" }",
          additionalProperties: { type: "string" },
        },
      },
      required: ["name", "tokens"],
    },
  },
];

// ── server ────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "oelt-mcp", version: "0.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    const a = args as Record<string, unknown>;
    let content;
    switch (name) {
      case "scaffold_course":
        content = await T.scaffold_course(a as Parameters<typeof T.scaffold_course>[0]);
        break;
      case "get_course":
        content = T.get_course(a as Parameters<typeof T.get_course>[0]);
        break;
      case "update_structure":
        content = T.update_structure(a as Parameters<typeof T.update_structure>[0]);
        break;
      case "add_page":
        content = T.add_page(a as Parameters<typeof T.add_page>[0]);
        break;
      case "update_page":
        content = T.update_page(a as Parameters<typeof T.update_page>[0]);
        break;
      case "list_components":
        content = T.list_components();
        break;
      case "get_component_doc":
        content = T.get_component_doc(a as Parameters<typeof T.get_component_doc>[0]);
        break;
      case "validate":
        content = T.validate(a as Parameters<typeof T.validate>[0]);
        break;
      case "preview":
        content = await T.preview(a as Parameters<typeof T.preview>[0]);
        break;
      case "package_course":
        content = await T.package_course(a as Parameters<typeof T.package_course>[0]);
        break;
      case "export_course":
        content = await T.export_course(a as Parameters<typeof T.export_course>[0]);
        break;
      case "import_course":
        content = await T.import_course(a as Parameters<typeof T.import_course>[0]);
        break;
      case "set_theme":
        content = T.set_theme(a as Parameters<typeof T.set_theme>[0]);
        break;
      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
    return { content: [content] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: msg }], isError: true };
  }
});

// ── start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

/** Package version placeholder; real version is injected at publish time. */
export const VERSION = "0.0.0";
