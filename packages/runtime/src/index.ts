/**
 * @oeltkit/runtime — public entry point.
 *
 * Usage in a course (host or packaged page):
 *   const rt = oelt.boot(manifest);   // construct (no side effects yet)
 *   rt.on(evt => ...);                // optional: observe the event stream
 *   await rt.start();                 // run the launch lifecycle
 * After boot(), the running instance's track/state/nav are also attached to the
 * global `oelt` so author markup can call e.g. `oelt.track.interaction({...})`.
 */

import { boot as bootRuntime, type OeltRuntime, type BootOptions } from "./runtime.js";
import type { CourseManifest } from "./types.js";

export * from "./types.js";
export { QuotaExceededError, SUSPEND_BUDGET_BYTES } from "./state.js";
export type { OeltRuntime, BootOptions } from "./runtime.js";
export { detectTarget } from "./adapters/detect.js";

/** Manifest schema major.minor this runtime build targets. */
export const MANIFEST_VERSION = "0.1";
/** Package version placeholder; real version is injected at publish time. */
export const VERSION = "0.0.0";

/** Construct the runtime and attach the instance to the global `oelt`. */
export function boot(manifest: CourseManifest, options?: BootOptions): OeltRuntime {
  const rt = bootRuntime(manifest, options);
  const g = globalThis as unknown as { oelt?: Record<string, unknown> };
  if (g.oelt) {
    g.oelt.track = rt.track;
    g.oelt.state = rt.state;
    g.oelt.nav = rt.nav;
    g.oelt.terminate = rt.terminate.bind(rt);
    g.oelt.target = rt.target;
  }
  return rt;
}
