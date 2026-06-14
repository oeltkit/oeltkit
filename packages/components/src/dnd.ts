// Shared helpers for the drag-and-drop family (ordering / matching / categorize).
// See specs/components/dnd-family.md. The reusable pieces today are: a live-region
// announcer and the position-fraction grading used by all three. The full
// grab/move/drop controller is currently inlined in <oelt-ordering>; it will be
// lifted here once a second family member (matching) validates the abstraction.

import type { InteractionResult } from "./base.js";

/**
 * Manages a single visually-hidden assertive live region for SR announcements
 * (dnd-family.md §4). Create one per component; call announce() on every state
 * change (pick up / move / drop / cancel).
 */
export class LiveAnnouncer {
  readonly region: HTMLElement;

  constructor() {
    const el = document.createElement("div");
    el.className = "oelt-visually-hidden";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "assertive");
    this.region = el;
  }

  announce(message: string): void {
    // Clear first so identical consecutive messages are still re-announced.
    this.region.textContent = "";
    this.region.textContent = message;
  }
}

export interface PositionGrade {
  result: InteractionResult;
  score: number;
  response: string;
}

/**
 * Grade a "current arrangement vs correct arrangement" task by absolute position
 * (dnd-family.md §7): score = fraction of entries equal to the correct entry at
 * the same index; passed iff every entry matches. `response` = current joined by
 * ",". Both arrays are compared up to the correct length.
 */
export function gradeByPosition(correct: string[], current: string[]): PositionGrade {
  const n = correct.length;
  let matches = 0;
  for (let i = 0; i < n; i++) if (current[i] === correct[i]) matches++;
  const score = n > 0 ? matches / n : 0;
  return {
    result: matches === n ? "passed" : "failed",
    score,
    response: current.join(","),
  };
}

/** Fisher–Yates shuffle (new array). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Shuffle, retrying up to `tries` times to avoid returning the identity order
 * (so an ordering task doesn't start already-solved). Falls back to the last
 * shuffle if every attempt matched (e.g. all elements identical).
 */
export function shuffleDifferent(arr: string[], rng: () => number = Math.random, tries = 5): string[] {
  let out = arr;
  for (let t = 0; t < tries; t++) {
    out = shuffle(arr, rng);
    if (arr.some((v, i) => out[i] !== v)) return out;
  }
  return out;
}
