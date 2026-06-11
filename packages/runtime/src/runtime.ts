// Runtime wiring: detect the target, build the adapter + tracking engine + state
// store + nav, and expose the public `oelt` API. The author/host calls
// boot(manifest) → start().

import type { CourseManifest, RuntimeEvent, TargetName, InteractionReport } from "./types.js";
import { createAdapter, detectTarget } from "./adapters/detect.js";
import { createTrackingEngine } from "./tracking.js";
import { createNav, type Nav } from "./nav.js";
import { createStateStore, type StateStore } from "./state.js";

export interface BootOptions {
  /** Force a target instead of auto-detecting (mainly for tests). */
  target?: TargetName;
}

export interface OeltRuntime {
  readonly target: TargetName;
  readonly track: {
    complete(): void;
    score(scaled: number): void;
    progress(value: number): void;
    interaction(report: InteractionReport): void;
  };
  readonly state: StateStore;
  readonly nav: Nav;
  /** Subscribe to the semantic event stream. Returns an unsubscribe fn. */
  on(listener: (event: RuntimeEvent) => void): () => void;
  /** Run the launch lifecycle: init adapter, resume, navigate to entry page. */
  start(): Promise<void>;
  terminate(): void;
}

export function boot(manifest: CourseManifest, options: BootOptions = {}): OeltRuntime {
  const listeners = new Set<(event: RuntimeEvent) => void>();
  const emit = (event: RuntimeEvent): void => {
    for (const l of listeners) l(event);
  };

  const target = options.target ?? detectTarget();
  const adapter = createAdapter(target, emit, manifest.id);
  // State must exist before the engine (it rehydrates its resume snapshot from it).
  const state = createStateStore(adapter, emit);
  const engine = createTrackingEngine(manifest, adapter, state);
  const nav = createNav(manifest, engine, adapter, emit);

  let started = false;

  const runtime: OeltRuntime = {
    target,
    track: {
      complete: () => engine.complete(),
      score: (scaled) => engine.score(scaled),
      progress: (value) => engine.progress(value),
      interaction: (report) => engine.recordInteraction(report),
    },
    state,
    nav,
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (started) return;
      started = true;
      await adapter.start();
      // Suspend is only readable after the adapter is initialized.
      state.hydrate();
      engine.hydrate();
      // Resume to the saved page if any, else start at the first page.
      const savedId = adapter.getLocation();
      const resumeIndex = savedId ? nav.pages.findIndex((p) => p.id === savedId) : -1;
      nav.go(resumeIndex >= 0 ? resumeIndex : 0);
    },
    terminate() {
      adapter.terminate();
    },
  };

  return runtime;
}
