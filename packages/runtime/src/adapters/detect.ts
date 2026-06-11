// Launch-context auto-detection. Identical content runs on every target; the
// runtime picks the adapter from the environment the LMS provides.

import type { Adapter, Emit, TargetName } from "../types.js";
import { findScormApi } from "./discovery.js";
import { createScorm12Adapter } from "./scorm12.js";
import { createScorm2004Adapter } from "./scorm2004.js";
import { createCmi5Adapter } from "./cmi5.js";
import { createWebAdapter } from "./web.js";

/** Detect the delivery target from the launch context. */
export function detectTarget(): TargetName {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search);
    // cmi5: launched with the spec's query parameters (§8.1) — no window.API.
    if (q.get("fetch") && q.get("endpoint") && q.get("registration")) return "cmi5";
    // SCORM: the LMS placed an API handle on a containing window.
    if (findScormApi("API_1484_11")) return "scorm2004";
    if (findScormApi("API")) return "scorm12";
  }
  return "web";
}

export function createAdapter(target: TargetName, emit: Emit, courseId: string): Adapter {
  switch (target) {
    case "scorm12":
      return createScorm12Adapter(emit);
    case "scorm2004":
      return createScorm2004Adapter(emit);
    case "cmi5":
      return createCmi5Adapter(emit);
    case "web":
      return createWebAdapter(emit, courseId);
  }
}
