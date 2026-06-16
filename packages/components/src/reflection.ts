// <oelt-reflection> — open-ended free-text response. See reflection.md.
// Light DOM. Not auto-graded: captures text and reports a completed fill-in.
// On Save it also fires the `oelt-reflection` evaluation hook (an event contract
// for a future Tier-3 cloud LLM evaluator); v0 ships no evaluator.

import { OeltElement, ensureStyles } from "./base.js";

interface ReflectionState {
  text: string;
  submitted: boolean;
}

/** detail of the `oelt-reflection` evaluation-hook event (reflection.md §5). */
export interface ReflectionEventDetail {
  id: string;
  text: string;
  /** An evaluator calls this to surface qualitative feedback. v0 never does. */
  provideFeedback(feedback: { message: string }): void;
}

export class OeltReflection extends OeltElement {
  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const prompt = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";
    const maxlength = Math.max(1, Number(this.getAttribute("maxlength") ?? "500") || 500);
    const rows = Math.max(1, Number(this.getAttribute("rows") ?? "4") || 4);
    const submitLabel = this.getAttribute("submit-label") ?? "Save";
    const inputId = `${this.id}-input`;
    const countId = `${this.id}-count`;

    this.innerHTML = `
      <label part="prompt" for="${inputId}">${prompt}</label>
      <textarea part="input" id="${inputId}" rows="${rows}" maxlength="${maxlength}" aria-describedby="${countId}"></textarea>
      <div part="count" id="${countId}" aria-live="polite"></div>
      <button part="submit" type="button">${escapeHtml(submitLabel)}</button>
      <div part="feedback" role="status" aria-live="polite" tabindex="-1"></div>`;

    const input = this.querySelector<HTMLTextAreaElement>('[part~="input"]')!;
    const count = this.querySelector<HTMLElement>('[part~="count"]')!;
    const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]')!;
    const feedback = this.querySelector<HTMLElement>('[part~="feedback"]')!;

    const updateCount = (): void => {
      count.textContent = `${maxlength - input.value.length} characters remaining`;
    };
    input.addEventListener("input", updateCount);

    submit.addEventListener("click", () => {
      const text = input.value.trim();
      if (text === "") {
        feedback.textContent = "Write a response first.";
        return;
      }
      this.saveState({ text: input.value, submitted: true } satisfies ReflectionState);

      // 1. Record the reflection as a completed (ungraded) interaction.
      this.emitInteraction({
        id: this.id,
        type: "fill-in",
        result: "completed",
        response: input.value,
      });
      feedback.textContent = "Response saved.";
      feedback.focus();

      // 2. Fire the evaluation hook (reflection.md §5). v0: nothing listens.
      const detail: ReflectionEventDetail = {
        id: this.id,
        text: input.value,
        provideFeedback: ({ message }) => {
          feedback.textContent = message;
        },
      };
      this.dispatchEvent(
        new CustomEvent("oelt-reflection", { bubbles: true, composed: true, detail }),
      );
    });

    // Resume: restore text + saved feedback without re-emitting.
    const saved = this.loadState<ReflectionState | undefined>(undefined);
    if (saved) {
      input.value = saved.text;
      if (saved.submitted) feedback.textContent = "Response saved.";
    }
    updateCount();
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
