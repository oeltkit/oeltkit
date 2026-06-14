import { describe, it, expect } from "vitest";
import { gradeMatching, type Pair } from "./matching-grade.js";

const pairs: Pair[] = [
  { prompt: "France", value: "paris" },
  { prompt: "Japan", value: "tokyo" },
  { prompt: "Egypt", value: "cairo" },
];

describe("gradeMatching", () => {
  it("passes when every value is on its correct prompt", () => {
    const g = gradeMatching(pairs, { paris: "France", tokyo: "Japan", cairo: "Egypt" });
    expect(g.result).toBe("passed");
    expect(g.score).toBe(1);
    expect(g.response).toBe("France=paris,Japan=tokyo,Egypt=cairo");
  });

  it("scores the fraction of correct targets", () => {
    // paris✓ tokyo→Egypt✗ Japan empty → 1/3
    const g = gradeMatching(pairs, { paris: "France", tokyo: "Egypt" });
    expect(g.result).toBe("failed");
    expect(g.score).toBeCloseTo(1 / 3);
    expect(g.response).toBe("France=paris,Japan=,Egypt=tokyo");
  });

  it("scores 0 when all placements are wrong", () => {
    const g = gradeMatching(pairs, { paris: "Japan", tokyo: "Egypt", cairo: "France" });
    expect(g.score).toBe(0);
  });

  it("treats nothing-placed as all-empty (score 0)", () => {
    const g = gradeMatching(pairs, {});
    expect(g.score).toBe(0);
    expect(g.response).toBe("France=,Japan=,Egypt=");
  });
});
