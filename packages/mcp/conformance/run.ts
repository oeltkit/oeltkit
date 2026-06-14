#!/usr/bin/env node
// Standalone conformance runner. Points the suite at any endpoint and prints a
// pass/fail report. oeltkit-cloud CI invokes this against its hosted endpoint.
//
//   node dist/esm/conformance/run.js --stdio "node dist/esm/index.js"
//   node dist/esm/conformance/run.js --http https://cloud.example/mcp
//
// Exit code 0 iff every check passes.

import { stdioClient, httpClient, type MCPClient } from "./client.js";
import { runConformance } from "./suite.js";

function parse(argv: string[]): { mode: "stdio" | "http"; target: string; preview: boolean } {
  let mode: "stdio" | "http" = "stdio";
  let target = "node dist/esm/index.js";
  let preview = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stdio") {
      mode = "stdio";
      target = argv[++i] ?? target;
    } else if (argv[i] === "--http") {
      mode = "http";
      target = argv[++i] ?? "";
    } else if (argv[i] === "--preview") {
      preview = true;
    }
  }
  return { mode, target, preview };
}

async function main(): Promise<number> {
  const { mode, target, preview } = parse(process.argv.slice(2));
  let client: MCPClient;
  if (mode === "stdio") {
    const [cmd, ...args] = target.split(" ");
    client = stdioClient(cmd!, args);
  } else {
    client = httpClient(target);
  }

  const courseName = `conformance ${process.pid}`;
  try {
    const results = await runConformance(client, courseName, { runPreview: preview });
    let failed = 0;
    for (const c of results) {
      const mark = c.pass ? "✓" : "✗";
      if (!c.pass) failed++;
      console.log(`  ${mark} ${c.name}${!c.pass && c.detail ? ` — ${c.detail}` : ""}`);
    }
    console.log(`\n${results.length - failed}/${results.length} checks passed`);
    return failed === 0 ? 0 : 1;
  } finally {
    await client.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(`conformance: ${(err as Error).message}`);
    process.exit(2);
  });
