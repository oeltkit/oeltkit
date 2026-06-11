// Shared types for @oeltkit/runtime. Manifest shapes mirror
// specs/manifest-v0.md; tracking shapes mirror specs/tracking-semantics.md.

export type TargetName = "scorm12" | "scorm2004" | "cmi5" | "web";

export type CompletionRuleName =
  | "all-pages-viewed"
  | "pages-viewed"
  | "required-interactions-completed"
  | "required-interactions-passed"
  | "manual";

export type ScoreRuleName = "none" | "single-interaction" | "weighted-interactions";
export type ProgressRuleName = "none" | "pages-viewed";

export interface CompletionRule {
  rule: CompletionRuleName;
  threshold?: number;
}
export interface ScoreRule {
  rule: ScoreRuleName;
  source?: string;
  mastery?: number;
}
export interface ProgressRule {
  rule: ProgressRuleName;
}
export interface Tracking {
  completion?: CompletionRule;
  score?: ScoreRule;
  progress?: ProgressRule;
}

export interface InteractionDecl {
  id: string;
  type: string;
  weight?: number;
  required?: boolean;
}
export interface Page {
  id: string;
  title: string;
  src: string;
  interactions?: InteractionDecl[];
}
export interface Module {
  id: string;
  title: string;
  pages: Page[];
}
export interface CourseManifest {
  oelt: string;
  id: string;
  title: string;
  lang: string;
  targets: TargetName[];
  theme?: string;
  tracking?: Tracking;
  structure: Module[];
}

/** Result of an interaction reported by the author/component. 0–1 score. */
export type InteractionResult = "passed" | "failed" | "completed";
export interface InteractionReport {
  id: string;
  type?: string;
  result: InteractionResult;
  score?: number;
}

/**
 * Normalized tracking outcome computed by the rules engine and handed to an
 * adapter to map onto its target. The SCORM 1.2 collapse rule
 * (tracking-semantics.md §4.2) is expressed by `success`: it is non-null
 * exactly when a score rule + mastery are defined, so the scorm12 adapter can
 * collapse `success ?? completion` into the single lesson_status field.
 */
export interface Outcome {
  completion: boolean;
  success: "passed" | "failed" | null;
  score: number | null; // 0–1 scaled, or null when not reported
  progress: number | null; // 0–1, or null when not reported
}

/** Runtime event bus payloads (the semantic event stream, PLAN §4.1). */
export type RuntimeEvent =
  | { type: "page-change"; index: number; pageId: string }
  | { type: "lifecycle"; op: "initialize" | "commit" | "terminate"; adapter: TargetName }
  | { type: "completion"; completed: boolean; reported: string }
  | { type: "success"; success: "passed" | "failed" }
  | { type: "score"; scaled: number }
  | { type: "progress"; value: number }
  | { type: "interaction"; id: string; result: InteractionResult; scaled: number | null }
  | { type: "statement"; verb: string; scaled: number | null }
  | { type: "state"; op: "set"; key: string; value: string; bytes: number }
  | { type: "info"; message: string };

export type Emit = (event: RuntimeEvent) => void;

/** Content-side target adapter. The ONLY place that touches a host LMS API. */
export interface Adapter {
  readonly name: TargetName;
  /** Initialize the session (discover API / fetch token) and read resume info. */
  start(): Promise<void>;
  entry(): "resume" | "new";
  getSuspend(): string;
  setSuspend(payload: string): void;
  getLocation(): string;
  setLocation(pageId: string): void;
  applyOutcome(outcome: Outcome): void;
  reportInteraction(report: InteractionReport): void;
  commit(): void;
  terminate(): void;
}
