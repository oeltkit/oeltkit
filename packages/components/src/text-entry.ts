// <oelt-text-entry> — short text / numeric response. See specs/components/text-entry.md.
// Light DOM: enhances authored prompt/feedback markup into a native
// <label> + <input> + submit button. Native semantics carry keyboard + SR.

import { OeltElement, ensureStyles, type InteractionResult } from "./base.js";
import { gradeText, gradeNumeric, parseAnswers, type TextGrade } from "./grade-text.js";

interface TextEntryState {
  val: string;
  submitted: boolean;
}

export class OeltTextEntry extends OeltElement {
  #mode: "text" | "numeric" = "text";

  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    this.#mode = this.getAttribute("mode") === "numeric" ? "numeric" : "text";
    const manual = this.hasAttribute("manual-grade");
    const caseSensitive = this.hasAttribute("case-sensitive");
    const answers = parseAnswers(this.getAttribute("answer") ?? "");
    const tolerance = Math.max(0, Number(this.getAttribute("tolerance") ?? "0") || 0);

    const prompt = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";
    const correctFb = this.querySelector('[slot="correct"]')?.innerHTML ?? "Correct.";
    const incorrectFb = this.querySelector('[slot="incorrect"]')?.innerHTML ?? "Not quite.";
    const submitLabel = this.getAttribute("submit-label") ?? "Check answer";
    const placeholder = this.getAttribute("placeholder") ?? "";

    const inputId = `${this.id}-input`;
    // numeric uses a text input + inputmode=decimal (text-entry.md §7), never type=number.
    const inputModeAttr = this.#mode === "numeric" ? ' inputmode="decimal"' : "";

    this.innerHTML = `
      <label part="prompt" for="${inputId}">${prompt}</label>
      <input part="input" id="${inputId}" type="text"${inputModeAttr}
        ${placeholder ? `placeholder="${escapeAttr(placeholder)}"` : ""} autocomplete="off" />
      <button part="submit" type="button">${escapeHtml(submitLabel)}</button>
      <div part="feedback" role="status" aria-live="polite"></div>`;

    const input = this.querySelector<HTMLInputElement>('[part~="input"]')!;
    const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]')!;
    const feedback = this.querySelector<HTMLElement>('[part~="feedback"]')!;

    const lock = (): void => {
      submit.disabled = true;
      input.disabled = true;
    };

    const showResult = (result: InteractionResult, fb: string): void => {
      feedback.innerHTML = fb;
      feedback.part.remove("correct", "incorrect");
      if (!manual) {
        feedback.part.add(result === "passed" ? "correct" : "incorrect");
        prependHidden(feedback, result === "passed" ? "Correct: " : "Incorrect: ");
      }
      if (!this.hasAttribute("retry")) lock();
    };

    const doSubmit = (): void => {
      const raw = input.value;
      if (raw.trim() === "") {
        feedback.textContent = "Enter an answer first.";
        return;
      }
      this.saveState({ val: raw, submitted: true } satisfies TextEntryState);

      if (manual) {
        this.emitInteraction({ id: this.id, type: "fill-in", result: "completed", response: raw });
        showResult("completed", correctFb);
        return;
      }

      const g: TextGrade =
        this.#mode === "numeric"
          ? gradeNumeric(Number(answers[0] ?? "NaN"), tolerance, raw)
          : gradeText(answers, raw, caseSensitive);

      this.emitInteraction({
        id: this.id,
        type: this.#mode === "numeric" ? "numeric" : "fill-in",
        result: g.result,
        score: g.score,
        response: g.response,
      });
      showResult(g.result, g.result === "passed" ? correctFb : incorrectFb);
    };

    submit.addEventListener("click", doSubmit);
    // Enter in the single-line input submits (text-entry.md §6).
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSubmit();
      }
    });

    // Resume: restore entered value + submitted UI without re-emitting.
    const saved = this.loadState<TextEntryState | undefined>(undefined);
    if (saved) {
      input.value = saved.val;
      if (saved.submitted && !this.hasAttribute("retry")) lock();
    }
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
