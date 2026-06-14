import { describe, it, expect } from "vitest";
import { likertScale } from "./likert-scale.js";

describe("likertScale", () => {
  it("generates N numbered points", () => {
    const s = likertScale(5);
    expect(s.map((p) => p.value)).toEqual(["1", "2", "3", "4", "5"]);
    expect(s.map((p) => p.label)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("folds end anchors into the first and last labels", () => {
    const s = likertScale(5, "Very hard", "Very easy");
    expect(s[0]).toEqual({ value: "1", label: "1 — Very hard" });
    expect(s[4]).toEqual({ value: "5", label: "5 — Very easy" });
    expect(s[2]!.label).toBe("3"); // middle untouched
  });

  it("applies only the anchor that is provided", () => {
    expect(likertScale(3, "Low")[0]!.label).toBe("1 — Low");
    expect(likertScale(3, "Low")[2]!.label).toBe("3");
    expect(likertScale(3, undefined, "High")[2]!.label).toBe("3 — High");
  });

  it("falls back to 5 points for invalid sizes", () => {
    expect(likertScale(1)).toHaveLength(5);
    expect(likertScale(0)).toHaveLength(5);
    expect(likertScale(2.5)).toHaveLength(5);
    expect(likertScale(NaN)).toHaveLength(5);
  });

  it("honors a custom point count", () => {
    expect(likertScale(7)).toHaveLength(7);
  });
});
