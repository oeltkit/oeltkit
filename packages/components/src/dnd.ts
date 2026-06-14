// Shared helpers for the drag-and-drop family (ordering / matching / categorize).
// See specs/components/dnd-family.md. Reusable pieces: a live-region announcer,
// the keyboard pick-up/move/drop key dispatcher (GrabController), and the
// position-fraction grading used by all three. Each component implements GrabHost
// with its own data semantics; the key→intent mapping is identical family-wide.

import type { InteractionResult } from "./base.js";

/**
 * Host that owns the actual data mutation for a grab interaction. GrabController
 * maps keyboard events to these intents; the host decides what they mean
 * (reorder a list, reassign a target, …) and clamps out-of-range moves.
 */
export interface GrabHost {
  isGrabbed(): boolean;
  pickUp(index: number): void;
  /** delta -1 = previous (ArrowUp/Left), +1 = next (ArrowDown/Right). */
  move(delta: -1 | 1): void;
  drop(): void;
  cancel(): void;
}

/**
 * Family keyboard model (dnd-family.md §3), shared verbatim by every member:
 * Space/Enter toggles pick-up/drop, arrows move while grabbed, Escape cancels.
 * Both arrow axes are accepted (a member may lay out vertically or horizontally).
 */
export class GrabController {
  constructor(private readonly host: GrabHost) {}

  handleKey(e: KeyboardEvent, index: number): void {
    switch (e.key) {
      case " ":
      case "Enter":
        e.preventDefault();
        if (this.host.isGrabbed()) this.host.drop();
        else this.host.pickUp(index);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        if (this.host.isGrabbed()) {
          e.preventDefault();
          this.host.move(-1);
        }
        break;
      case "ArrowDown":
      case "ArrowRight":
        if (this.host.isGrabbed()) {
          e.preventDefault();
          this.host.move(1);
        }
        break;
      case "Escape":
        if (this.host.isGrabbed()) {
          e.preventDefault();
          this.host.cancel();
        }
        break;
    }
  }
}

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
