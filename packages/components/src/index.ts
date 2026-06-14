/**
 * @oeltkit/components — entry point. Importing (ESM) or loading the IIFE bundle
 * registers the custom elements. See specs/components/*.md.
 */

import { OeltMcq, OeltOption } from "./mcq.js";
import { OeltBranching } from "./branching.js";
import { OeltMedia } from "./media.js";
import { OeltTextEntry } from "./text-entry.js";

export { OeltElement } from "./base.js";
export { OeltMcq, OeltOption } from "./mcq.js";
export { OeltBranching } from "./branching.js";
export { OeltMedia } from "./media.js";
export { OeltTextEntry } from "./text-entry.js";
export { grade } from "./grade.js";
export { gradeText, gradeNumeric } from "./grade-text.js";

/** Register every component (idempotent). Called automatically on import. */
export function defineComponents(): void {
  const reg: Array<[string, CustomElementConstructor]> = [
    ["oelt-option", OeltOption],
    ["oelt-mcq", OeltMcq],
    ["oelt-branching", OeltBranching],
    ["oelt-media", OeltMedia],
    ["oelt-text-entry", OeltTextEntry],
  ];
  if (typeof customElements === "undefined") return;
  for (const [name, ctor] of reg) if (!customElements.get(name)) customElements.define(name, ctor);
}

defineComponents();

/** Package version placeholder; real version is injected at publish time. */
export const VERSION = "0.0.0";
