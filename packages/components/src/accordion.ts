// <oelt-accordion> — collapsible sections via native <details>/<summary>.
// See presentation.md §3. Accessible by construction; the only JS is enhancing
// authored <oelt-panel>s into <details> and wiring `single` (exclusive open) to
// the native shared-`name` mechanism. Presentation-only, stateless.

import { OeltElement, ensureStyles } from "./base.js";

/** Inert data-carrier for a panel (label attr + content). */
export class OeltPanel extends HTMLElement {}

export class OeltAccordion extends OeltElement {
  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const panels = [...this.querySelectorAll("oelt-panel")].map((p, i) => ({
      label: p.getAttribute("label") ?? `Section ${i + 1}`,
      open: p.hasAttribute("open"),
      content: p.innerHTML,
    }));
    if (panels.length === 0) return;

    // `single` → shared name makes the browser enforce exclusive open natively.
    const nameAttr = this.hasAttribute("single") ? ` name="${escapeAttr(this.id || "oelt-acc")}"` : "";

    this.innerHTML = panels
      .map(
        (p) =>
          `<details part="panel"${nameAttr}${p.open ? " open" : ""}><summary part="summary">${escapeHtml(
            p.label,
          )}</summary><div part="content">${p.content}</div></details>`,
      )
      .join("");
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;");
