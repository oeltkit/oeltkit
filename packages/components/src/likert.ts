// <oelt-likert> — rating-scale / survey item. See specs/components/likert.md.
// Light DOM: enhances authored <oelt-option> children (or a generated numeric
// scale) into a native <fieldset> of radios. Survey semantics: no grading,
// always emits result "completed".

import { OeltElement, ensureStyles } from "./base.js";
import { likertScale, type ScalePoint } from "./likert-scale.js";

interface LikertState {
  sel: string;
  submitted: boolean;
}

export class OeltLikert extends OeltElement {
  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const prompt = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";
    const submitLabel = this.getAttribute("submit-label") ?? "Submit";

    // Scale: explicit <oelt-option> children, else a generated numeric scale.
    const authored = [...this.querySelectorAll("oelt-option")];
    let points: ScalePoint[];
    if (authored.length > 0) {
      points = authored.map((o) => ({
        value: o.getAttribute("value") ?? (o.textContent ?? "").trim(),
        label: (o.textContent ?? "").trim(),
      }));
    } else {
      points = likertScale(
        Number(this.getAttribute("scale") ?? "5"),
        this.getAttribute("low-label") ?? undefined,
        this.getAttribute("high-label") ?? undefined,
      );
    }

    const groupName = `${this.id}-scale`;
    this.innerHTML = `
      <fieldset part="group">
        <legend part="prompt">${prompt}</legend>
        ${points
          .map(
            (p, i) => `
          <label part="option" data-value="${escapeAttr(p.value)}">
            <input part="option-input" type="radio" name="${groupName}" value="${escapeAttr(p.value)}" id="${this.id}-p${i}" />
            <span part="option-label">${escapeHtml(p.label)}</span>
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

    const lock = (): void => {
      submit.disabled = true;
      inputs().forEach((i) => (i.disabled = true));
    };

    submit.addEventListener("click", () => {
      const chosen = inputs().find((i) => i.checked);
      if (!chosen) {
        feedback.textContent = "Select a rating first.";
        return;
      }
      this.saveState({ sel: chosen.value, submitted: true } satisfies LikertState);
      // Survey: always "completed", no score (likert.md §5).
      this.emitInteraction({ id: this.id, type: "likert", result: "completed", response: chosen.value });
      feedback.textContent = "Response recorded.";
      if (!this.hasAttribute("retry")) lock();
    });

    // Resume: restore selection + locked UI without re-emitting.
    const saved = this.loadState<LikertState | undefined>(undefined);
    if (saved) {
      for (const i of inputs()) i.checked = i.value === saved.sel;
      if (saved.submitted && !this.hasAttribute("retry")) lock();
    }
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;");
