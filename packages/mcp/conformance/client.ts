// Transport-agnostic MCP client for the conformance suite.
// Two implementations: stdio (spawns the server) and HTTP (POST JSON-RPC to a URL).
// The cloud CI will use the HTTP client against its hosted endpoint; local tests use stdio.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * The minimal inherited environment a spawned stdio server needs (PATH, etc.),
 * to which callers add their own vars (e.g. OELT_COURSES_DIR). StdioClientTransport
 * does NOT inherit the full parent env by default.
 */
export function getDefaultEnv(): Record<string, string> {
  return getDefaultEnvironment();
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, unknown>; required?: string[] };
}

export interface CallResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

export interface MCPClient {
  listTools(): Promise<Tool[]>;
  callTool(name: string, args?: Record<string, unknown>): Promise<CallResult>;
  close(): Promise<void>;
}

// ── stdio transport ───────────────────────────────────────────────────────────

export function stdioClient(
  serverCommand: string,
  serverArgs: string[] = [],
  opts: { env?: Record<string, string>; cwd?: string } = {},
): MCPClient {
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;

  async function connect() {
    if (client) return;
    transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
      ...(opts.env ? { env: opts.env } : {}),
      ...(opts.cwd ? { cwd: opts.cwd } : {}),
    });
    client = new Client({ name: "conformance-runner", version: "0.0.0" });
    await client.connect(transport);
  }

  return {
    async listTools() {
      await connect();
      const res = await client!.listTools();
      return res.tools as Tool[];
    },
    async callTool(name, args = {}) {
      await connect();
      const res = await client!.callTool({ name, arguments: args });
      return res as CallResult;
    },
    async close() {
      if (client) {
        await client.close();
        client = null;
        transport = null;
      }
    },
  };
}

// ── HTTP transport (for remote/cloud endpoints) ────────────────────────────────
// Sends raw JSON-RPC 2.0 messages via POST. The endpoint must accept
// Content-Type: application/json and return JSON-RPC responses.

export function httpClient(baseUrl: string): MCPClient {
  let msgId = 1;

  async function rpc(method: string, params?: unknown): Promise<unknown> {
    const id = msgId++;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${baseUrl}`);
    const data = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }

  return {
    async listTools() {
      const res = (await rpc("tools/list")) as { tools: Tool[] };
      return res.tools;
    },
    async callTool(name, args = {}) {
      return (await rpc("tools/call", { name, arguments: args })) as CallResult;
    },
    async close() {
      /* HTTP is stateless */
    },
  };
}
