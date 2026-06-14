// Shared base for all <oelt-*> elements. See specs/components/base.md.
//
// Components never touch the LMS or oelt.track directly — they emit an
// `oelt-interaction` DOM event (the runtime forwards it) and persist UI state
// through `oelt.state` (quota-enforced). No runtime dependency is bundled; the
// runtime is reached through the global `oelt` if present, and components
// degrade gracefully when it is absent (e.g. on a bare demo/axe page).

export type InteractionResult = "passed" | "failed" | "completed";

export interface InteractionDetail {
  id: string;
  type: string;
  result: InteractionResult;
  score?: number;
  response?: string;
}

interface OeltState {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}
interface OeltGlobal {
  state?: OeltState;
}
declare global {
  interface Window {
    oelt?: OeltGlobal;
  }
}

export class OeltElement extends HTMLElement {
  /** Emit the component → runtime interaction event (base.md §3). */
  protected emitInteraction(detail: InteractionDetail): void {
    this.dispatchEvent(
      new CustomEvent("oelt-interaction", { bubbles: true, composed: true, detail }),
    );
  }

  /** Load this element's persisted state (keyed by its id), or a fallback. */
  protected loadState<T>(fallback: T): T {
    const v = window.oelt?.state?.get(this.id);
    return v === undefined ? fallback : (v as T);
  }

  /** Persist this element's state. Swallows the quota error (logs) so a single
   *  oversized component can't break the page; the validator catches budgets. */
  protected saveState(value: unknown): void {
    try {
      window.oelt?.state?.set(this.id, value);
    } catch (err) {
      console.warn(`[oelt] state not saved for "${this.id}":`, (err as Error).message);
    }
  }

  protected get reducedMotion(): boolean {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  /**
   * Run `init` once the element's authored children are available. When the
   * component is defined before the parser reaches the element (e.g. the bundle
   * is in <head>), connectedCallback fires before children are parsed; defer to
   * DOMContentLoaded in that case. When children are injected via innerHTML the
   * document is already interactive, so init runs synchronously.
   */
  protected whenReady(init: () => void | Promise<void>): void {
    if (this.ownerDocument.readyState === "loading") {
      this.ownerDocument.addEventListener("DOMContentLoaded", () => void init(), { once: true });
    } else {
      void init();
    }
  }
}

let stylesInjected = false;

/** Inject the shared component stylesheet once. Uses only --oelt-* tokens (with
 *  fallbacks so components are usable before a theme loads). */
export function ensureStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.id = "oelt-components-styles";
  style.textContent = COMPONENT_CSS;
  document.head.appendChild(style);
}

const COMPONENT_CSS = `
oelt-mcq, oelt-branching, oelt-media, oelt-text-entry, oelt-quiz, oelt-likert { display: block; margin: var(--oelt-space-3, 1rem) 0; color: var(--oelt-color-fg, inherit); font: var(--oelt-font, inherit); }
oelt-option { display: none; }
oelt-likert fieldset { border: 1px solid var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); padding: var(--oelt-space-3, 1rem); }
oelt-likert [part~="option-label"] { display: flex; gap: var(--oelt-space-2, .5rem); align-items: baseline; padding: var(--oelt-space-1, .25rem) 0; }
oelt-likert [part~="submit"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-likert [part~="submit"]:disabled { opacity: .5; cursor: default; }
oelt-likert [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); }
oelt-quiz [part~="status"] { margin-top: var(--oelt-space-3, 1rem); padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); background: var(--oelt-color-bg, #f5f6f8); border: 1px solid var(--oelt-color-fg, #8889); }
oelt-quiz [part~="status"][part~="passed"] { color: var(--oelt-color-correct, #1a7f4b); border-color: var(--oelt-color-correct, #1a7f4b); }
oelt-quiz [part~="status"][part~="failed"] { color: var(--oelt-color-incorrect, #b3261e); border-color: var(--oelt-color-incorrect, #b3261e); }
oelt-text-entry [part~="prompt"] { display: block; margin-bottom: var(--oelt-space-2, .5rem); }
oelt-text-entry [part~="input"] { font: inherit; padding: var(--oelt-space-2, .5rem); border: 1px solid var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); background: var(--oelt-color-bg, #fff); color: var(--oelt-color-fg, inherit); margin-right: var(--oelt-space-2, .5rem); }
oelt-text-entry [part~="submit"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-text-entry [part~="submit"]:disabled, oelt-text-entry [part~="input"]:disabled { opacity: .5; cursor: default; }
oelt-text-entry [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); }
oelt-text-entry [part~="feedback"][part~="correct"] { color: var(--oelt-color-correct, #1a7f4b); }
oelt-text-entry [part~="feedback"][part~="incorrect"] { color: var(--oelt-color-incorrect, #b3261e); }
oelt-mcq fieldset { border: 1px solid var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); padding: var(--oelt-space-3, 1rem); }
oelt-mcq [part~="option-label"] { display: flex; gap: var(--oelt-space-2, .5rem); align-items: baseline; padding: var(--oelt-space-1, .25rem) 0; }
oelt-mcq [part~="submit"], oelt-branching [part~="choice"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-mcq [part~="submit"]:disabled { opacity: .5; cursor: default; }
oelt-mcq [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); }
oelt-mcq [part~="option"][part~="correct"] { color: var(--oelt-color-correct, #1a7f4b); }
oelt-mcq [part~="option"][part~="incorrect"] { color: var(--oelt-color-incorrect, #b3261e); }
oelt-branching [part~="choices"] { display: flex; flex-wrap: wrap; gap: var(--oelt-space-2, .5rem); margin-top: var(--oelt-space-3, 1rem); }
oelt-branching [part~="node"]:focus { outline: 2px solid var(--oelt-color-focus, #4da3ff); outline-offset: 2px; }
oelt-media [part~="error"] { border: 2px solid var(--oelt-color-incorrect, #b3261e); color: var(--oelt-color-incorrect, #b3261e); padding: var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); }
oelt-media [part~="transcript-toggle"] { font: inherit; margin-top: var(--oelt-space-2, .5rem); }
oelt-media video, oelt-media audio { max-width: 100%; }
.oelt-visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
*:focus-visible { outline: 2px solid var(--oelt-color-focus, #4da3ff); outline-offset: 2px; }
`;
