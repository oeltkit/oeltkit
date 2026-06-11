// Course preview client. Runs in the preview iframe.
//
// Boots the REAL @oeltkit/runtime (loaded as the IIFE global `oelt` by
// preview.html) and renders the course around it. The runtime owns tracking,
// state, navigation, and adapter selection; this file is just the harness view:
// it renders the current page, wires nav/exit to oelt.*, and forwards the
// runtime's event stream to the inspector panel for the cmi5/web modes (the
// SCORM modes are observed directly through the fake API's own logging).

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "web";
const panel = () => window.parent.__oelt_harness;

// Map runtime events → panel entries for modes the fake SCORM API can't observe.
function forwardToPanel(evt) {
  if (mode !== "cmi5" && mode !== "web") return;
  const h = panel();
  if (!h) return;
  switch (evt.type) {
    case "statement":
      h.push({
        kind: "statement",
        op: "POST statement",
        verb: evt.verb,
        scaled: evt.scaled,
        result: "stored",
      });
      break;
    case "info":
      h.push({ kind: "info", op: "cmi5", result: evt.message });
      break;
    case "lifecycle":
      h.push({ kind: "info", op: evt.op, result: evt.adapter });
      break;
    case "state":
      if (mode === "web") h.setModel("suspend", evt.value);
      h.push({
        kind: "state",
        op: mode === "web" ? "localStorage.set" : "PUT state",
        key: evt.key,
        value: evt.value,
      });
      break;
    case "completion":
      if (mode === "web") {
        h.setModel("completion", evt.reported);
        h.push({ kind: "call", op: "completion", value: evt.reported, result: "ok" });
      }
      break;
    case "success":
      if (mode === "web") h.setModel("success", evt.success);
      break;
    case "score":
      if (mode === "web") h.setModel("score", evt.scaled);
      break;
    case "progress":
      if (mode === "web") h.setModel("progress", evt.value);
      break;
    case "interaction":
      h.push({ kind: "info", op: "interaction", key: evt.id, result: evt.result });
      break;
  }
}

async function main() {
  const course = await (await fetch("/harness/course.json")).json();

  // Construct the runtime (auto-detects the target from the launch context).
  const rt = window.oelt.boot(course);

  const root = document.getElementById("course-root");
  root.innerHTML = `
    <header class="c-head">
      <div><strong>${course.title}</strong> <span class="c-mode">${rt.target}</span></div>
      <button id="c-exit" type="button">Exit course</button>
    </header>
    <nav class="c-toc" id="c-toc"></nav>
    <main class="c-page" id="c-page" tabindex="-1"></main>
    <footer class="c-nav">
      <button id="c-prev" type="button">‹ Prev</button>
      <span id="c-pos"></span>
      <button id="c-next" type="button">Next ›</button>
    </footer>`;

  const pages = rt.nav.pages;
  const toc = document.getElementById("c-toc");
  toc.innerHTML = pages
    .map((pg, i) => `<button data-i="${i}" type="button">${i + 1}. ${pg.title}</button>`)
    .join("");
  toc.addEventListener("click", (e) => {
    const i = e.target?.dataset?.i;
    if (i != null) rt.nav.go(Number(i));
  });
  document.getElementById("c-prev").addEventListener("click", () => rt.nav.prev());
  document.getElementById("c-next").addEventListener("click", () => rt.nav.next());
  document.getElementById("c-exit").addEventListener("click", () => rt.terminate());
  window.addEventListener("pagehide", () => rt.terminate());

  async function render(index) {
    const pg = pages[index];
    const html = await (await fetch(`/course/${pg.src}`)).text();
    const page = document.getElementById("c-page");
    page.innerHTML = html; // author HTML; inline oelt.* handlers run on interaction
    page.focus();
    document.getElementById("c-pos").textContent = `${index + 1} / ${pages.length}`;
    document.getElementById("c-prev").disabled = index === 0;
    document.getElementById("c-next").disabled = index === pages.length - 1;
    toc.querySelectorAll("button").forEach((b, bi) => b.classList.toggle("active", bi === index));
  }

  // Subscribe BEFORE start() so the launch lifecycle's events are observed.
  rt.on((evt) => {
    if (evt.type === "page-change") void render(evt.index);
    forwardToPanel(evt);
  });

  await rt.start();
}

main().catch((err) =>
  panel()?.push({ kind: "info", op: "preview-error", error: String(err?.message ?? err) }),
);
