// cmi5 content-side (AU) adapter — built on @xapi/cmi5 (OQ-004). The hand-written
// client produced statements SCORM Cloud's LRS rejected (400/403); @xapi/cmi5 is
// a fully spec-conformant cmi5 Profile implementation. It is the one place
// cmi5/xAPI calls are made. Suspend/location resume uses the xAPI State API via
// the library's underlying connection.
//   §8.1 launch params · §8.2 auth-token · §9.3 verbs · §10 State.

import Cmi5 from "@xapi/cmi5";
import type { Adapter, Emit, InteractionReport, Outcome } from "../types.js";

const SUSPEND_STATE_ID = "suspendData";
const LOCATION_STATE_ID = "oelt.location";

export function createCmi5Adapter(emit: Emit): Adapter {
  const cmi5 = new Cmi5(); // reads the cmi5 launch parameters from the URL (§8.1)
  const lp = cmi5.getLaunchParameters();
  let suspendCache = "";
  let locationCache = "";
  const sent = new Set<string>(); // cmi5 send-once verbs

  // Serialize statement sends so they reach the LRS IN ORDER. cmi5 requires
  // completed before passed/failed before terminated; firing them concurrently
  // lets an out-of-order `passed` get dropped (SCORM Cloud, OQ-004 — the pass
  // scenario, which sends completed+passed, failed while the single-statement
  // fail scenario succeeded).
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = (fn: () => Promise<unknown>): void => {
    chain = chain.then(fn).catch(() => {});
  };

  const stateParams = (stateId: string) => ({
    agent: lp.actor,
    activityId: lp.activityId,
    stateId,
    registration: lp.registration,
  });

  return {
    name: "cmi5",

    async start() {
      // §8.2 auth-token fetch + §9.3.2 initialized (MUST be first), and reads
      // LMS.LaunchData (§10.2) — all handled by the library.
      await cmi5.initialize();
      emit({ type: "lifecycle", op: "initialize", adapter: "cmi5" });
      emit({ type: "statement", verb: "initialized", scaled: null });
      // Hydrate resume caches from the xAPI State API (best-effort).
      try {
        const s = await cmi5.xapi!.getState(stateParams(SUSPEND_STATE_ID));
        suspendCache = (s.data as { suspendData?: string })?.suspendData ?? "";
      } catch {
        /* no prior suspend state */
      }
      try {
        const l = await cmi5.xapi!.getState(stateParams(LOCATION_STATE_ID));
        locationCache = (l.data as { location?: string })?.location ?? "";
      } catch {
        /* no prior location */
      }
    },

    entry() {
      return suspendCache || locationCache ? "resume" : "new";
    },

    getSuspend() {
      return suspendCache;
    },
    setSuspend(payload) {
      suspendCache = payload;
      void cmi5.xapi!.setState({
        ...stateParams(SUSPEND_STATE_ID),
        state: { suspendData: payload },
      });
      emit({ type: "state", op: "set", key: "suspendData", value: payload, bytes: payload.length });
    },

    getLocation() {
      return locationCache;
    },
    setLocation(pageId) {
      locationCache = pageId;
      void cmi5.xapi!.setState({ ...stateParams(LOCATION_STATE_ID), state: { location: pageId } });
    },

    applyOutcome(o: Outcome) {
      // cmi5 send-once, in order: completed → passed/failed (§9.3.3–9.3.5).
      if (o.completion && !sent.has("completed")) {
        sent.add("completed");
        enqueue(() => cmi5.complete());
        emit({ type: "statement", verb: "completed", scaled: o.score ?? null });
      }
      if (o.success && !sent.has(o.success)) {
        const score = o.score ?? undefined;
        sent.add(o.success);
        enqueue(() => (o.success === "passed" ? cmi5.pass(score) : cmi5.fail(score)));
        emit({ type: "statement", verb: o.success, scaled: o.score ?? null });
      }
    },

    reportInteraction(r: InteractionReport) {
      // Item-level analytics are emitted to the harness panel; the cmi5 outcome
      // statements (above) carry conformance. (Per-interaction xAPI statements
      // can be added via cmi5.interaction* later if needed.)
      emit({ type: "interaction", id: r.id, result: r.result, scaled: r.score ?? null });
    },

    commit() {
      // Statements + State are sent eagerly by the library; nothing to flush.
    },

    terminate() {
      if (sent.has("terminated")) return;
      sent.add("terminated");
      enqueue(() => cmi5.terminate()); // §9.3.8 — MUST be last
      emit({ type: "lifecycle", op: "terminate", adapter: "cmi5" });
      emit({ type: "statement", verb: "terminated", scaled: null });
    },
  };
}
