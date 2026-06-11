import { describe, it, expect } from "vitest";
import { grade } from "./grade.js";

describe("grade — single", () => {
  it("passes on the correct option", () => {
    expect(grade("single", ["b"], ["b"])).toEqual({ result: "passed", score: 1, response: "b" });
  });
  it("fails on a wrong option", () => {
    expect(grade("single", ["b"], ["a"])).toMatchObject({ result: "failed", score: 0 });
  });
});

describe("grade — multiple", () => {
  it("passes only on the exact set", () => {
    expect(grade("multiple", ["a", "c"], ["a", "c"])).toMatchObject({ result: "passed", score: 1 });
  });
  it("fails when an extra wrong option is selected, with partial score", () => {
    const g = grade("multiple", ["a", "c"], ["a", "c", "b"]); // 2 correct − 1 wrong
    expect(g.result).toBe("failed");
    expect(g.score).toBeCloseTo(0.5);
  });
  it("clamps score to 0", () => {
    expect(grade("multiple", ["a"], ["b", "c"]).score).toBe(0);
  });
});
