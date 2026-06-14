import { describe, it, expect } from "vitest";
import { aggregateScore, quizGrade, selectPool, itemScore } from "./quiz-grade.js";

describe("aggregateScore", () => {
  it("is a weighted mean", () => {
    // q1 weight 1 score 1, q2 weight 2 score 0 → (1·1 + 2·0)/3 = 0.333…
    expect(aggregateScore([{ weight: 1, score: 1 }, { weight: 2, score: 0 }])).toBeCloseTo(1 / 3);
  });
  it("equals the simple mean when weights are equal", () => {
    expect(aggregateScore([{ weight: 1, score: 1 }, { weight: 1, score: 0 }])).toBe(0.5);
  });
  it("returns 0 when total weight is 0", () => {
    expect(aggregateScore([{ weight: 0, score: 1 }])).toBe(0);
    expect(aggregateScore([])).toBe(0);
  });
  it("clamps to 0–1", () => {
    expect(aggregateScore([{ weight: 1, score: 5 }])).toBe(1);
    expect(aggregateScore([{ weight: 1, score: -5 }])).toBe(0);
  });
});

describe("quizGrade", () => {
  const perfect = [{ weight: 1, score: 1 }];
  const half = [{ weight: 1, score: 1 }, { weight: 1, score: 0 }];

  it("completed (no result pass/fail) when mastery is absent", () => {
    expect(quizGrade(half)).toEqual({ result: "completed", score: 0.5 });
  });
  it("passed when score ≥ mastery", () => {
    expect(quizGrade(perfect, 0.7)).toEqual({ result: "passed", score: 1 });
    expect(quizGrade(half, 0.5)).toEqual({ result: "passed", score: 0.5 }); // boundary
  });
  it("failed when score < mastery", () => {
    expect(quizGrade(half, 0.6)).toEqual({ result: "failed", score: 0.5 });
  });
  it("mastery 0 always passes", () => {
    expect(quizGrade([{ weight: 1, score: 0 }], 0).result).toBe("passed");
  });
});

describe("selectPool", () => {
  const ids = ["a", "b", "c", "d", "e"];
  // Deterministic rng cycling through fixed values.
  const rngFrom = (seq: number[]) => {
    let i = 0;
    return () => seq[i++ % seq.length]!;
  };

  it("returns all ids when n >= length", () => {
    expect(selectPool(ids, 5, Math.random)).toEqual(ids);
    expect(selectPool(ids, 9, Math.random)).toEqual(ids);
  });
  it("returns all ids when n < 1 (degenerate)", () => {
    expect(selectPool(ids, 0, Math.random)).toEqual(ids);
  });
  it("selects exactly n and preserves original relative order", () => {
    const picked = selectPool(ids, 3, rngFrom([0.1, 0.9, 0.3, 0.5]));
    expect(picked).toHaveLength(3);
    // result is a subsequence of the original order
    const positions = picked.map((id) => ids.indexOf(id));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });
  it("is deterministic for a fixed rng", () => {
    const a = selectPool(ids, 2, rngFrom([0.42, 0.13, 0.7]));
    const b = selectPool(ids, 2, rngFrom([0.42, 0.13, 0.7]));
    expect(a).toEqual(b);
  });
});

describe("itemScore", () => {
  it("uses the reported score when present (clamped)", () => {
    expect(itemScore("passed", 0.75)).toBe(0.75);
    expect(itemScore("failed", 0.4)).toBe(0.4); // partial credit on a 'failed' multi-select
    expect(itemScore("passed", 2)).toBe(1);
  });
  it("falls back to 1 for passed / 0 otherwise when score is absent", () => {
    expect(itemScore("passed", undefined)).toBe(1);
    expect(itemScore("failed", undefined)).toBe(0);
    expect(itemScore("completed", undefined)).toBe(0);
  });
});
