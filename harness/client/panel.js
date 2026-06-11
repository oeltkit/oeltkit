// Inspector panel + the `window.__oelt_harness` log store.
//
// The panel is the whole point of the harness: a screenshot-legible, live view
// of everything the simulated LMS sees. All adapters (the fake SCORM API in
// this host window, and the cmi5/web clients running in the preview iframe)
// report here via `window.parent.__oelt_harness`.

const OELT_SUSPEND_BUDGET = 3072; // bytes — OELT enforced budget (tracking-semantics §8)
const HARD_LIMIT = { scorm12: 4096, scorm2004: 65536, cmi5: Infinity, web: Infinity };

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const byteLen = (s) => new TextEncoder().encode(String(s ?? "")).length;

/**
 * Create the harness, build the panel DOM under `rootEl`, and install
 * `window.__oelt_harness`.
 * @param {{ mode: string, rootEl: HTMLElement }} opts
 */
export function createHarness({ mode, rootEl }) {
  /** @type {object[]} */
  const log = [];
  /** flat SCORM data-model map, e.g. { "cmi.core.lesson_status": "completed" } */
  const scormModel = {};
  let seq = 0;

  rootEl.innerHTML = `
    <div class="panel">
      <h2>LMS Inspector <span class="mode-badge" id="h-mode"></span></h2>
      <section class="card" id="h-summary-card">
        <h3>Completion / score — as the LMS sees it</h3>
        <div id="h-summary"></div>
      </section>
      <section class="card">
        <h3>Suspend data</h3>
        <div id="h-suspend"></div>
      </section>
      <section class="card">
        <h3>Data-model state</h3>
        <div id="h-state" class="kv"></div>
      </section>
      <section class="card grow">
        <h3>Call log <button id="h-clear" type="button">clear</button></h3>
        <ol id="h-log" class="log"></ol>
      </section>
    </div>`;

  const $ = (id) => rootEl.querySelector(id);
  $("#h-mode").textContent = mode;
  $("#h-clear").addEventListener("click", () => {
    log.length = 0;
    render();
  });

  function summary() {
    if (mode === "scorm12") {
      const status = scormModel["cmi.core.lesson_status"] ?? "(unset)";
      const raw = scormModel["cmi.core.score.raw"];
      return {
        completion: ["completed", "passed", "failed"].includes(status) ? status : "incomplete",
        success: ["passed", "failed"].includes(status) ? status : "—",
        score: raw != null ? `${raw}/100` : "—",
      };
    }
    if (mode === "scorm2004") {
      return {
        completion: scormModel["cmi.completion_status"] ?? "(unset)",
        success: scormModel["cmi.success_status"] ?? "—",
        score: scormModel["cmi.score.scaled"] != null ? scormModel["cmi.score.scaled"] : "—",
      };
    }
    if (mode === "cmi5") {
      const verbs = log.filter((e) => e.kind === "statement").map((e) => e.verb);
      const has = (v) => verbs.includes(v);
      const scored = log.filter((e) => e.kind === "statement" && e.scaled != null).pop();
      return {
        completion: has("completed") ? "completed" : "incomplete",
        success: has("passed") ? "passed" : has("failed") ? "failed" : "—",
        score: scored ? scored.scaled : "—",
      };
    }
    // web
    return {
      completion: scormModel["completion"] ?? "incomplete",
      success: scormModel["success"] ?? "—",
      score: scormModel["score"] != null ? scormModel["score"] : "—",
    };
  }

  function currentSuspend() {
    if (mode === "scorm12" || mode === "scorm2004") return scormModel["cmi.suspend_data"] ?? "";
    if (mode === "web") return scormModel["suspend"] ?? "";
    // cmi5: last suspend State PUT recorded in the log
    const last = log.filter((e) => e.kind === "state" && /suspend/i.test(e.key ?? "")).pop();
    return last?.value ?? "";
  }

  function render() {
    const s = summary();
    $("#h-summary").innerHTML = `
      <div class="summary">
        <div><span class="lbl">completion</span><span class="val status-${esc(s.completion)}">${esc(s.completion)}</span></div>
        <div><span class="lbl">success</span><span class="val status-${esc(s.success)}">${esc(s.success)}</span></div>
        <div><span class="lbl">score</span><span class="val">${esc(s.score)}</span></div>
      </div>`;

    const bytes = byteLen(currentSuspend());
    const limit = HARD_LIMIT[mode];
    const overBudget = bytes > OELT_SUSPEND_BUDGET;
    const overLimit = bytes > limit;
    const pct = Math.min(100, (bytes / OELT_SUSPEND_BUDGET) * 100);
    $("#h-suspend").innerHTML = `
      <div class="suspend ${overLimit ? "err" : overBudget ? "warn" : "ok"}">
        <strong>${bytes}</strong> bytes
        &middot; OELT budget ${OELT_SUSPEND_BUDGET}
        ${limit === Infinity ? "" : `&middot; ${mode} limit ${limit}`}
        ${overLimit ? " &middot; OVER LMS LIMIT" : overBudget ? " &middot; over OELT budget" : ""}
      </div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>`;

    const keys = Object.keys(scormModel).sort();
    $("#h-state").innerHTML = keys.length
      ? keys
          .map((k) => `<div><code>${esc(k)}</code><span>${esc(scormModel[k])}</span></div>`)
          .join("")
      : `<div class="muted">no state yet</div>`;

    $("#h-log").innerHTML = log
      .map((e) => {
        const label = e.kind === "statement" ? `▸ statement: ${esc(e.verb)}` : esc(e.op);
        const detail = e.key ? ` <code>${esc(e.key)}</code>` : "";
        const val = e.value != null && e.value !== "" ? ` = <em>${esc(e.value)}</em>` : "";
        const result = e.error
          ? ` <span class="r-err">${esc(e.error)}</span>`
          : e.result != null
            ? ` → ${esc(e.result)}`
            : "";
        return `<li class="log-${esc(e.kind)}"><span class="t">${e.t}</span> <b>${label}</b>${detail}${val}${result}</li>`;
      })
      .reverse()
      .join("");
  }

  const stamp = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
      d.getSeconds(),
    ).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  };

  const harness = {
    mode,
    /** Append a log entry. kind: "call" | "statement" | "state" | "info". */
    push(entry) {
      log.push({ seq: seq++, t: stamp(), mode, ...entry });
      render();
    },
    /** Record a SCORM/web data-model write for the state view + summary. */
    setModel(key, value) {
      scormModel[key] = value;
    },
    getModel: () => ({ ...scormModel }),
    seedModel(obj) {
      Object.assign(scormModel, obj ?? {});
      render();
    },
    getLog: () => log.map((e) => ({ ...e })),
    summary,
    suspendBytes: () => byteLen(currentSuspend()),
    OELT_SUSPEND_BUDGET,
    hardLimit: () => HARD_LIMIT[mode],
    render,
  };

  window.__oelt_harness = harness;
  render();
  return harness;
}
