// Suspend-state budget registry. Each component's spec declares a max state size
// (its §"State" section); this registry mirrors those numbers as machine-checked
// values. base.md §4: the sum across the inventory plus runtime overhead MUST
// stay ≤ 3 KB (SCORM 1.2's 4 KB suspend_data, minus headroom). state-budget.test.ts
// fails the build if the inventory over-subscribes the budget.
//
// MAINTENANCE: adding a new <oelt-*> component requires adding its declared max
// state here, matching the number in its spec's State section.

export const STATE_BUDGET_BYTES: Readonly<Record<string, number>> = {
  "oelt-mcq": 64, // mcq.md §8
  "oelt-branching": 256, // branching.md §8
  "oelt-media": 48, // media.md §9
  "oelt-text-entry": 256, // text-entry.md §8
  "oelt-quiz": 512, // quiz.md §8
  "oelt-likert": 48, // likert.md §8
};

/** Total suspend budget (bytes). 3 KB leaves ~1 KB headroom under SCORM 1.2's 4 KB. */
export const SUSPEND_BUDGET_LIMIT = 3072;

/** Sum of every component's declared max state size. */
export function totalDeclaredState(): number {
  return Object.values(STATE_BUDGET_BYTES).reduce((sum, n) => sum + n, 0);
}
