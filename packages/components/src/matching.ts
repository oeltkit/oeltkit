// <oelt-matching> — match values to prompts. See specs/components/matching.md
// and dnd-family.md. Light DOM: enhances <oelt-pair>s into prompt rows (each
// with a drop target) + a bank of shuffled value buttons. Keyboard pick-up/
// move/drop via the shared GrabController; pointer drag is an enhancement.

import { OeltElement, ensureStyles } from "./base.js";
import { LiveAnnouncer, GrabController, shuffleDifferent } from "./dnd.js";
import { gradeMatching, type Pair } from "./matching-grade.js";

/** Inert data-carrier for a prompt↔value pair (consumed on upgrade). */
export class OeltPair extends HTMLElement {}

interface MatchingState {
  placed: Record<string, string>;
  submitted: boolean;
}

export class OeltMatching extends OeltElement {
  #pairs: Pair[] = [];
  #labels = new Map<string, string>(); // value → visible label
  #values: string[] = []; // stable value order (authored) → data-vi
  #placed = new Map<string, string>(); // value → prompt
  #grab: { value: string; cursor: number; pre: Map<string, string> } | null = null;
  #submitted = false;
  #locked = false;
  #root!: HTMLElement;
  #feedback!: HTMLElement;
  #announcer = new LiveAnnouncer();
  #grabCtl = new GrabController({
    isGrabbed: () => this.#grab !== null,
    pickUp: (vi) => this.#pickUp(vi),
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

