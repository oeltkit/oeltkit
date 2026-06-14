import { describe, it, expect } from "vitest";
import { gradeText, gradeNumeric, normalizeText, parseAnswers } from "./grade-text.js";

describe("normalizeText", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeText("  hello   world  ", false)).toBe("hello world");
  });
  it("lowercases unless case-sensitive", () => {
    expect(normalizeText("Paris", false)).toBe("paris");
    expect(normalizeText("Paris", true)).toBe("Paris");
  });
});

describe("parseAnswers", () => {
  it("splits pipe-separated answers and trims them", () => {
    expect(parseAnswers("grey | gray")).toEqual(["grey", "gray"]);
  });
  it("drops empty segments", () => {
    expect(parseAnswers("a||b|")).toEqual(["a", "b"]);
  });
});

describe("gradeText (text mode)", () => {
  it("passes on a normalized match (case-insensitive, whitespace)", () => {
    const g = gradeText(["Paris"], "  paris ", false);
    expect(g).toEqual({ result: "passed", score: 1, response: "  paris " });
  });
  it("fails when no accepted answer matches", () => {
    expect(gradeText(["Paris"], "London", false).result).toBe("failed");
    expect(gradeText(["Paris"], "London", false).score).toBe(0);
  });
  it("respects case-sensitivity when requested", () => {
    expect(gradeText(["Paris"], "paris", true).result).toBe("failed");
    expect(gradeText(["Paris"], "Paris", true).result).toBe("passed");
  });
  it("accepts any of multiple alternatives", () => {
    expect(gradeText(["grey", "gray"], "GRAY", false).result).toBe("passed");
  });
  it("preserves the raw response verbatim", () => {
    expect(gradeText(["x"], "  X ", false).response).toBe("  X ");
  });
});

describe("gradeNumeric (numeric mode)", () => {
  it("passes symmetrically at the tolerance boundary (float-safe)", () => {
    // Both are exactly 0.01 away from 3.14; without epsilon, 3.13 lands just over
    // 0.01 in float and would wrongly fail. The grader must treat them the same.
    expect(gradeNumeric(3.14, 0.01, "3.15").result).toBe("passed");
    expect(gradeNumeric(3.14, 0.01, "3.13").result).toBe("passed");
  });
  it("fails outside tolerance", () => {
    expect(gradeNumeric(3.14, 0.01, "3.2").result).toBe("failed");
    expect(gradeNumeric(3.14, 0.01, "3.16").result).toBe("failed");
  });
  it("exact match with zero tolerance", () => {
    expect(gradeNumeric(42, 0, "42").result).toBe("passed");
    expect(gradeNumeric(42, 0, "43").result).toBe("failed");
  });
  it("non-numeric input fails", () => {
    expect(gradeNumeric(42, 0, "forty-two").result).toBe("failed");
    expect(gradeNumeric(42, 0, "forty-two").score).toBe(0);
  });
  it("empty / whitespace input fails", () => {
    expect(gradeNumeric(42, 5, "   ").result).toBe("failed");
  });
  it("handles negative numbers and tolerance", () => {
    expect(gradeNumeric(-5, 0.5, "-5.4").result).toBe("passed");
    expect(gradeNumeric(-5, 0.5, "-4.4").result).toBe("failed");
  });
});
