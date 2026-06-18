// The conformance gate: build the real server, talk to it over stdio (the same
// transport Claude Desktop uses), and assert the scripted authoring session
// passes every check. Plus a canned LLM-transcript replay.
//
// This exercises the FULL stack: MCP protocol → server handlers → CLI lib → fs.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stdioClient, getDefaultEnv, type MCPClient } from "./client.js";
import { runConformance } from "./suite.js";
import { replayTranscript, SAMPLE_TRANSCRIPT } from "./transcript.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(MCP_ROOT, "../..");
const SERVER = join(MCP_ROOT, "dist", "esm", "index.js");

let coursesDir: string;
let client: MCPClient;

beforeAll(() => {
  // Build the runnable stdio server (cli + mcp) AND the runtime + components
  // bundles the packager embeds — the conformance session packages a course, and
  // `npm test` runs before `npm run build` in CI, so the bundles won't exist yet
  // unless we build them here (mirrors playwright globalSetup; self-contained).
  execSync(
    "npm run build -w @oeltkit/runtime -w @oeltkit/components -w @oeltkit/cli -w @oeltkit/mcp",
    { cwd: REPO_ROOT, stdio: "inherit" },
  );

  coursesDir = mkdtempSync(join(tmpdir(), "oelt-mcp-conf-"));
  client = stdioClient("node", [SERVER], {
    env: { ...getDefaultEnv(), OELT_COURSES_DIR: coursesDir },
  });
}, 120_000);

afterAll(async () => {
  await client?.close();
  if (coursesDir) rmSync(coursesDir, { recursive: true, force: true });
});

describe("MCP conformance — scripted authoring session over stdio", () => {
  it("passes every conformance check", async () => {
    const results = await runConformance(client, "conformance course");
    const failures = results.filter((r) => !r.pass);
    // Surface any failures with their detail for debuggability.
    expect(failures.map((f) => `${f.name}${f.detail ? `: ${f.detail}` : ""}`)).toEqual([]);
    expect(results.length).toBeGreaterThan(20);
  }, 60_000);
});

describe("MCP conformance — canned LLM transcript replay", () => {
  it("replays a real authoring sequence with expected outcomes", async () => {
    const results = await replayTranscript(client, SAMPLE_TRANSCRIPT, "transcript course");
    const failures = results.filter((r) => !r.pass);
    expect(failures.map((f) => `${f.step}: ${f.detail ?? ""}`)).toEqual([]);
  }, 60_000);
});
