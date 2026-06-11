// Course preview client. Runs in the preview iframe.
//
// Renders the course (linear nav over modules → pages) and drives a MINIMAL
// tracking lifecycle through a per-mode adapter. This is deliberately a harness
// preview shim, NOT @oeltkit/runtime — it implements only the zero-config
// default (all-pages-viewed ⇒ completed; no mastery ⇒ "completed", per the
// SCORM 1.2 collapse rule in tracking-semantics.md §4.2) so the harness is
// exercisable end-to-end before the real runtime exists. Task 03 swaps the
// real runtime in behind the same adapter boundary.

import { makeCmi5Client } from "./cmi5-client.js";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "web";

/** Walk the window chain for a SCORM API handle (the real discovery rule). */
function findScormApi(name) {
  let w = window;
  for (let i = 0; i < 10 && w; i++) {
    if (w[name]) return w[name];
    if (w.parent === w) break;
    w = w.parent;
  }
  return null;
}

const report = (entry) => window.parent.__oelt_harness?.push(entry);

// ── mode adapters ─────────────────────────────────────────────────────────────
function makeAdapter() {
  if (mode === "scorm12") {
    const api = findScormApi("API");
    return {
      async init() {
        if (!api) return report({ kind: "info", op: "init", error: "SCORM 1.2 API not found" });
        api.LMSInitialize("");
      },
      complete() {
        // No mastery defined ⇒ report completion, not success (collapse rule).
        api?.LMSSetValue("cmi.core.lesson_status", "completed");
        api?.LMSCommit("");
      },
      setSuspend(v) {
        api?.LMSSetValue("cmi.suspend_data", v);
      },
      terminate() {
        api?.LMSFinish("");
      },
    };
  }
  if (mode === "scorm2004") {
    const api = findScormApi("API_1484_11");
    return {
      async init() {
        if (!api) return report({ kind: "info", op: "init", error: "SCORM 2004 API not found" });
        api.Initialize("");
      },
      complete() {
        api?.SetValue("cmi.completion_status", "completed");
        api?.Commit("");
      },
      setSuspend(v) {
        api?.SetValue("cmi.suspend_data", v);
      },
      terminate() {
        api?.Terminate("");
      },
    };
  }
  if (mode === "cmi5") {
    const client = makeCmi5Client();
    return {
      async init() {
        await client.start();
      },
      complete() {
        client.completed();
      },
      setSuspend(v) {
        void client.setSuspend(v);
      },
      terminate() {
        client.terminated();
      },
    };
  }
  // web — localStorage + server JSON mirror, graceful no-LMS fallback.
  const key = `oelt:web:${location.pathname}`;
  return {
    async init() {
      report({ kind: "info", op: "web init", result: "standalone (localStorage)" });
    },
    complete() {
      localStorage.setItem(key, JSON.stringify({ completion: "completed" }));
      window.parent.__oelt_harness?.setModel("completion", "completed");
      report({
        kind: "call",
        op: "localStorage.set",
        key: "completion",
        value: "completed",
        result: "ok",
      });
      void fetch(`/api/state?mode=web`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completion: "completed" }),
      });
    },
    setSuspend(v) {
      window.parent.__oelt_harness?.setModel("suspend", v);
      report({ kind: "state", op: "localStorage.set", key: "suspend", value: v });
    },
    terminate() {
      report({ kind: "info", op: "web terminate", result: "state persisted" });
    },
  };
}

// ── course rendering ──────────────────────────────────────────────────────────
async function main() {
  const course = await (await fetch("/harness/course.json")).json();
  const pages = course.structure.flatMap((m) =>
    m.pages.map((pg) => ({ ...pg, moduleTitle: m.title })),
  );
  const viewed = new Set();
  let idx = 0;
  let completed = false;
  let terminated = false;

  const adapter = makeAdapter();

  const root = document.getElementById("course-root");
  root.innerHTML = `
    <header class="c-head">
      <div><strong>${course.title}</strong> <span class="c-mode">${mode}</span></div>
      <button id="c-exit" type="button">Exit course</button>
    </header>
    <nav class="c-toc" id="c-toc"></nav>
    <main class="c-page" id="c-page" tabindex="-1"></main>
    <footer class="c-nav">
      <button id="c-prev" type="button">‹ Prev</button>
      <span id="c-pos"></span>
      <button id="c-next" type="button">Next ›</button>
    </footer>`;

  const toc = document.getElementById("c-toc");
  toc.innerHTML = pages
    .map((pg, i) => `<button data-i="${i}" type="button">${i + 1}. ${pg.title}</button>`)
    .join("");
  toc.addEventListener("click", (e) => {
    const i = e.target?.dataset?.i;
    if (i != null) go(Number(i));
  });

  async function go(i) {
    idx = Math.max(0, Math.min(pages.length - 1, i));
    const pg = pages[idx];
    const html = await (await fetch(`/course/${pg.src}`)).text();
    const page = document.getElementById("c-page");
    page.innerHTML = html;
    page.focus();
    document.getElementById("c-pos").textContent = `${idx + 1} / ${pages.length}`;
    document.getElementById("c-prev").disabled = idx === 0;
    document.getElementById("c-next").disabled = idx === pages.length - 1;
    toc.querySelectorAll("button").forEach((b, bi) => b.classList.toggle("active", bi === idx));
    report({ kind: "info", op: "page-view", key: pg.id, result: pg.title });

    viewed.add(pg.id);
    if (!completed && viewed.size === pages.length) {
      completed = true;
      adapter.complete(); // zero-config default: all pages viewed ⇒ complete
    }
  }

  document.getElementById("c-prev").addEventListener("click", () => go(idx - 1));
  document.getElementById("c-next").addEventListener("click", () => go(idx + 1));
  function exit() {
    if (terminated) return;
    terminated = true;
    adapter.terminate();
  }
  document.getElementById("c-exit").addEventListener("click", exit);
  window.addEventListener("pagehide", exit);

  await adapter.init();
  await go(0);
}

main().catch((err) =>
  report({ kind: "info", op: "preview-error", error: String(err?.message ?? err) }),
);
