/**
 * @oeltkit/components — entry point. Importing (ESM) or loading the IIFE bundle
 * registers the custom elements. See specs/components/*.md.
 */

import { OeltMcq, OeltOption } from "./mcq.js";
import { OeltBranching } from "./branching.js";
import { OeltMedia } from "./media.js";
import { OeltTextEntry } from "./text-entry.js";
import { OeltQuiz } from "./quiz.js";
import { OeltLikert } from "./likert.js";
import { OeltOrdering, OeltItem } from "./ordering.js";
import { OeltMatching, OeltPair } from "./matching.js";
import { OeltCategorize, OeltBucket, OeltToken } from "./categorize.js";
import { OeltTabs, OeltTab } from "./tabs.js";
import { OeltAccordion, OeltPanel } from "./accordion.js";
import { OeltFlipCards, OeltCard } from "./flip-cards.js";
import { OeltHotspot, OeltArea } from "./hotspot.js";

export { OeltElement } from "./base.js";
export { OeltMcq, OeltOption } from "./mcq.js";
export { OeltBranching } from "./branching.js";
export { OeltMedia } from "./media.js";
export { OeltTextEntry } from "./text-entry.js";
export { OeltQuiz } from "./quiz.js";
export { OeltLikert } from "./likert.js";
export { OeltOrdering, OeltItem } from "./ordering.js";
export { OeltMatching, OeltPair } from "./matching.js";
export { OeltCategorize, OeltBucket, OeltToken } from "./categorize.js";
export { OeltTabs, OeltTab } from "./tabs.js";
export { OeltAccordion, OeltPanel } from "./accordion.js";
export { OeltFlipCards, OeltCard } from "./flip-cards.js";
export { OeltHotspot, OeltArea } from "./hotspot.js";
export { grade } from "./grade.js";
export { gradeText, gradeNumeric } from "./grade-text.js";
export { aggregateScore, quizGrade, selectPool, itemScore } from "./quiz-grade.js";
export { likertScale } from "./likert-scale.js";
export { gradeByPosition, shuffle, shuffleDifferent, GrabController } from "./dnd.js";
export { gradeMatching } from "./matching-grade.js";
export { gradeCategorize } from "./categorize-grade.js";

/** Register every component (idempotent). Called automatically on import. */
export function defineComponents(): void {
  const reg: Array<[string, CustomElementConstructor]> = [
    ["oelt-option", OeltOption],
    ["oelt-mcq", OeltMcq],
    ["oelt-branching", OeltBranching],
    ["oelt-media", OeltMedia],
    ["oelt-text-entry", OeltTextEntry],
    ["oelt-quiz", OeltQuiz],
    ["oelt-likert", OeltLikert],
    ["oelt-item", OeltItem],
    ["oelt-ordering", OeltOrdering],
    ["oelt-pair", OeltPair],
    ["oelt-matching", OeltMatching],
    ["oelt-bucket", OeltBucket],
    ["oelt-token", OeltToken],
    ["oelt-categorize", OeltCategorize],
    ["oelt-tab", OeltTab],
    ["oelt-tabs", OeltTabs],
    ["oelt-panel", OeltPanel],
    ["oelt-accordion", OeltAccordion],
    ["oelt-card", OeltCard],
    ["oelt-flip-cards", OeltFlipCards],
    ["oelt-area", OeltArea],
    ["oelt-hotspot", OeltHotspot],
  ];
  if (typeof customElements === "undefined") return;
  for (const [name, ctor] of reg) if (!customElements.get(name)) customElements.define(name, ctor);
}

defineComponents();

/** Package version placeholder; real version is injected at publish time. */
export const VERSION = "0.0.0";
