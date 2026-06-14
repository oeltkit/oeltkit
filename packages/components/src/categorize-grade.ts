// Pure grading for <oelt-categorize>, DOM-free for unit testing. See categorize.md §5.
// Membership-based (a token is correct when its placed bucket == its declared
// bucket), unlike matching's positional bijection — so it does not reuse
// gradeByPosition.

import type { InteractionResult } from "./base.js";

export interface Token {
  value: string;
  bucket: string; // correct bucket
}

export interface CategorizeGrade {
  result: InteractionResult;
  score: number;
  response: string;
}

/**
 * Grade a categorization. `placed` maps token value → bucket it was dropped in
 * (absent = still in the bank). Score = fraction of tokens in their correct
 * bucket; passed iff all. `response` = "token=bucket" per token, joined by ",".
 */
export function gradeCategorize(tokens: Token[], placed: Record<string, string>): CategorizeGrade {
  const n = tokens.length;
  let matches = 0;
  for (const t of tokens) if (placed[t.value] === t.bucket) matches++;
  const score = n > 0 ? matches / n : 0;
  const response = tokens.map((t) => `${t.value}=${placed[t.value] ?? ""}`).join(",");
  return { result: matches === n ? "passed" : "failed", score, response };
}
