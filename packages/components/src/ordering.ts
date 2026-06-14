// <oelt-ordering> — sequence / ranking. See specs/components/ordering.md and
// dnd-family.md. Light DOM: enhances authored <oelt-item>s into an <ol> of
// <button> handles with a keyboard pick-up/move/drop model (the gate) plus
// pointer drag (enhancement). Grades current order vs the authored order.

import { OeltElement, ensureStyles } from "./base.js";
import { LiveAnnouncer, GrabController, gradeByPosition, shuffleDifferent } from "./dnd.js";

/** Inert data-carrier for an orderable item (consumed on upgrade). */
export class OeltItem extends HTMLElement {}

interface OrderingState {
  order: string[];
  submitted: boolean;
}

export class OeltOrdering extends OeltElement {
  #correct: string[] = [];
  #labels = new Map<string, string>();
  #order: string[] = [];
  #grabbed: number | null = null;
  #preGrab: string[] | null = null;
  #submitted = false;
  #locked = false;
  #ol!: HTMLOListElement;
  #feedback!: HTMLElement;
  #announcer = new LiveAnnouncer();
  #grabCtl = new GrabController({
    isGrabbed: () => this.#grabbed !== null,
    pickUp: (i) => this.#grab(i),
    move: (d) => this.#move(d),
    drop: () => this.#drop(),
    cancel: () => this.#cancel(),
  });

  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const items = [...this.querySelectorAll("oelt-item")];
    for (const it of items) {
      const value = it.getAttribute("value") ?? (it.textContent ?? "").trim();
      this.#correct.push(value);
      this.#labels.set(value, (it.textContent ?? "").trim());
    }
    const prompt = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";
    const submitLabel = this.getAttribute("submit-label") ?? "Check order";

    const saved = this.loadState<OrderingState | undefined>(undefined);
    this.#order = saved
      ? saved.order.filter((v) => this.#labels.has(v))
      : shuffleDifferent(this.#correct);
    this.#submitted = saved?.submitted ?? false;

    const promptId = `${this.id}-prompt`;
    this.innerHTML = `
      <div part="prompt" id="${promptId}">${prompt}</div>
      <ol part="list" aria-labelledby="${promptId}"></ol>
      <button part="submit" type="button">${escapeHtml(submitLabel)}</button>
      <div part="feedback" role="status" aria-live="polite" tabindex="-1"></div>`;
    this.#ol = this.querySelector("ol")!;
    this.#feedback = this.querySelector<HTMLElement>('[part~="feedback"]')!;
    this.appendChild(this.#announcer.region);

    this.#renderItems();
    this.#wire();

    const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]')!;
    submit.addEventListener("click", () => this.#check());

    if (this.#submitted) this.#lockUp(); // resume in a checked/locked state
  }

  #renderItems(): void {
    this.#ol.innerHTML = this.#order
      .map((v, i) => {
        const grabbed = this.#grabbed === i ? " grabbed" : "";
        return `<li><button part="item${grabbed}" type="button" draggable="${!this.#locked}" data-value="${escapeAttr(
          v,
        )}" data-i="${i}">${escapeHtml(this.#labels.get(v) ?? v)}</button></li>`;
      })
      .join("");
  }

  #focusItem(i: number): void {
    this.#ol.querySelector<HTMLButtonElement>(`[data-i="${i}"]`)?.focus();
  }

  #pos(i: number): string {
    return `Position ${i + 1} of ${this.#order.length}.`;
  }

  #wire(): void {
    // Keyboard pick-up / move / drop (dnd-family.md §3) via the shared controller.
    this.#ol.addEventListener("keydown", (e) => {
      if (this.#locked) return;
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[part~="item"]');
      if (!btn) return;
      this.#grabCtl.handleKey(e, Number(btn.dataset.i));
    });

    // Pointer drag (enhancement) — commits the same state, syncs the announcer.
    this.#ol.addEventListener("dragstart", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[part~="item"]');
      if (!btn || this.#locked) return;
      e.dataTransfer?.setData("text/plain", btn.dataset.value ?? "");
    });
    this.#ol.addEventListener("dragover", (e) => {
      if (!this.#locked) e.preventDefault(); // allow drop
    });
    this.#ol.addEventListener("drop", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[part~="item"]');
      const value = e.dataTransfer?.getData("text/plain");
      if (!target || !value || this.#locked) return;
      e.preventDefault();
      const from = this.#order.indexOf(value);
      const to = Number(target.dataset.i);
      if (from === -1 || from === to) return;
      this.#order.splice(from, 1);
      this.#order.splice(to, 0, value);
      this.#grabbed = null;
      this.#renderItems();
      this.#persist();
      this.#announcer.announce(`Dropped ${this.#labels.get(value) ?? value}. ${this.#pos(to)}`);
    });
  }

  #grab(i: number): void {
    this.#grabbed = i;
    this.#preGrab = [...this.#order];
    this.#renderItems();
    this.#focusItem(i);
    const label = this.#labels.get(this.#order[i]!) ?? "";
    this.#announcer.announce(
      `Grabbed ${label}. ${this.#pos(i)} Use arrow keys to move, Space to drop, Escape to cancel.`,
    );
  }

  #move(delta: number): void {
    const from = this.#grabbed!;
    const to = from + delta;
    if (to < 0 || to >= this.#order.length) return; // no wrap, no announce
    [this.#order[from], this.#order[to]] = [this.#order[to]!, this.#order[from]!];
    this.#grabbed = to;
    this.#renderItems();
    this.#focusItem(to);
    this.#announcer.announce(this.#pos(to));
  }

  #drop(): void {
    const i = this.#grabbed!;
    this.#grabbed = null;
    this.#preGrab = null;
    this.#renderItems();
    this.#focusItem(i);
    this.#persist();
    const label = this.#labels.get(this.#order[i]!) ?? "";
    this.#announcer.announce(`Dropped ${label}. ${this.#pos(i)}`);
  }

  #cancel(): void {
    const value = this.#order[this.#grabbed!]!;
    this.#order = this.#preGrab!;
    this.#preGrab = null;
    this.#grabbed = null;
    const i = Math.max(0, this.#order.indexOf(value));
    this.#renderItems();
    this.#focusItem(i);
    this.#announcer.announce(`Cancelled. ${this.#labels.get(value) ?? value} returned to ${this.#pos(i)}`);
  }

  #check(): void {
    if (this.#locked) return;
    const g = gradeByPosition(this.#correct, this.#order);
    this.#submitted = true;
    this.#persist();
    this.emitInteraction({
      id: this.id,
      type: "sequencing",
      result: g.result,
      score: g.score,
      response: g.response,
    });
    this.#lockUp();
    this.#feedback.textContent =
      g.result === "passed"
        ? "Correct — every item is in the right place."
        : `${Math.round(g.score * this.#order.length)} of ${this.#order.length} in the right place.`;
    this.#feedback.focus?.();
  }

  #lockUp(): void {
    if (!this.hasAttribute("retry")) {
      this.#locked = true;
      const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]');
      if (submit) submit.disabled = true;
    }
    this.#renderItems();
    // Mark per-item correctness in text + part state (never colour alone).
    for (const btn of this.#ol.querySelectorAll<HTMLButtonElement>('[part~="item"]')) {
      const i = Number(btn.dataset.i);
      const ok = this.#order[i] === this.#correct[i];
      btn.part.add(ok ? "correct" : "incorrect");
      prependHidden(btn, ok ? "Correct position: " : "Wrong position: ");
    }
  }

  #persist(): void {
    this.saveState({ order: this.#order, submitted: this.#submitted } satisfies OrderingState);
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;");
function prependHidden(el: HTMLElement, text: string): void {
  const span = document.createElement("span");
  span.className = "oelt-visually-hidden";
  span.textContent = text;
  el.prepend(span);
}
