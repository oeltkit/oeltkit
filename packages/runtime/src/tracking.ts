// Tracking rules engine. Implements the closed rule vocabulary from
// specs/tracking-semantics.md and computes a normalized Outcome that the active
// adapter maps onto its target. This engine never touches a host API — it only
// calls adapter.applyOutcome / reportInteraction (DoD: no API calls outside
// adapters/).

import type {
  Adapter,
  CourseManifest,
  InteractionReport,
  InteractionResult,
  Outcome,
  CompletionRuleName,
  ScoreRuleName,
  ProgressRuleName,
} from "./types.js";
import type { StateStore } from "./state.js";

const SNAPSHOT_KEY = "__track";

interface Snapshot {
  v: string[]; // viewed page ids
  i: Record<string, [InteractionResult, number | null]>; // interaction results
  m: boolean; // manual complete
  s: number | null; // explicit score
  p: number | null; // explicit progress
}

interface ResolvedRules {
  completion: CompletionRuleName;
  threshold: number | undefined;
  score: ScoreRuleName;
  scoreSource: string | undefined;
  mastery: number | undefined;
  progress: ProgressRuleName;
}

export interface TrackingEngine {
  /** Restore prior tracking state from the resume snapshot (after state.hydrate). */
  hydrate(): void;
  recordPageView(pageId: string): void;
  recordInteraction(report: InteractionReport): void;
  complete(): void;
  score(scaled: number): void;
  progress(value: number): void;
  /** Recompute and report the current outcome. */
  evaluate(): Outcome;
}

export function createTrackingEngine(
  manifest: CourseManifest,
  adapter: Adapter,
  state: StateStore,
): TrackingEngine {
  // Resolve rules with the zero-config defaults (tracking-semantics.md §3).
  const t = manifest.tracking ?? {};
  const rules: ResolvedRules = {
    completion: t.completion?.rule ?? "all-pages-viewed",
    threshold: t.completion?.threshold,
    score: t.score?.rule ?? "none",
    scoreSource: t.score?.source,
    mastery: t.score?.mastery,
    progress: t.progress?.rule ?? "pages-viewed",
  };

  const allPages = manifest.structure.flatMap((m) => m.pages);
  const totalPages = allPages.length;
  const requiredIds = allPages
    .flatMap((p) => p.interactions ?? [])
    .filter((i) => i.required)
    .map((i) => i.id);
  const weightOf = new Map<string, number>();
  for (const p of allPages) for (const i of p.interactions ?? []) weightOf.set(i.id, i.weight ?? 1);

  const viewed = new Set<string>();
  const interactions = new Map<string, { result: InteractionResult; score: number | null }>();
  let manualComplete = false;
  let explicitScore: number | null = null;
  let explicitProgress: number | null = null;

  function persist(): void {
    const snapshot: Snapshot = {
      v: [...viewed],
      i: Object.fromEntries([...interactions].map(([id, r]) => [id, [r.result, r.score]])),
      m: manualComplete,
      s: explicitScore,
      p: explicitProgress,
    };
    state.setReserved(SNAPSHOT_KEY, snapshot);
  }

  const isCompleted = (id: string): boolean => {
    const r = interactions.get(id);
    return r != null; // any recorded result counts as "completed"
  };
  const isPassed = (id: string): boolean => interactions.get(id)?.result === "passed";

  function computeCompletion(): boolean {
    if (manualComplete) return true;
    switch (rules.completion) {
      case "all-pages-viewed":
        return totalPages > 0 && viewed.size >= totalPages;
      case "pages-viewed":
        return viewed.size >= Math.ceil((rules.threshold ?? 1) * totalPages);
      case "required-interactions-completed":
        return requiredIds.every(isCompleted);
      case "required-interactions-passed":
        return requiredIds.every(isPassed);
      case "manual":
        return false; // only track.complete() flips manualComplete
    }
  }

  function computeScore(): number | null {
    if (explicitScore != null) return explicitScore;
    switch (rules.score) {
      case "none":
        return null;
      case "single-interaction":
        return rules.scoreSource ? (interactions.get(rules.scoreSource)?.score ?? null) : null;
      case "weighted-interactions": {
        let weightSum = 0;
        let acc = 0;
        for (const [id, rec] of interactions) {
          if (rec.score == null) continue;
          const w = weightOf.get(id) ?? 1;
          weightSum += w;
          acc += w * rec.score;
        }
        return weightSum > 0 ? acc / weightSum : null;
      }
    }
  }

  function computeProgress(): number | null {
    if (explicitProgress != null) return explicitProgress;
    if (rules.progress === "none") return null;
    return totalPages > 0 ? viewed.size / totalPages : 0;
  }

  function evaluate(): Outcome {
    const completion = computeCompletion();
    const score = computeScore();
    // success is non-null exactly when a score and mastery are both defined —
    // this is what drives the SCORM 1.2 collapse in the scorm12 adapter.
    const success: Outcome["success"] =
      score != null && rules.mastery != null
        ? score >= rules.mastery
          ? "passed"
          : "failed"
        : null;
    const outcome: Outcome = { completion, success, score, progress: computeProgress() };
    adapter.applyOutcome(outcome);
    return outcome;
  }

  // Each mutation: update state, evaluate (which writes status/score to the
  // adapter), then persist the snapshot — whose commit also flushes the values
  // just written. Order matters: evaluate before persist.
  return {
    hydrate() {
      // Rehydrate from the resume snapshot so re-evaluation after resume
      // reproduces the prior outcome rather than downgrading the LMS's status.
      const snap = state.getReserved(SNAPSHOT_KEY) as Snapshot | undefined;
      if (!snap) return;
      for (const id of snap.v) viewed.add(id);
      for (const [id, [result, score]] of Object.entries(snap.i))
        interactions.set(id, { result, score });
      manualComplete = snap.m;
      explicitScore = snap.s;
      explicitProgress = snap.p;
    },
    recordPageView(pageId) {
      viewed.add(pageId);
      evaluate();
      persist();
    },
    recordInteraction(report) {
      interactions.set(report.id, { result: report.result, score: report.score ?? null });
      adapter.reportInteraction(report);
      evaluate();
      persist();
    },
    complete() {
      manualComplete = true;
      evaluate();
      persist();
    },
    score(scaled) {
      explicitScore = scaled;
      evaluate();
      persist();
    },
    progress(value) {
      explicitProgress = value;
      evaluate();
      persist();
    },
    evaluate,
  };
}
