import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Minimal flat config. Type-aware linting is intentionally left off for the
// scaffold to keep it fast and dependency-light; tighten per package later.
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.min.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["test/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    // Tests deliberately construct malformed manifests to assert rejection;
    // `any` casts keep those mutations terse.
    files: ["test/**/*.test.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