  get #n(): number {
    return this.#pairs.length; // bank cursor index
  }

  #init(): void {
    for (const el of this.querySelectorAll("oelt-pair")) {
      const prompt = el.getAttribute("prompt") ?? "";
      const value = el.getAttribute("value") ?? (el.textContent ?? "").trim();
      this.#pairs.push({ prompt, value });
      this.#labels.set(value, (el.textContent ?? "").trim());
      this.#values.push(value);
    }
    const promptHtml = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";
    const submitLabel = this.getAttribute("submit-label") ?? "Check matches";

    const saved = this.loadState<MatchingState | undefined>(undefined);
    if (saved) {
      for (const [v, p] of Object.entries(saved.placed)) {
        if (this.#labels.has(v) && this.#pairs.some((pr) => pr.prompt === p)) this.#placed.set(v, p);
      }
      this.#submitted = saved.submitted;
    }
    // Shuffle the bank order (values not placed start in the bank).
    this.#values = shuffleDifferent(this.#values);

    const promptId = `${this.id}-prompt`;
    this.innerHTML = `
      <div part="prompt" id="${promptId}">${promptHtml}</div>
      <ul part="prompts" aria-labelledby="${promptId}"></ul>
      <div part="bank" aria-label="Unplaced answers"></div>
      <button part="submit" type="button">${escapeHtml(submitLabel)}</button>
      <div part="feedback" role="status" aria-live="polite" tabindex="-1"></div>`;
    this.#root = this;
    this.#feedback = this.querySelector<HTMLElement>('[part~="feedback"]')!;
    this.appendChild(this.#announcer.region);

    this.#render();
    this.#wire();
    this.querySelector<HTMLButtonElement>('[part~="submit"]')!.addEventListener("click", () =>
      this.#check(),
    );
    if (this.#submitted) this.#lockUp();
  }

  #valueButton(value: string): string {
    const vi = this.#values.indexOf(value);
    const grabbed = this.#grab?.value === value ? " grabbed" : "";
    return `<button part="value${grabbed}" type="button" draggable="${!this.#locked}" data-value="${escapeAttr(
      value,
    )}" data-vi="${vi}">${escapeHtml(this.#labels.get(value) ?? value)}</button>`;
  }

  #render(): void {
    const inverse = new Map<string, string>(); // prompt → value
    for (const [v, p] of this.#placed) inverse.set(p, v);

    const prompts = this.querySelector<HTMLElement>('[part~="prompts"]')!;
    prompts.innerHTML = this.#pairs
      .map((p, i) => {
        const placedValue = inverse.get(p.prompt);
        return `<li part="prompt-row"><span part="prompt-label">${escapeHtml(
          p.prompt,
        )}</span><span part="target" data-pi="${i}" data-prompt="${escapeAttr(p.prompt)}">${
          placedValue ? this.#valueButton(placedValue) : ""
        }</span></li>`;
      })
      .join("");

    const bank = this.querySelector<HTMLElement>('[part~="bank"]')!;
    bank.innerHTML = this.#values
      .filter((v) => !this.#placed.has(v))
      .map((v) => this.#valueButton(v))
      .join("");
  }

  #wire(): void {
    this.#root.addEventListener("keydown", (e) => {
      if (this.#locked) return;
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[part~="value"]');
      if (!btn) return;
      this.#grabCtl.handleKey(e as KeyboardEvent, Number(btn.dataset.vi));
    });

    // Pointer drag (enhancement): drop a value on a target or the bank.
    this.#root.addEventListener("dragstart", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[part~="value"]');
      if (!btn || this.#locked) return;
      (e as DragEvent).dataTransfer?.setData("text/plain", btn.dataset.value ?? "");
    });
    this.#root.addEventListener("dragover", (e) => {
      if (this.#locked) return;
      if ((e.target as HTMLElement).closest('[part~="target"], [part~="bank"]')) e.preventDefault();
    });
    this.#root.addEventListener("drop", (e) => {
      if (this.#locked) return;
      const value = (e as DragEvent).dataTransfer?.getData("text/plain");
      if (!value) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>('[part~="target"]');
      const bank = (e.target as HTMLElement).closest('[part~="bank"]');
      if (target) {
        e.preventDefault();
        this.#place(value, Number(target.dataset.pi));
        this.#announceDrop(value, Number(target.dataset.pi));
      } else if (bank) {
        e.preventDefault();
        this.#place(value, this.#n);
        this.#announceDrop(value, this.#n);
      }
    });
  }

  #posLabel(pos: number): string {
    return pos < this.#n ? `Target: ${this.#pairs[pos]!.prompt}.` : "Bank.";
  }

  #currentPos(value: string): number {
    const prompt = this.#placed.get(value);
    if (prompt === undefined) return this.#n; // bank
    return this.#pairs.findIndex((p) => p.prompt === prompt);
  }

  #setCursorHighlight(pos: number): void {
    for (const t of this.querySelectorAll<HTMLElement>('[part~="target"]')) t.part.remove("cursor");
    const bank = this.querySelector<HTMLElement>('[part~="bank"]')!;
    bank.part.remove("cursor");
    if (pos < this.#n) this.querySelector<HTMLElement>(`[data-pi="${pos}"]`)?.part.add("cursor");
    else bank.part.add("cursor");
  }

  #focusValue(value: string): void {
    this.querySelector<HTMLButtonElement>(`[data-value="${cssEscape(value)}"]`)?.focus();
  }

  #pickUp(vi: number): void {
    const value = this.#values[vi]!;
    const cursor = this.#currentPos(value);
    this.#grab = { value, cursor, pre: new Map(this.#placed) };
    this.querySelector<HTMLElement>(`[data-value="${cssEscape(value)}"]`)?.part.add("grabbed");
    this.#setCursorHighlight(cursor);
    this.#announcer.announce(
      `Grabbed ${this.#labels.get(value) ?? value}. ${this.#posLabel(
        cursor,
      )} Use left and right arrows to move, Space to drop, Escape to cancel.`,
    );
  }

  #move(delta: -1 | 1): void {
    const next = this.#grab!.cursor + delta;
    if (next < 0 || next > this.#n) return; // no wrap
    this.#grab!.cursor = next;
    this.#setCursorHighlight(next);
    this.#announcer.announce(this.#posLabel(next));
  }

  #drop(): void {
    const { value, cursor } = this.#grab!;
    this.#grab = null;
    this.#place(value, cursor);
    this.#announceDrop(value, cursor);
  }

  #cancel(): void {
    const { value, pre } = this.#grab!;
    this.#placed = pre;
    this.#grab = null;
    this.#render();
    this.#focusValue(value);
    this.#announcer.announce(
      `Cancelled. ${this.#labels.get(value) ?? value} returned to ${this.#posLabel(
        this.#currentPos(value),
      )}`,
    );
  }

  /** Place `value` at prompt index `pos` (or the bank when pos === n), displacing any occupant. */
  #place(value: string, pos: number): void {
    if (pos >= this.#n) {
      this.#placed.delete(value); // to bank
    } else {
      const prompt = this.#pairs[pos]!.prompt;
      // Displace whatever currently sits on this prompt back to the bank.
      for (const [v, p] of [...this.#placed]) if (p === prompt) this.#placed.delete(v);
      this.#placed.set(value, prompt);
    }
    this.#persist();
    this.#render();
    this.#focusValue(value);
  }

  #announceDrop(value: string, pos: number): void {
    const label = this.#labels.get(value) ?? value;
    this.#announcer.announce(
      pos < this.#n ? `Dropped ${label} on ${this.#pairs[pos]!.prompt}.` : `Dropped ${label} in bank.`,
    );
  }

  #check(): void {
    if (this.#locked) return;
    const placedObj = Object.fromEntries(this.#placed);
    const g = gradeMatching(this.#pairs, placedObj);
    this.#submitted = true;
    this.#persist();
    this.emitInteraction({
      id: this.id,
      type: "matching",
      result: g.result,
      score: g.score,
      response: g.response,
    });
    this.#lockUp();
    const correctCount = Math.round(g.score * this.#n);
    this.#feedback.textContent =
      g.result === "passed"
        ? "Correct — every match is right."
        : `${correctCount} of ${this.#n} matched correctly.`;
    this.#feedback.focus();
  }

  #lockUp(): void {
    if (!this.hasAttribute("retry")) {
      this.#locked = true;
      const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]');
      if (submit) submit.disabled = true;
    }
    this.#render();
    // Mark per-target correctness in text + part state.
    const inverse = new Map<string, string>();
    for (const [v, p] of this.#placed) inverse.set(p, v);
    for (const target of this.querySelectorAll<HTMLElement>('[part~="target"]')) {
      const i = Number(target.dataset.pi);
      const ok = inverse.get(this.#pairs[i]!.prompt) === this.#pairs[i]!.value;
      target.part.add(ok ? "correct" : "incorrect");
      const tag = document.createElement("span");
      tag.className = "oelt-visually-hidden";
      tag.textContent = ok ? "Correct match: " : "Wrong match: ";
      target.prepend(tag);
    }
  }

  #persist(): void {
    this.saveState({
      placed: Object.fromEntries(this.#placed),
      submitted: this.#submitted,
    } satisfies MatchingState);
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;");
// Minimal CSS.escape fallback for attribute selectors on value ids.
const cssEscape = (s: string): string =>
  (globalThis.CSS?.escape ?? ((x: string) => x.replace(/["\\]/g, "\\$&")))(s);
