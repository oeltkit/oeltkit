// <oelt-categorize> — sort tokens into category buckets. See categorize.md and
// dnd-family.md. Light DOM: enhances <oelt-bucket>s + <oelt-token>s into a row
// of buckets (multi-occupancy drop zones) + a bank of shuffled tokens. Keyboard
// pick-up/move/drop via the shared GrabController; pointer drag is enhancement.

import { OeltElement, ensureStyles } from "./base.js";
import { LiveAnnouncer, GrabController, shuffleDifferent } from "./dnd.js";
import { gradeCategorize, type Token } from "./categorize-grade.js";

/** Inert data-carriers (consumed on upgrade). */
export class OeltBucket extends HTMLElement {}
export class OeltToken extends HTMLElement {}

interface CategorizeState {
  placed: Record<string, string>;
  submitted: boolean;
}

export class OeltCategorize extends OeltElement {
  #buckets: { value: string; label: string }[] = [];
  #tokens: Token[] = [];
  #labels = new Map<string, string>(); // token value → label
  #values: string[] = []; // stable token order → data-vi
  #placed = new Map<string, string>(); // token → bucket
  #grab: { value: string; cursor: number; pre: Map<string, string> } | null = null;
  #submitted = false;
  #locked = false;
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
    return this.#buckets.length; // bank cursor index
  }

  #init(): void {
    for (const b of this.querySelectorAll("oelt-bucket")) {
      this.#buckets.push({
        value: b.getAttribute("value") ?? (b.textContent ?? "").trim(),
        label: (b.textContent ?? "").trim(),
      });
    }
    for (const t of this.querySelectorAll("oelt-token")) {
      const value = t.getAttribute("value") ?? (t.textContent ?? "").trim();
      this.#tokens.push({ value, bucket: t.getAttribute("bucket") ?? "" });
      this.#labels.set(value, (t.textContent ?? "").trim());
      this.#values.push(value);
    }
    const promptHtml = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";
    const submitLabel = this.getAttribute("submit-label") ?? "Check";

    const saved = this.loadState<CategorizeState | undefined>(undefined);
    if (saved) {
      const bucketValues = new Set(this.#buckets.map((b) => b.value));
      for (const [tok, bk] of Object.entries(saved.placed)) {
        if (this.#labels.has(tok) && bucketValues.has(bk)) this.#placed.set(tok, bk);
      }
      this.#submitted = saved.submitted;
    }
    this.#values = shuffleDifferent(this.#values);

    const promptId = `${this.id}-prompt`;
    this.innerHTML = `
      <div part="prompt" id="${promptId}">${promptHtml}</div>
      <div part="buckets" role="group" aria-labelledby="${promptId}"></div>
      <div part="bank" aria-label="Unsorted items"></div>
      <button part="submit" type="button">${escapeHtml(submitLabel)}</button>
      <div part="feedback" role="status" aria-live="polite" tabindex="-1"></div>`;
    this.#feedback = this.querySelector<HTMLElement>('[part~="feedback"]')!;
    this.appendChild(this.#announcer.region);

    this.#render();
    this.#wire();
    this.querySelector<HTMLButtonElement>('[part~="submit"]')!.addEventListener("click", () =>
      this.#check(),
    );
    if (this.#submitted) this.#lockUp();
  }

  #tokenButton(value: string): string {
    const vi = this.#values.indexOf(value);
    const grabbed = this.#grab?.value === value ? " grabbed" : "";
    return `<button part="token${grabbed}" type="button" draggable="${!this.#locked}" data-value="${escapeAttr(
      value,
    )}" data-vi="${vi}">${escapeHtml(this.#labels.get(value) ?? value)}</button>`;
  }

  #render(): void {
    const byBucket = new Map<string, string[]>(); // bucket value → token values
    for (const b of this.#buckets) byBucket.set(b.value, []);
    for (const [tok, bk] of this.#placed) byBucket.get(bk)?.push(tok);

    const buckets = this.querySelector<HTMLElement>('[part~="buckets"]')!;
    buckets.innerHTML = this.#buckets
      .map(
        (b, i) =>
          `<div part="bucket" data-bi="${i}" data-bucket="${escapeAttr(b.value)}"><span part="bucket-label">${escapeHtml(
            b.label,
          )}</span><div part="bucket-items">${(byBucket.get(b.value) ?? [])
            .map((t) => this.#tokenButton(t))
            .join("")}</div></div>`,
      )
      .join("");

    const bank = this.querySelector<HTMLElement>('[part~="bank"]')!;
    bank.innerHTML = this.#values
      .filter((v) => !this.#placed.has(v))
      .map((v) => this.#tokenButton(v))
      .join("");
  }

  #wire(): void {
    this.addEventListener("keydown", (e) => {
      if (this.#locked) return;
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[part~="token"]');
      if (!btn) return;
      this.#grabCtl.handleKey(e as KeyboardEvent, Number(btn.dataset.vi));
    });

    this.addEventListener("dragstart", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[part~="token"]');
      if (!btn || this.#locked) return;
      (e as DragEvent).dataTransfer?.setData("text/plain", btn.dataset.value ?? "");
    });
    this.addEventListener("dragover", (e) => {
      if (this.#locked) return;
      if ((e.target as HTMLElement).closest('[part~="bucket"], [part~="bank"]')) e.preventDefault();
    });
    this.addEventListener("drop", (e) => {
      if (this.#locked) return;
      const value = (e as DragEvent).dataTransfer?.getData("text/plain");
      if (!value) return;
      const bucket = (e.target as HTMLElement).closest<HTMLElement>('[part~="bucket"]');
      const bank = (e.target as HTMLElement).closest('[part~="bank"]');
      if (bucket) {
        e.preventDefault();
        this.#place(value, Number(bucket.dataset.bi));
        this.#announceDrop(value, Number(bucket.dataset.bi));
      } else if (bank) {
        e.preventDefault();
        this.#place(value, this.#n);
        this.#announceDrop(value, this.#n);
      }
    });
  }

  #posLabel(pos: number): string {
    return pos < this.#n ? `Bucket: ${this.#buckets[pos]!.label}.` : "Bank.";
  }

  #currentPos(value: string): number {
    const bucket = this.#placed.get(value);
    if (bucket === undefined) return this.#n;
    return this.#buckets.findIndex((b) => b.value === bucket);
  }

  #setCursorHighlight(pos: number): void {
    for (const b of this.querySelectorAll<HTMLElement>('[part~="bucket"]')) b.part.remove("cursor");
    const bank = this.querySelector<HTMLElement>('[part~="bank"]')!;
    bank.part.remove("cursor");
    if (pos < this.#n) this.querySelector<HTMLElement>(`[data-bi="${pos}"]`)?.part.add("cursor");
    else bank.part.add("cursor");
  }

  #focusToken(value: string): void {
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
    if (next < 0 || next > this.#n) return;
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
    this.#focusToken(value);
    this.#announcer.announce(
      `Cancelled. ${this.#labels.get(value) ?? value} returned to ${this.#posLabel(
        this.#currentPos(value),
      )}`,
    );
  }

  /** Place `value` into bucket index `pos` (or the bank when pos === n). Buckets hold many. */
  #place(value: string, pos: number): void {
    if (pos >= this.#n) this.#placed.delete(value);
    else this.#placed.set(value, this.#buckets[pos]!.value);
    this.#persist();
    this.#render();
    this.#focusToken(value);
  }

  #announceDrop(value: string, pos: number): void {
    const label = this.#labels.get(value) ?? value;
    this.#announcer.announce(
      pos < this.#n ? `Dropped ${label} in ${this.#buckets[pos]!.label}.` : `Dropped ${label} in bank.`,
    );
  }

  #check(): void {
    if (this.#locked) return;
    const g = gradeCategorize(this.#tokens, Object.fromEntries(this.#placed));
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
    const correct = Math.round(g.score * this.#tokens.length);
    this.#feedback.textContent =
      g.result === "passed"
        ? "Correct — every item is in the right group."
        : `${correct} of ${this.#tokens.length} sorted correctly.`;
    this.#feedback.focus();
  }

  #lockUp(): void {
    if (!this.hasAttribute("retry")) {
      this.#locked = true;
      const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]');
      if (submit) submit.disabled = true;
    }
    this.#render();
    const correctBucket = new Map(this.#tokens.map((t) => [t.value, t.bucket]));
    for (const btn of this.querySelectorAll<HTMLButtonElement>('[part~="token"]')) {
      const value = btn.dataset.value!;
      const ok = this.#placed.get(value) === correctBucket.get(value);
      btn.part.add(ok ? "correct" : "incorrect");
      const tag = document.createElement("span");
      tag.className = "oelt-visually-hidden";
      tag.textContent = ok ? "Correct: " : "Wrong: ";
      btn.prepend(tag);
    }
  }

  #persist(): void {
    this.saveState({
      placed: Object.fromEntries(this.#placed),
      submitted: this.#submitted,
    } satisfies CategorizeState);
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;");
const cssEscape = (s: string): string =>
  (globalThis.CSS?.escape ?? ((x: string) => x.replace(/["\\]/g, "\\$&")))(s);
