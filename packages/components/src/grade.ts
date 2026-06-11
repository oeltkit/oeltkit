// Pure grading logic for <oelt-mcq>, separated so it is unit-testable without a
// DOM. See specs/components/mcq.md §5.

import type { InteractionResult } from "./base.js";

export interface Grade {
  result: InteractionResult;
  score: number;
  response: string;
}

/**
 * @param mode   "single" | "multiple"
 * @param key    correct option values
 * @param chosen selected option values
 */
export function grade(mode: "single" | "multiple", key: string[], chosen: string[]): Grade {
  const response = chosen.join(",");
  if (mode === "single") {
    const passed = chosen.length === 1 && key.includes(chosen[0]!);
    return { result: passed ? "passed" : "failed", score: passed ? 1 : 0, response };
  }
  // multiple: exact-set match passes; score = (correct − incorrect) / |key|, clamped 0–1.
  const keySet = new Set(key);
  const chosenSet = new Set(chosen);
  const correct = chosen.filter((c) => keySet.has(c)).length;
  const incorrect = chosen.filter((c) => !keySet.has(c)).length;
  const exact = correct === key.length && chosenSet.size === keySet.size && incorrect === 0;
  const score = key.length > 0 ? Math.max(0, Math.min(1, (correct - incorrect) / key.length)) : 0;
  return { result: exact ? "passed" : "failed", score, response };
}
