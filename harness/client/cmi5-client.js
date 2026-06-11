// cmi5 AU (Assignable Unit) launch client. Runs in the preview iframe.
//
// Implements the cmi5 launch sequence per the cmi5 spec (AICC/CMI-5_Spec_Current):
//   §8.1  launch query parameters: endpoint, fetch, actor, registration, activityId
//   §8.2  fetch URL: HTTP POST → { "auth-token": "..." }
//   §10.2 LMS.LaunchData State document: contextTemplate, launchMode, moveOn, masteryScore
//   §9.3  verbs: Initialized 9.3.2 / Completed 9.3.3 / Passed 9.3.4 / Failed 9.3.5 / Terminated 9.3.8
//   §9.6.2 every cmi5-defined statement MUST merge the contextTemplate, incl. the
//          cmi5 category activity (§9.6.2.1)
//
// We do not improvise the sequence: fetch happens once (§8.2.1), LaunchData is
// read before the first statement, and statements carry the context template.

const VERB_IRI = {
  initialized: "http://adlnet.gov/expapi/verbs/initialized", // §9.3.2
  completed: "http://adlnet.gov/expapi/verbs/completed", // §9.3.3
  passed: "http://adlnet.gov/expapi/verbs/passed", // §9.3.4
  failed: "http://adlnet.gov/expapi/verbs/failed", // §9.3.5
  terminated: "http://adlnet.gov/expapi/verbs/terminated", // §9.3.8
};

/** Read the five cmi5 launch parameters (§8.1) from the iframe URL. */
function readLaunchParams() {
  const q = new URLSearchParams(location.search);
  return {
    endpoint: q.get("endpoint"), // §8.1.1
    fetchUrl: q.get("fetch"), // §8.1.2
    actor: q.get("actor") ? JSON.parse(q.get("actor")) : null, // §8.1.3
    registration: q.get("registration"), // §8.1.4
    activityId: q.get("activityId"), // §8.1.5
  };
}

/** Report to the host inspector panel. */
const report = (entry) => window.parent.__oelt_harness?.push(entry);

export function makeCmi5Client() {
  const p = readLaunchParams();
  let authToken = null;
  let launchData = null;

  const auth = () => ({ Authorization: `Basic ${authToken}`, "X-Experience-API-Version": "1.0.3" });
  const withReg = (url) =>
    `${url}${url.includes("?") ? "&" : "?"}registration=${encodeURIComponent(p.registration)}`;

  /** Deep-merge the contextTemplate (§9.6.2) and add the registration. */
  function buildContext() {
    const tmpl = launchData?.contextTemplate ?? {};
    return {
      registration: p.registration,
      ...structuredClone(tmpl),
    };
  }

  function statement(verb, result) {
    const stmt = {
      actor: p.actor,
      verb: { id: VERB_IRI[verb], display: { "en-US": verb } },
      object: { id: p.activityId, objectType: "Activity" },
      context: buildContext(),
      timestamp: new Date().toISOString(),
    };
    if (result) stmt.result = result;
    return stmt;
  }

  async function send(verb, result) {
    const res = await fetch(withReg(`${p.endpoint}statements`), {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify(statement(verb, result)),
    });
    report({
      kind: "statement",
      op: "POST statement",
      verb,
      scaled: result?.score?.scaled ?? null,
      result: res.ok ? "stored" : `HTTP ${res.status}`,
    });
  }

  return {
    params: p,
    launchData: () => launchData,

    /** §8.2 fetch the auth token once, then §10 read LaunchData. */
    async start() {
      const r = await fetch(p.fetchUrl, { method: "POST" });
      authToken = (await r.json())["auth-token"]; // §8.2.2
      report({ kind: "info", op: "POST fetch", result: "auth-token received" });

      const ld = await fetch(
        withReg(
          `${p.endpoint}activities/state?stateId=LMS.LaunchData&activityId=${encodeURIComponent(p.activityId)}`,
        ),
        { headers: auth() },
      );
      launchData = await ld.json();
      report({
        kind: "info",
        op: "GET LMS.LaunchData",
        result: `launchMode=${launchData.launchMode} moveOn=${launchData.moveOn}`,
      });
      await send("initialized"); // §9.3.2 — MUST be first
    },

    completed: () => send("completed"), // §9.3.3
    passed: (scaled) => send("passed", { success: true, score: { scaled } }), // §9.3.4
    failed: (scaled) => send("failed", { success: false, score: { scaled } }), // §9.3.5
    terminated: () => send("terminated"), // §9.3.8 — MUST be last

    async setSuspend(value) {
      await fetch(
        withReg(
          `${p.endpoint}activities/state?stateId=suspendData&activityId=${encodeURIComponent(p.activityId)}`,
        ),
        {
          method: "PUT",
          headers: { ...auth(), "content-type": "application/json" },
          body: JSON.stringify({ suspendData: value }),
        },
      );
      report({ kind: "state", op: "PUT state", key: "suspendData", value });
    },
  };
}
