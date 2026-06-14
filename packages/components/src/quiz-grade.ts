// Pure aggregation logic for <oelt-quiz>, separated so the scoring/pooling math
// is unit-testable without a DOM. See specs/components/quiz.md §5.

import type { InteractionResult } from "./base.js";

export interface QuizItem {
  weight: number;
  score: number;
}

export interface QuizGrade {
  result: InteractionResult;
  score: number;
}

/**
 * Weighted mean of item scores (quiz.md §5), clamped to 0–1. Returns 0 when the
 * total weight is ≤ 0 (no scorable items).
 */
export function aggregateScore(items: QuizItem[]): number {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = items.reduce((sum, i) => sum + i.weight * i.score, 0);
  return Math.max(0, Math.min(1, weighted / totalWeight));
}

/**
 * Aggregate score + pass/fail. `mastery` set ⇒ passed iff score ≥ mastery;
 * absent ⇒ `completed`. (mastery = 0 is valid and means "always passes".)
 */
export function quizGrade(items: QuizItem[], mastery?: number): QuizGrade {
  const score = aggregateScore(items);
  if (mastery === undefined) return { result: "completed", score };
  return { result: score >= mastery ? "passed" : "failed", score };
}

/**
 * Select `n` of `ids` for a question pool, preserving original order, using the
 * injected `rng` (∈ [0,1)) so selection is deterministic in tests. When
 * `n >= ids.length`, returns all ids unchanged.
 */
export function selectPool(ids: string[], n: number, rng: () => number): string[] {
  if (n >= ids.length || n < 1) return [...ids];
  const order = ids.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const chosen = new Set(order.slice(0, n));
  return ids.filter((_, i) => chosen.has(i));
}

/**
 * Normalize a child question's reported interaction into a 0–1 score (quiz.md §5):
 * use the reported `score` when present; otherwise 1 for `passed`, 0 otherwise.
 */
export function itemScore(result: InteractionResult, score: number | undefined): number {
  if (typeof score === "number") return Math.max(0, Math.min(1, score));
  return result === "passed" ? 1 : 0;
}
