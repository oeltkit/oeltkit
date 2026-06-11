// <oelt-mcq> — multiple choice / multiple response. See specs/components/mcq.md.
// Light DOM: enhances authored <oelt-option> children into a native
// <fieldset> of radios/checkboxes. Native semantics carry keyboard + SR.

import { OeltElement, ensureStyles, type InteractionResult } from "./base.js";
import { grade } from "./grade.js";

/** Inert data-carrier element for an option (removed on <oelt-mcq> upgrade). */
export class OeltOption extends HTMLElement {}

interface McqState {
  sel: string[];
  submitted: boolean;
}

export class OeltMcq extends OeltElement {
  #mode: "single" | "multiple" = "single";
  #key: string[] = [];

  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    this.#mode = this.getAttribute("mode") === "multiple" ? "multiple" : "single";
    this.#key = (this.getAttribute("key") ?? "").split(/\s+/).filter(Boolean);
    const manual = this.hasAttribute("manual-grade");

    const prompt = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";
    const correctFb = this.querySelector('[slot="correct"]')?.innerHTML ?? "Correct.";
    const incorrectFb = this.querySelector('[slot="incorrect"]')?.innerHTML ?? "Not quite.";
    let options = [...this.querySelectorAll("oelt-option")].map((o) => ({
      value: o.getAttribute("value") ?? (o.textContent ?? "").trim(),
      label: (o.textContent ?? "").trim(),
    }));
    if (this.hasAttribute("shuffle")) options = shuffle(options);

    const inputType = this.#mode === "single" ? "radio" : "checkbox";
    const groupName = `${this.id}-opts`;
    const submitLabel = this.getAttribute("submit-label") ?? "Check answer";

    this.innerHTML = `
      <fieldset part="group">
        <legend part="prompt">${prompt}</legend>
        ${options
          .map(
            (o, i) => `
          <label part="option" data-value="${escapeAttr(o.value)}">
            <input part="option-input" type="${inputType}" name="${groupName}" value="${escapeAttr(o.value)}" id="${this.id}-o${i}" />
            <span part="option-label">${escapeHtml(o.label)}</span>
          </label>`,
          )
          .join("")}
      </fieldset>
      <button part="submit" type="button">${escapeHtml(submitLabel)}</button>
      <div part="feedback" role="status" aria-live="polite"></div>`;

    const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]')!;
    const feedback = this.querySelector<HTMLElement>('[part~="feedback"]')!;
    const inputs = (): HTMLInputElement[] => [
      ...this.querySelectorAll<HTMLInputElement>('[part~="option-input"]'),
    ];

    const showResult = (result: InteractionResult, fb: string): void => {
      feedback.innerHTML = fb;
      if (!this.hasAttribute("retry")) {
        submit.disabled = true;
        inputs().forEach((i) => (i.disabled = true));
      }
      // Mark correctness on options (text + part state, never colour alone).
      for (const label of this.querySelectorAll<HTMLElement>('[part~="option"]')) {
        const v = label.dataset.value ?? "";
        const isKey = this.#key.includes(v);
        label.part.remove("correct", "incorrect");
        if (!manual && isKey) {
          label.part.add("correct");
          prependHidden(label, "Correct answer: ");
        }
      }
      void result;
    };

    submit.addEventListener("click", () => {
      const chosen = inputs()
        .filter((i) => i.checked)
        .map((i) => i.value);
      if (chosen.length === 0) {
        feedback.textContent = "Select an answer first.";
        return;
      }
      this.saveState({ sel: chosen, submitted: true } satisfies McqState);

      if (manual) {
        this.emitInteraction({
          id: this.id,
          type: "choice",
          result: "completed",
          response: chosen.join(","),
        });
        showResult("completed", correctFb);
        return;
      }
      const g = grade(this.#mode, this.#key, chosen);
      this.emitInteraction({
        id: this.id,
        type: "choice",
        result: g.result,
        score: g.score,
        response: g.response,
      });
      showResult(g.result, g.result === "passed" ? correctFb : incorrectFb);
    });

    // Resume: restore selection + submitted UI without re-emitting.
    const saved = this.loadState<McqState | undefined>(undefined);
    if (saved) {
      for (const i of inputs()) i.checked = saved.sel.includes(i.value);
      if (saved.submitted && !this.hasAttribute("retry")) {
        submit.disabled = true;
        inputs().forEach((i) => (i.disabled = true));
      }
    }
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
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
