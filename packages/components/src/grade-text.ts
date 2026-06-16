// Pure grading logic for <oelt-text-entry>, separated so it is unit-testable
// without a DOM (mirrors grade.ts). See specs/components/text-entry.md §5.

import type { InteractionResult } from "./base.js";

export interface TextGrade {
  result: InteractionResult;
  score: number;
  response: string;
}

/** Normalize a text answer: trim, collapse internal whitespace, optionally lowercase. */
export function normalizeText(s: string, caseSensitive: boolean): string {
  const collapsed = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

/** Split a pipe-separated `answer` attribute into individual accepted answers. */
export function parseAnswers(answer: string): string[] {
  return answer
    .split("|")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * Grade a text-mode entry. `answers` are the raw (un-normalized) accepted values;
 * normalization is applied to both sides here.
 */
export function gradeText(answers: string[], input: string, caseSensitive: boolean): TextGrade {
  const norm = normalizeText(input, caseSensitive);
  const passed = answers.map((a) => normalizeText(a, caseSensitive)).includes(norm);
  return { result: passed ? "passed" : "failed", score: passed ? 1 : 0, response: input };
}

/**
 * Grade a numeric-mode entry. Non-numeric input fails. Passes iff
 * |input − answer| ≤ tolerance, compared float-safely so boundary values are
 * symmetric (e.g. with answer 3.14 ± 0.01, both 3.13 and 3.15 pass — without the
 * epsilon, float representation error makes 3.13 land just over 0.01 and fail).
 */
export function gradeNumeric(answer: number, tolerance: number, input: string): TextGrade {
  const trimmed = input.trim();
  const value = Number(trimmed);
  const epsilon = 1e-9 * Math.max(1, Math.abs(answer), Math.abs(value));
  const passed =
    trimmed !== "" && Number.isFinite(value) && Math.abs(value - answer) <= tolerance + epsilon;
  return { result: passed ? "passed" : "failed", score: passed ? 1 : 0, response: input };
}
