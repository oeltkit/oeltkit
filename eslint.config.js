import js from "@eslint/js";
import tseslint from "typescript-eslint";

const r = "readonly";
const NODE_GLOBALS = {
  process: r,
  console: r,
  Buffer: r,
  URL: r,
  URLSearchParams: r,
  fetch: r,
  setTimeout: r,
  structuredClone: r,
  TextEncoder: r,
};
const BROWSER_GLOBALS = {
  window: r,
  document: r,
  location: r,
  navigator: r,
  fetch: r,
  localStorage: r,
  crypto: r,
  TextEncoder: r,
  structuredClone: r,
  URL: r,
  URLSearchParams: r,
  console: r,
  setTimeout: r,
};

// Minimal flat config. Type-aware linting is intentionally left off for the
// scaffold to keep it fast and dependency-light; tighten per package later.
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.min.js", "harness/screenshots/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node-side scripts (server, build/maintenance helpers, test runners).
    files: ["test/**/*.mjs", "harness/**/*.mjs", "packages/*/scripts/**/*.mjs"],
    languageOptions: { globals: NODE_GLOBALS },
  },
  {
    // Browser-side harness client.
    files: ["harness/client/**/*.js"],
    languageOptions: { globals: BROWSER_GLOBALS },
  },
  {
    // Dev/CI scripts (scripts/**): Node code that also embeds browser-side
    // callbacks run via Playwright's page/frame.evaluate, so both global sets
    // apply, plus the Node 22 multipart globals used by the SCORM Cloud client.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { ...NODE_GLOBALS, ...BROWSER_GLOBALS, FormData: r, Blob: r } },
  },
  {
    // Tests build malformed manifests; the harness reaches untyped window
    // globals — `any` casts keep both terse.
    files: ["test/**/*.test.ts", "harness/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
