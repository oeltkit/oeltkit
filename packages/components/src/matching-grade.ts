// Pure grading for <oelt-matching>, DOM-free for unit testing. See matching.md §5.

import { gradeByPosition, type PositionGrade } from "./dnd.js";

export interface Pair {
  prompt: string;
  value: string;
}

/**
 * Grade a matching: for each prompt (in authored order) compare the value the
 * learner placed on it against the correct value. `placed` maps value → prompt.
 * Score = fraction of prompts holding their correct value; passed iff all do.
 * `response` = "prompt=value" per pair, joined by "," (empty target → "prompt=").
 */
export function gradeMatching(pairs: Pair[], placed: Record<string, string>): PositionGrade {
  // Invert: prompt → placed value.
  const valueAt: Record<string, string> = {};
  for (const [value, prompt] of Object.entries(placed)) valueAt[prompt] = value;

  const correct = pairs.map((p) => p.value);
  const current = pairs.map((p) => valueAt[p.prompt] ?? "");
  const base = gradeByPosition(correct, current);

  const response = pairs.map((p) => `${p.prompt}=${valueAt[p.prompt] ?? ""}`).join(",");
  return { result: base.result, score: base.score, response };
}
