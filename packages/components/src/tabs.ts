// <oelt-tabs> — tabbed panels (WAI-ARIA Tabs pattern). See presentation.md §2.
// Light DOM, presentation-only (no tracking, stateless). Enhances <oelt-tab>
// children into a role=tablist of buttons + role=tabpanel regions with roving
// tabindex and automatic activation.

import { OeltElement, ensureStyles } from "./base.js";

/** Inert data-carrier for a tab (label attr + panel content). */
export class OeltTab extends HTMLElement {}

export class OeltTabs extends OeltElement {
  #tabs: HTMLButtonElement[] = [];
  #panels: HTMLElement[] = [];

  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const tabEls = [...this.querySelectorAll("oelt-tab")];
    const items = tabEls.map((t, i) => ({
      label: t.getAttribute("label") ?? `Tab ${i + 1}`,
      content: t.innerHTML,
    }));
    if (items.length === 0) return;

    const tablist = `<div part="tablist" role="tablist">${items
      .map(
        (it, i) =>
          `<button part="tab" role="tab" type="button" id="${this.id}-tab-${i}" aria-controls="${this.id}-panel-${i}" aria-selected="${
            i === 0
          }" tabindex="${i === 0 ? 0 : -1}">${escapeHtml(it.label)}</button>`,
      )
      .join("")}</div>`;
    const panels = items
      .map(
        (it, i) =>
          `<div part="panel" role="tabpanel" id="${this.id}-panel-${i}" aria-labelledby="${this.id}-tab-${i}" tabindex="0"${
            i === 0 ? "" : " hidden"
          }>${it.content}</div>`,
      )
      .join("");
    this.innerHTML = tablist + panels;

    this.#tabs = [...this.querySelectorAll<HTMLButtonElement>('[part~="tab"]')];
    this.#panels = [...this.querySelectorAll<HTMLElement>('[part~="panel"]')];

    this.#tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => this.#select(i));
      tab.addEventListener("keydown", (e) => this.#onKey(e, i));
    });
  }

  #onKey(e: KeyboardEvent, i: number): void {
    const last = this.#tabs.length - 1;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
        next = i === last ? 0 : i + 1;
        break;
      case "ArrowLeft":
        next = i === 0 ? last : i - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    this.#select(next);
    this.#tabs[next]!.focus(); // automatic activation: focus follows selection
  }

  #select(i: number): void {
    this.#tabs.forEach((tab, j) => {
      const on = j === i;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.part.toggle("selected", on);
      this.#panels[j]!.hidden = !on;
    });
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
