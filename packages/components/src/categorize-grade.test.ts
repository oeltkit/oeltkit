import { describe, it, expect } from "vitest";
import { gradeCategorize, type Token } from "./categorize-grade.js";

const tokens: Token[] = [
  { value: "dog", bucket: "mammals" },
  { value: "eagle", bucket: "birds" },
  { value: "cat", bucket: "mammals" },
];

describe("gradeCategorize", () => {
  it("passes when every token is in its correct bucket", () => {
    const g = gradeCategorize(tokens, { dog: "mammals", eagle: "birds", cat: "mammals" });
    expect(g.result).toBe("passed");
    expect(g.score).toBe(1);
    expect(g.response).toBe("dog=mammals,eagle=birds,cat=mammals");
  });

  it("scores the fraction correctly placed (membership, many per bucket)", () => {
    // dog✓ eagle→mammals✗ cat✓ → 2/3
    const g = gradeCategorize(tokens, { dog: "mammals", eagle: "mammals", cat: "mammals" });
    expect(g.result).toBe("failed");
    expect(g.score).toBeCloseTo(2 / 3);
  });

  it("unplaced tokens count as wrong", () => {
    const g = gradeCategorize(tokens, { dog: "mammals" });
    expect(g.score).toBeCloseTo(1 / 3);
    expect(g.response).toBe("dog=mammals,eagle=,cat=");
  });

  it("scores 0 when nothing is placed", () => {
    expect(gradeCategorize(tokens, {}).score).toBe(0);
  });
});
