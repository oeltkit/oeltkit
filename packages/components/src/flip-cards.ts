// <oelt-flip-cards> — flip cards. See presentation.md §4. Each card is a native
// <button> toggling between its `front` and its authored back content; the
// hidden face is `hidden` so SR reads only the visible face; aria-pressed
// conveys flipped state; the flip animation is suppressed under reduced motion.
// Presentation-only, stateless.

import { OeltElement, ensureStyles } from "./base.js";

/** Inert data-carrier for a card (front attr + back content). */
export class OeltCard extends HTMLElement {}

export class OeltFlipCards extends OeltElement {
  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const cards = [...this.querySelectorAll("oelt-card")].map((c, i) => ({
      front: c.getAttribute("front") ?? `Card ${i + 1}`,
      back: c.innerHTML,
    }));
    if (cards.length === 0) return;

    this.innerHTML = `<div part="grid">${cards
      .map(
        (c) =>
          `<button part="card" type="button" aria-pressed="false">` +
          `<span part="front">${escapeHtml(c.front)}</span>` +
          `<span part="back" hidden>${c.back}</span>` +
          `</button>`,
      )
      .join("")}</div>`;

    for (const card of this.querySelectorAll<HTMLButtonElement>('[part~="card"]')) {
      card.addEventListener("click", () => this.#flip(card));
    }
  }

  #flip(card: HTMLButtonElement): void {
    const flipped = card.getAttribute("aria-pressed") === "true";
    card.setAttribute("aria-pressed", String(!flipped));
    card.part.toggle("flipped", !flipped);
    const front = card.querySelector<HTMLElement>('[part~="front"]')!;
    const back = card.querySelector<HTMLElement>('[part~="back"]')!;
    front.hidden = !flipped; // when currently flipped, going back to front
    back.hidden = flipped;
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
