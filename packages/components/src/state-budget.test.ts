import { describe, it, expect } from "vitest";
import { STATE_BUDGET_BYTES, SUSPEND_BUDGET_LIMIT, totalDeclaredState } from "./state-budget.js";

describe("suspend-state budget (base.md §4)", () => {
  it("the full component inventory fits within the 3 KB budget", () => {
    expect(totalDeclaredState()).toBeLessThanOrEqual(SUSPEND_BUDGET_LIMIT);
  });

  it("every declared size is a positive integer number of bytes", () => {
    for (const [name, bytes] of Object.entries(STATE_BUDGET_BYTES)) {
      expect(Number.isInteger(bytes), `${name} size must be an integer`).toBe(true);
      expect(bytes, `${name} size must be > 0`).toBeGreaterThan(0);
    }
  });

  it("includes every Batch-A-and-earlier component", () => {
    // Guards against adding a component without registering its budget.
    for (const name of [
      "oelt-mcq",
      "oelt-branching",
      "oelt-media",
      "oelt-text-entry",
      "oelt-quiz",
      "oelt-likert",
      "oelt-ordering",
    ]) {
      expect(STATE_BUDGET_BYTES[name], `missing budget entry for ${name}`).toBeDefined();
    }
  });
});
