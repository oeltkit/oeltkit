// Standalone "web" adapter — graceful no-LMS fallback. Persists to localStorage
// (PLAN §4.1). The only place the web/localStorage backend is touched.

import type { Adapter, Emit, InteractionReport, Outcome } from "../types.js";

interface WebRecord {
  completion?: string;
  success?: string;
  score?: number;
  progress?: number;
  suspend?: string;
  location?: string;
}

export function createWebAdapter(emit: Emit, courseId: string): Adapter {
  const key = `oelt:web:${courseId}`;
  const load = (): WebRecord => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}") as WebRecord;
    } catch {
      return {};
    }
  };
  const record = load();
  const save = (): void => localStorage.setItem(key, JSON.stringify(record));
  const hadPriorState = record.suspend != null || record.location != null;

  return {
    name: "web",

    async start() {
      emit({ type: "info", message: "standalone (localStorage) backend" });
    },

    entry() {
      return hadPriorState ? "resume" : "new";
    },

    getSuspend() {
      return record.suspend ?? "";
    },
    setSuspend(payload) {
      record.suspend = payload;
      save();
      emit({ type: "state", op: "set", key: "suspend", value: payload, bytes: payload.length });
    },

    getLocation() {
      return record.location ?? "";
    },
    setLocation(pageId) {
      record.location = pageId;
      save();
    },

    applyOutcome(o: Outcome) {
      record.completion = o.completion ? "completed" : "incomplete";
      emit({ type: "completion", completed: o.completion, reported: record.completion });
      if (o.success) {
        record.success = o.success;
        emit({ type: "success", success: o.success });
      }
      if (o.score != null) {
        record.score = o.score;
        emit({ type: "score", scaled: o.score });
      }
      if (o.progress != null) {
        record.progress = o.progress;
        emit({ type: "progress", value: o.progress });
      }
      save();
    },

    reportInteraction(r: InteractionReport) {
      emit({ type: "interaction", id: r.id, result: r.result, scaled: r.score ?? null });
    },

    commit() {
      save();
    },

    terminate() {
      save();
      emit({ type: "lifecycle", op: "terminate", adapter: "web" });
    },
  };
}
