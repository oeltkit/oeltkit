import { describe, it, expect } from "vitest";
import { gradeByPosition, shuffle, shuffleDifferent } from "./dnd.js";

describe("gradeByPosition", () => {
  const correct = ["a", "b", "c", "d"];

  it("passes on an exact match with full score", () => {
    expect(gradeByPosition(correct, ["a", "b", "c", "d"])).toEqual({
      result: "passed",
      score: 1,
      response: "a,b,c,d",
    });
  });

  it("scores the fraction in the correct position", () => {
    // a✓ b✗ c✗ d✓  → 2/4
    const g = gradeByPosition(correct, ["a", "c", "b", "d"]);
    expect(g.result).toBe("failed");
    expect(g.score).toBe(0.5);
    expect(g.response).toBe("a,c,b,d");
  });

  it("scores 0 when nothing is in place (even-length full reverse)", () => {
    // d≠a, c≠b, b≠c, a≠d → 0 matches
    expect(gradeByPosition(correct, ["d", "c", "b", "a"]).score).toBe(0);
  });

  it("handles a fully-reversed odd-length list", () => {
    expect(gradeByPosition(["a", "b", "c"], ["c", "b", "a"]).score).toBeCloseTo(1 / 3);
  });

  it("empty correct → score 0, passed (vacuous)", () => {
    expect(gradeByPosition([], []).score).toBe(0);
  });
});

describe("shuffle", () => {
  it("returns a permutation (same multiset) and does not mutate input", () => {
    const input = ["a", "b", "c", "d", "e"];
    const out = shuffle(input, seq([0.1, 0.5, 0.9, 0.2, 0.7]));
    expect([...out].sort()).toEqual([...input].sort());
    expect(input).toEqual(["a", "b", "c", "d", "e"]); // unmutated
  });
});

describe("shuffleDifferent", () => {
  it("avoids returning the identity order when possible", () => {
    // rng=0.1 → low j indices → real swaps → non-identity on the first try.
    const out = shuffleDifferent(["a", "b", "c"], seq([0.1, 0.1, 0.1]));
    expect(out).not.toEqual(["a", "b", "c"]);
    expect([...out].sort()).toEqual(["a", "b", "c"]);
  });

  it("falls back gracefully when all elements are identical", () => {
    expect(shuffleDifferent(["x", "x", "x"])).toEqual(["x", "x", "x"]);
  });
});

// Deterministic rng cycling through a fixed sequence.
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}
