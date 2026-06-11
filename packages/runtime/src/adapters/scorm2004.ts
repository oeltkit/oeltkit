// SCORM 2004 content-side adapter. Discovers `window.API_1484_11`. Unlike 1.2,
// completion and success are reported on SEPARATE channels (no collapse), and
// progress_measure exists. Only place SCORM 2004 calls are made.

import type { Adapter, Emit, InteractionReport, Outcome } from "../types.js";
import { findScormApi } from "./discovery.js";

export function createScorm2004Adapter(emit: Emit): Adapter {
  const api = findScormApi("API_1484_11");
  let interactionIndex = 0;

  const get = (key: string): string => (api ? String(api.GetValue(key) ?? "") : "");
  const set = (key: string, value: string | number): void => {
    api?.SetValue(key, String(value));
  };

  return {
    name: "scorm2004",

    async start() {
      if (!api) {
        emit({ type: "info", message: "SCORM 2004 API not found" });
        return;
      }
      api.Initialize("");
      emit({ type: "lifecycle", op: "initialize", adapter: "scorm2004" });
    },

    entry() {
      return get("cmi.entry") === "resume" ? "resume" : "new";
    },

    getSuspend() {
      return get("cmi.suspend_data");
    },
    setSuspend(payload) {
      set("cmi.suspend_data", payload);
    },

    getLocation() {
      return get("cmi.location");
    },
    setLocation(pageId) {
      set("cmi.location", pageId);
    },

    applyOutcome(o: Outcome) {
      if (o.score != null) {
        set("cmi.score.scaled", o.score);
        set("cmi.score.raw", Math.round(o.score * 100));
        set("cmi.score.min", 0);
        set("cmi.score.max", 100);
        emit({ type: "score", scaled: o.score });
      }
      const completion = o.completion ? "completed" : "incomplete";
      set("cmi.completion_status", completion);
      emit({ type: "completion", completed: o.completion, reported: completion });
      if (o.success) {
        set("cmi.success_status", o.success);
        emit({ type: "success", success: o.success });
      }
      if (o.progress != null) {
        set("cmi.progress_measure", o.progress);
        emit({ type: "progress", value: o.progress });
      }
    },

    reportInteraction(r: InteractionReport) {
      const n = interactionIndex++;
      set(`cmi.interactions.${n}.id`, r.id);
      if (r.type) set(`cmi.interactions.${n}.type`, r.type);
      set(
        `cmi.interactions.${n}.result`,
        r.result === "passed" ? "correct" : r.result === "failed" ? "incorrect" : "neutral",
      );
      emit({ type: "interaction", id: r.id, result: r.result, scaled: r.score ?? null });
    },

    commit() {
      if (!api) return;
      api.Commit("");
      emit({ type: "lifecycle", op: "commit", adapter: "scorm2004" });
    },

    terminate() {
      if (!api) return;
      api.Commit("");
      api.Terminate("");
      emit({ type: "lifecycle", op: "terminate", adapter: "scorm2004" });
    },
  };
}
