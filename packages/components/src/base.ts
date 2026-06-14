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
oelt-mcq, oelt-branching, oelt-media, oelt-text-entry, oelt-quiz, oelt-likert, oelt-ordering, oelt-matching, oelt-categorize, oelt-tabs, oelt-accordion, oelt-flip-cards, oelt-hotspot, oelt-reflection { display: block; margin: var(--oelt-space-3, 1rem) 0; color: var(--oelt-color-fg, inherit); font: var(--oelt-font, inherit); }
oelt-option, oelt-item, oelt-pair, oelt-bucket, oelt-token, oelt-tab, oelt-panel, oelt-card, oelt-area { display: none; }
oelt-reflection [part~="prompt"] { display: block; margin-bottom: var(--oelt-space-2, .5rem); }
oelt-reflection [part~="input"] { display: block; width: 100%; box-sizing: border-box; font: inherit; padding: var(--oelt-space-2, .5rem); border: 1px solid var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); background: var(--oelt-color-bg, #fff); color: var(--oelt-color-fg, inherit); resize: vertical; }
oelt-reflection [part~="count"] { font-size: .85em; opacity: .8; margin: var(--oelt-space-1, .25rem) 0; }
oelt-reflection [part~="submit"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-reflection [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); outline: none; }
oelt-hotspot [part~="stage"] { position: relative; display: inline-block; max-width: 100%; }
oelt-hotspot [part~="image"] { display: block; max-width: 100%; height: auto; }
oelt-hotspot [part~="hotspot"] { position: absolute; box-sizing: border-box; font: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: var(--oelt-space-1, .25rem); border: 2px solid var(--oelt-color-primary, #357); border-radius: var(--oelt-radius, 6px); background: color-mix(in srgb, var(--oelt-color-bg, #fff) 70%, transparent); color: var(--oelt-color-fg, inherit); }
oelt-hotspot [part~="marker"] { visibility: hidden; font-weight: 700; }
oelt-hotspot [part~="hotspot"][part~="selected"] [part~="marker"] { visibility: visible; }
oelt-hotspot [part~="hotspot"][part~="selected"] { border-width: 3px; background: color-mix(in srgb, var(--oelt-color-primary, #357) 25%, var(--oelt-color-bg, #fff)); }
oelt-hotspot [part~="hotspot"][part~="correct"] { border-color: var(--oelt-color-correct, #1a7f4b); }
oelt-hotspot [part~="hotspot"][part~="incorrect"] { border-color: var(--oelt-color-incorrect, #b3261e); }
oelt-hotspot [part~="submit"] { font: inherit; cursor: pointer; margin-top: var(--oelt-space-3, 1rem); padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-hotspot [part~="submit"]:disabled { opacity: .5; cursor: default; }
oelt-hotspot [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); outline: none; }
oelt-tabs [part~="tablist"] { display: flex; flex-wrap: wrap; gap: var(--oelt-space-1, .25rem); border-bottom: 1px solid var(--oelt-color-fg, #8889); }
oelt-tabs [part~="tab"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border: 1px solid transparent; border-bottom: none; border-radius: var(--oelt-radius, 6px) var(--oelt-radius, 6px) 0 0; background: transparent; color: var(--oelt-color-fg, inherit); }
oelt-tabs [part~="tab"][part~="selected"] { border-color: var(--oelt-color-fg, #8889); background: var(--oelt-color-bg, #fff); font-weight: 600; }
oelt-tabs [part~="panel"] { padding: var(--oelt-space-3, 1rem); }
oelt-accordion [part~="panel"] { border: 1px solid var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); margin-bottom: var(--oelt-space-2, .5rem); }
oelt-accordion [part~="summary"] { cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); font-weight: 600; }
oelt-accordion [part~="content"] { padding: 0 var(--oelt-space-3, 1rem) var(--oelt-space-3, 1rem); }
oelt-flip-cards [part~="grid"] { display: flex; flex-wrap: wrap; gap: var(--oelt-space-3, 1rem); }
oelt-flip-cards [part~="card"] { font: inherit; cursor: pointer; flex: 1 1 10rem; min-height: 6rem; padding: var(--oelt-space-3, 1rem); border: 1px solid var(--oelt-color-primary, #357); border-radius: var(--oelt-radius, 6px); background: var(--oelt-color-bg, #fff); color: var(--oelt-color-fg, inherit); transition: transform var(--oelt-motion-duration, .2s); }
oelt-flip-cards [part~="card"][part~="flipped"] { background: var(--oelt-color-bg, #eef0f4); }
oelt-flip-cards [part~="front"] { font-weight: 600; }
@media (prefers-reduced-motion: reduce) { oelt-flip-cards [part~="card"] { transition: none; } }
oelt-categorize [part~="buckets"] { display: flex; flex-wrap: wrap; gap: var(--oelt-space-3, 1rem); margin: var(--oelt-space-3, 1rem) 0; }
oelt-categorize [part~="bucket"] { flex: 1 1 8rem; min-height: 4rem; padding: var(--oelt-space-2, .5rem); border: 1px dashed var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); }
oelt-categorize [part~="bucket-label"] { display: block; font-weight: 600; margin-bottom: var(--oelt-space-2, .5rem); }
oelt-categorize [part~="bucket-items"] { display: flex; flex-wrap: wrap; gap: var(--oelt-space-2, .5rem); }
oelt-categorize [part~="bucket"][part~="cursor"], oelt-categorize [part~="bank"][part~="cursor"] { outline: 2px solid var(--oelt-color-primary, #357); outline-offset: 2px; }
oelt-categorize [part~="bank"] { display: flex; flex-wrap: wrap; gap: var(--oelt-space-2, .5rem); margin: var(--oelt-space-3, 1rem) 0; padding: var(--oelt-space-2, .5rem); border: 1px dashed var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); min-height: 2.2rem; }
oelt-categorize [part~="token"] { font: inherit; cursor: grab; padding: var(--oelt-space-1, .25rem) var(--oelt-space-3, 1rem); border: 1px solid var(--oelt-color-primary, #357); border-radius: var(--oelt-radius, 6px); background: var(--oelt-color-bg, #fff); color: var(--oelt-color-fg, inherit); }
oelt-categorize [part~="token"][part~="grabbed"] { cursor: grabbing; outline: 2px solid var(--oelt-color-primary, #357); outline-offset: 2px; }
oelt-categorize [part~="token"][part~="correct"] { border-color: var(--oelt-color-correct, #1a7f4b); color: var(--oelt-color-correct, #1a7f4b); }
oelt-categorize [part~="token"][part~="incorrect"] { border-color: var(--oelt-color-incorrect, #b3261e); color: var(--oelt-color-incorrect, #b3261e); }
oelt-categorize [part~="submit"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-categorize [part~="submit"]:disabled { opacity: .5; cursor: default; }
oelt-categorize [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); outline: none; }
oelt-matching [part~="prompts"] { list-style: none; margin: var(--oelt-space-3, 1rem) 0; padding: 0; display: flex; flex-direction: column; gap: var(--oelt-space-2, .5rem); }
oelt-matching [part~="prompt-row"] { display: flex; align-items: center; gap: var(--oelt-space-3, 1rem); }
oelt-matching [part~="prompt-label"] { min-width: 8rem; }
oelt-matching [part~="target"] { flex: 1; min-height: 2.2rem; padding: var(--oelt-space-1, .25rem); border: 1px dashed var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); }
oelt-matching [part~="target"][part~="cursor"], oelt-matching [part~="bank"][part~="cursor"] { outline: 2px solid var(--oelt-color-primary, #357); outline-offset: 2px; }
oelt-matching [part~="target"][part~="correct"] { border-color: var(--oelt-color-correct, #1a7f4b); border-style: solid; }
oelt-matching [part~="target"][part~="incorrect"] { border-color: var(--oelt-color-incorrect, #b3261e); border-style: solid; }
oelt-matching [part~="bank"] { display: flex; flex-wrap: wrap; gap: var(--oelt-space-2, .5rem); margin: var(--oelt-space-3, 1rem) 0; padding: var(--oelt-space-2, .5rem); border: 1px dashed var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); min-height: 2.2rem; }
oelt-matching [part~="value"] { font: inherit; cursor: grab; padding: var(--oelt-space-1, .25rem) var(--oelt-space-3, 1rem); border: 1px solid var(--oelt-color-primary, #357); border-radius: var(--oelt-radius, 6px); background: var(--oelt-color-bg, #fff); color: var(--oelt-color-fg, inherit); }
oelt-matching [part~="value"][part~="grabbed"] { cursor: grabbing; outline: 2px solid var(--oelt-color-primary, #357); outline-offset: 2px; }
oelt-matching [part~="submit"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-matching [part~="submit"]:disabled { opacity: .5; cursor: default; }
oelt-matching [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); outline: none; }
oelt-ordering [part~="list"] { margin: var(--oelt-space-3, 1rem) 0; padding-left: var(--oelt-space-4, 1.5rem); display: flex; flex-direction: column; gap: var(--oelt-space-2, .5rem); }
oelt-ordering [part~="item"] { font: inherit; cursor: grab; text-align: left; width: 100%; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border: 1px solid var(--oelt-color-fg, #8889); border-radius: var(--oelt-radius, 6px); background: var(--oelt-color-bg, #fff); color: var(--oelt-color-fg, inherit); }
oelt-ordering [part~="item"][part~="grabbed"] { cursor: grabbing; outline: 2px solid var(--oelt-color-primary, #357); outline-offset: 2px; background: var(--oelt-color-bg, #eef0f4); }
oelt-ordering [part~="item"][part~="correct"] { border-color: var(--oelt-color-correct, #1a7f4b); color: var(--oelt-color-correct, #1a7f4b); }
oelt-ordering [part~="item"][part~="incorrect"] { border-color: var(--oelt-color-incorrect, #b3261e); color: var(--oelt-color-incorrect, #b3261e); }
oelt-ordering [part~="submit"] { font: inherit; cursor: pointer; padding: var(--oelt-space-2, .5rem) var(--oelt-space-3, 1rem); border-radius: var(--oelt-radius, 6px); border: 1px solid var(--oelt-color-primary, #357); background: var(--oelt-color-primary, #357); color: var(--oelt-color-bg, #fff); }
oelt-ordering [part~="submit"]:disabled { opacity: .5; cursor: default; }
oelt-ordering [part~="feedback"] { margin-top: var(--oelt-space-2, .5rem); outline: none; }
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
