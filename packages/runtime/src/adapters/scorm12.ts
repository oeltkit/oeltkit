// SCORM 1.2 content-side adapter. Discovers the LMS `window.API` and speaks the
// SCORM 1.2 data model. This file is the ONLY place SCORM 1.2 calls are made.

import type { Adapter, Emit, InteractionReport, Outcome } from "../types.js";
import { findScormApi } from "./discovery.js";

export function createScorm12Adapter(emit: Emit): Adapter {
  const api = findScormApi("API");
  let interactionIndex = 0;

  const get = (key: string): string => (api ? String(api.LMSGetValue(key) ?? "") : "");
  const set = (key: string, value: string | number): void => {
    api?.LMSSetValue(key, String(value));
  };

  return {
    name: "scorm12",

    async start() {
      if (!api) {
        emit({ type: "info", message: "SCORM 1.2 API not found" });
        return;
      }
      api.LMSInitialize("");
      emit({ type: "lifecycle", op: "initialize", adapter: "scorm12" });
    },

    entry() {
      return get("cmi.core.entry") === "resume" ? "resume" : "new";
    },

    getSuspend() {
      return get("cmi.suspend_data");
    },
    setSuspend(payload) {
      set("cmi.suspend_data", payload);
    },

    getLocation() {
      return get("cmi.core.lesson_location");
    },
    setLocation(pageId) {
      set("cmi.core.lesson_location", pageId);
    },

    applyOutcome(o: Outcome) {
      if (o.score != null) {
        set("cmi.core.score.raw", Math.round(o.score * 100));
        set("cmi.core.score.min", 0);
        set("cmi.core.score.max", 100);
        emit({ type: "score", scaled: o.score });
      }
      // The SCORM 1.2 collapse rule (tracking-semantics.md §4.2): one status
      // field carries success when a score+mastery is defined (success != null),
      // otherwise it carries completion.
      const status = o.success ?? (o.completion ? "completed" : "incomplete");
      set("cmi.core.lesson_status", status);
      emit({ type: "completion", completed: o.completion, reported: status });
      if (o.success) emit({ type: "success", success: o.success });
      // SCORM 1.2 has no progress_measure — progress is intentionally omitted.
    },

    reportInteraction(r: InteractionReport) {
      const n = interactionIndex++;
      set(`cmi.interactions.${n}.id`, r.id);
      if (r.type) set(`cmi.interactions.${n}.type`, r.type);
      set(
        `cmi.interactions.${n}.result`,
        r.result === "passed" ? "correct" : r.result === "failed" ? "wrong" : "neutral",
      );
      emit({ type: "interaction", id: r.id, result: r.result, scaled: r.score ?? null });
    },

    commit() {
      if (!api) return;
      api.LMSCommit("");
      emit({ type: "lifecycle", op: "commit", adapter: "scorm12" });
    },

    terminate() {
      if (!api) return;
      api.LMSCommit("");
      api.LMSFinish("");
      emit({ type: "lifecycle", op: "terminate", adapter: "scorm12" });
    },
  };
}
