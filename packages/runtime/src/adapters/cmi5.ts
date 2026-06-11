// cmi5 content-side (AU) adapter — a minimal, dependency-free client conformant
// to the cmi5 spec (AICC/CMI-5_Spec_Current). See specs/OPEN-QUESTIONS.md OQ-001
// for why this is hand-written rather than wrapping @xapi/cmi5.
//   §8.1 launch params · §8.2 auth-token fetch · §10.2 LMS.LaunchData ·
//   §9.3 verbs · §9.6.2 contextTemplate merge (incl. cmi5 category activity).
// Only place cmi5/xAPI calls are made.

import type { Adapter, Emit, InteractionReport, Outcome } from "../types.js";

const VERB_IRI: Record<string, string> = {
  initialized: "http://adlnet.gov/expapi/verbs/initialized", // §9.3.2
  completed: "http://adlnet.gov/expapi/verbs/completed", // §9.3.3
  passed: "http://adlnet.gov/expapi/verbs/passed", // §9.3.4
  failed: "http://adlnet.gov/expapi/verbs/failed", // §9.3.5
  terminated: "http://adlnet.gov/expapi/verbs/terminated", // §9.3.8
  answered: "http://adlnet.gov/expapi/verbs/answered", // ADL (interactions)
};

interface LaunchParams {
  endpoint: string;
  fetchUrl: string;
  actor: unknown;
  registration: string;
  activityId: string;
}

interface LaunchData {
  contextTemplate?: Record<string, unknown>;
  launchMode?: string;
  moveOn?: string;
  masteryScore?: number;
}

function readLaunchParams(): LaunchParams {
  const q = new URLSearchParams(window.location.search);
  return {
    endpoint: q.get("endpoint") ?? "",
    fetchUrl: q.get("fetch") ?? "",
    actor: q.get("actor") ? JSON.parse(q.get("actor")!) : null,
    registration: q.get("registration") ?? "",
    activityId: q.get("activityId") ?? "",
  };
}

export function createCmi5Adapter(emit: Emit): Adapter {
  const p = readLaunchParams();
  let token = "";
  let launchData: LaunchData = {};
  let suspendCache = "";
  let locationCache = "";
  const sent = new Set<string>(); // verbs already sent (cmi5 send-once)

  // Serialize all writes (statements + State) so they are delivered in order —
  // cmi5 requires initialized first and terminated last, and out-of-order PUTs
  // to the State API would corrupt resume.
  let net: Promise<unknown> = Promise.resolve();
  const enqueue = (fn: () => Promise<unknown>): void => {
    net = net.then(fn).catch(() => {});
  };

  const auth = (): Record<string, string> => ({
    Authorization: `Basic ${token}`,
    "X-Experience-API-Version": "1.0.3",
    "content-type": "application/json",
  });
  const withReg = (url: string): string =>
    `${url}${url.includes("?") ? "&" : "?"}registration=${encodeURIComponent(p.registration)}`;
  const stateUrl = (stateId: string): string =>
    withReg(
      `${p.endpoint}activities/state?stateId=${encodeURIComponent(stateId)}&activityId=${encodeURIComponent(p.activityId)}`,
    );

  function buildContext(): Record<string, unknown> {
    return { registration: p.registration, ...structuredClone(launchData.contextTemplate ?? {}) };
  }

  function send(verb: string, result?: Record<string, unknown>): void {
    const statement: Record<string, unknown> = {
      actor: p.actor,
      verb: { id: VERB_IRI[verb], display: { "en-US": verb } },
      object: { id: p.activityId, objectType: "Activity" },
      context: buildContext(),
      timestamp: new Date().toISOString(),
    };
    if (result) statement.result = result;
    enqueue(() =>
      fetch(withReg(`${p.endpoint}statements`), {
        method: "POST",
        headers: auth(),
        body: JSON.stringify(statement),
      }),
    );
    const scaled =
      result && typeof result.score === "object" && result.score
        ? ((result.score as { scaled?: number }).scaled ?? null)
        : null;
    emit({ type: "statement", verb, scaled });
  }

  return {
    name: "cmi5",

    async start() {
      // §8.2 — fetch the auth token once.
      const r = await fetch(p.fetchUrl, { method: "POST" });
      token = (await r.json())["auth-token"];
      emit({ type: "info", message: "cmi5 auth-token received" });
      // §10.2 — read LMS.LaunchData.
      const ld = await fetch(stateUrl("LMS.LaunchData"), { headers: auth() });
      launchData = await ld.json();
      emit({
        type: "info",
        message: `LMS.LaunchData launchMode=${launchData.launchMode} moveOn=${launchData.moveOn}`,
      });
      // Hydrate resume caches from the State API.
      try {
        const s = await fetch(stateUrl("suspendData"), { headers: auth() });
        if (s.ok) suspendCache = (await s.json())?.suspendData ?? "";
        const l = await fetch(stateUrl("oelt.location"), { headers: auth() });
        if (l.ok) locationCache = (await l.json())?.location ?? "";
      } catch {
        /* no prior state */
      }
      send("initialized"); // §9.3.2 — MUST be first
    },

    entry() {
      return suspendCache || locationCache ? "resume" : "new";
    },

    getSuspend() {
      return suspendCache;
    },
    setSuspend(payload) {
      suspendCache = payload;
      enqueue(() =>
        fetch(stateUrl("suspendData"), {
          method: "PUT",
          headers: auth(),
          body: JSON.stringify({ suspendData: payload }),
        }),
      );
      emit({ type: "state", op: "set", key: "suspendData", value: payload, bytes: payload.length });
    },

    getLocation() {
      return locationCache;
    },
    setLocation(pageId) {
      locationCache = pageId;
      enqueue(() =>
        fetch(stateUrl("oelt.location"), {
          method: "PUT",
          headers: auth(),
          body: JSON.stringify({ location: pageId }),
        }),
      );
    },

    applyOutcome(o: Outcome) {
      // cmi5 send-once, in order: completed → passed/failed.
      if (o.completion && !sent.has("completed")) {
        sent.add("completed");
        send(
          "completed",
          o.success == null && o.score != null ? { score: { scaled: o.score } } : undefined,
        );
      }
      if (o.success && !sent.has(o.success)) {
        sent.add(o.success);
        send(o.success, {
          success: o.success === "passed",
          score: o.score != null ? { scaled: o.score } : undefined,
        });
      }
    },

    reportInteraction(r: InteractionReport) {
      send("answered", {
        success: r.result === "passed",
        ...(r.score != null ? { score: { scaled: r.score } } : {}),
      });
      emit({ type: "interaction", id: r.id, result: r.result, scaled: r.score ?? null });
    },

    commit() {
      // State/statements are PUT/POSTed eagerly; nothing to flush.
    },

    terminate() {
      if (sent.has("terminated")) return;
      sent.add("terminated");
      send("terminated"); // §9.3.8 — MUST be last
      emit({ type: "lifecycle", op: "terminate", adapter: "cmi5" });
    },
  };
}
