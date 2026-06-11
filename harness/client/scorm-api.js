// Faithful fake SCORM 1.2 (`API`) and SCORM 2004 (`API_1484_11`) content-side
// APIs. These run in the harness host window; content in the preview iframe
// discovers them by walking `window.parent` (the real SCORM discovery rule).
//
// They implement the data-model subset OELT uses (status, score, suspend_data
// with the per-version byte limit ENFORCED, interactions, session_time,
// location) and persist the committed model to the server so resume can be
// tested across reloads.

const ENC = new TextEncoder();
const byteLen = (s) => ENC.encode(String(s ?? "")).length;

// suspend_data hard limits. SCORM 1.2 guarantees 4096; 2004 raised it to 64000.
const SUSPEND_LIMIT = { 1.2: 4096, 2004: 64000 };

// Read-only defaults so content can read learner info / mode.
const DEFAULTS_12 = {
  "cmi.core.student_id": "harness-learner",
  "cmi.core.student_name": "Harness, Learner",
  "cmi.core.lesson_mode": "normal",
  "cmi.core.credit": "credit",
  "cmi.core.entry": "ab-initio",
  "cmi.core.lesson_status": "not attempted",
  "cmi.core.lesson_location": "",
  "cmi.suspend_data": "",
};
const DEFAULTS_2004 = {
  "cmi.learner_id": "harness-learner",
  "cmi.learner_name": "Harness, Learner",
  "cmi.mode": "normal",
  "cmi.credit": "credit",
  "cmi.entry": "ab-initio",
  "cmi.completion_status": "unknown",
  "cmi.success_status": "unknown",
  "cmi.location": "",
  "cmi.suspend_data": "",
};

/**
 * @param {"1.2"|"2004"} version
 * @param {object} harness  window.__oelt_harness
 * @param {object} seed     resume model loaded from the server ({} if none)
 */
export function makeScormApi(version, harness, seed) {
  // Both versions key suspend data as `cmi.suspend_data`.
  const suspendKey = "cmi.suspend_data";
  const defaults = version === "1.2" ? DEFAULTS_12 : DEFAULTS_2004;
  const limit = SUSPEND_LIMIT[version];

  const model = { ...defaults, ...(seed ?? {}) };
  // Mirror seeded model into the panel immediately (so resume is visible).
  for (const [k, v] of Object.entries(model)) harness.setModel(k, v);

  let initialized = false;
  let lastError = "0";

  const ERR = {
    1.2: { ok: "0", notInit: "301", roOnly: "403", range: "405" },
    2004: { ok: "0", notInit: "122", roOnly: "404", range: "407" },
  }[version];

  // Element paths content may write (everything else is treated read-only).
  const writable = (key) =>
    key === "cmi.suspend_data" ||
    /^cmi\.interactions\./.test(key) ||
    (version === "1.2"
      ? [
          "cmi.core.lesson_status",
          "cmi.core.lesson_location",
          "cmi.core.session_time",
          "cmi.core.score.raw",
          "cmi.core.score.min",
          "cmi.core.score.max",
        ].includes(key)
      : [
          "cmi.completion_status",
          "cmi.success_status",
          "cmi.location",
          "cmi.session_time",
          "cmi.progress_measure",
          "cmi.score.scaled",
          "cmi.score.raw",
          "cmi.score.min",
          "cmi.score.max",
        ].includes(key));

  async function persist() {
    try {
      await fetch(`/api/state?mode=${harness.mode}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(model),
      });
    } catch {
      /* best-effort, like a real LMS commit */
    }
  }

  const ok = (op, key, value, result) => {
    lastError = ERR.ok;
    harness.push({ kind: "call", op, key, value, result });
    return result;
  };
  const fail = (op, key, value, code, msg) => {
    lastError = code;
    harness.push({ kind: "call", op, key, value, result: "false", error: `err ${code}: ${msg}` });
    return "false";
  };

  function getValue(op, key) {
    if (!initialized) return fail(op, key, undefined, ERR.notInit, "not initialized");
    const v = model[key] ?? defaults[key] ?? "";
    return ok(op, key, undefined, v);
  }

  function setValue(op, key, value) {
    if (!initialized) return fail(op, key, value, ERR.notInit, "not initialized");
    if (key === suspendKey && byteLen(value) > limit) {
      return fail(
        op,
        key,
        `${byteLen(value)} bytes`,
        ERR.range,
        `suspend_data exceeds ${limit}-byte limit`,
      );
    }
    if (!writable(key)) {
      return fail(op, key, value, ERR.roOnly, "element is read only");
    }
    model[key] = value;
    harness.setModel(key, value);
    return ok(op, key, value, "true");
  }

  const commit = (op) => {
    if (!initialized) return fail(op, undefined, undefined, ERR.notInit, "not initialized");
    void persist();
    return ok(op, undefined, undefined, "true");
  };

  const init = (op) => {
    initialized = true;
    harness.push({ kind: "call", op, result: "true" });
    lastError = ERR.ok;
    return "true";
  };

  const finish = (op) => {
    if (!initialized) return fail(op, undefined, undefined, ERR.notInit, "not initialized");
    void persist();
    initialized = false;
    harness.push({ kind: "call", op, result: "true" });
    return "true";
  };

  const getLastError = () => lastError;
  const diag = () => "";

  if (version === "1.2") {
    return {
      LMSInitialize: () => init("LMSInitialize"),
      LMSFinish: () => finish("LMSFinish"),
      LMSGetValue: (k) => getValue("LMSGetValue", k),
      LMSSetValue: (k, v) => setValue("LMSSetValue", k, v),
      LMSCommit: () => commit("LMSCommit"),
      LMSGetLastError: getLastError,
      LMSGetErrorString: (c) => `error ${c}`,
      LMSGetDiagnostic: diag,
    };
  }
  return {
    Initialize: () => init("Initialize"),
    Terminate: () => finish("Terminate"),
    GetValue: (k) => getValue("GetValue", k),
    SetValue: (k, v) => setValue("SetValue", k, v),
    Commit: () => commit("Commit"),
    GetLastError: getLastError,
    GetErrorString: (c) => `error ${c}`,
    GetDiagnostic: diag,
  };
}
