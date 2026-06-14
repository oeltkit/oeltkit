// <oelt-hotspot> — labeled image hotspot selection. See hotspot.md.
// Light DOM. Accessible by design: hotspots are labeled toggle <button>s
// positioned over the image (percentage coords), in a role=group labeled by the
// prompt — never pixel-hunting. Graded identically to mcq (shared grade()).

import { OeltElement, ensureStyles, type InteractionResult } from "./base.js";
import { grade } from "./grade.js";

/** Inert data-carrier for a hotspot region (consumed on upgrade). */
export class OeltArea extends HTMLElement {}

interface HotspotState {
  sel: string[];
  submitted: boolean;
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "area";

export class OeltHotspot extends OeltElement {
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
    const src = this.getAttribute("src") ?? "";
    const alt = this.getAttribute("alt") ?? "";
    const submitLabel = this.getAttribute("submit-label") ?? "Check answer";
    const prompt = this.querySelector('[slot="prompt"]')?.innerHTML ?? "";

    const areas = [...this.querySelectorAll("oelt-area")].map((a) => {
      const label = a.getAttribute("label") ?? (a.textContent ?? "").trim();
      return {
        value: a.getAttribute("value") ?? slug(label),
        label,
        correct: a.hasAttribute("correct"),
        x: num(a.getAttribute("x")),
        y: num(a.getAttribute("y")),
        w: num(a.getAttribute("w")),
        h: num(a.getAttribute("h")),
      };
    });
    this.#key = areas.filter((a) => a.correct).map((a) => a.value);

    const promptId = `${this.id}-prompt`;
    this.innerHTML = `
      <div part="prompt" id="${promptId}">${prompt}</div>
      <div part="stage" role="group" aria-labelledby="${promptId}">
        <img part="image" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />
        ${areas
          .map(
            (a) =>
              `<button part="hotspot" type="button" aria-pressed="false" data-value="${escapeAttr(
                a.value,
              )}" style="left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%">` +
              `<span part="marker" aria-hidden="true">✓</span><span part="hotspot-label">${escapeHtml(
                a.label,
              )}</span></button>`,
          )
          .join("")}
      </div>
      <button part="submit" type="button">${escapeHtml(submitLabel)}</button>
      <div part="feedback" role="status" aria-live="polite" tabindex="-1"></div>`;

    const hotspots = (): HTMLButtonElement[] => [
      ...this.querySelectorAll<HTMLButtonElement>('[part~="hotspot"]'),
    ];
    const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]')!;
    const feedback = this.querySelector<HTMLElement>('[part~="feedback"]')!;

    for (const hs of hotspots()) {
      hs.addEventListener("click", () => {
        if (submit.disabled) return;
        const pressed = hs.getAttribute("aria-pressed") === "true";
        if (this.#mode === "single") {
          for (const other of hotspots()) {
            other.setAttribute("aria-pressed", "false");
            other.part.remove("selected");
          }
        }
        hs.setAttribute("aria-pressed", String(!pressed));
        hs.part.toggle("selected", !pressed);
      });
    }

    submit.addEventListener("click", () => {
      const chosen = hotspots()
        .filter((h) => h.getAttribute("aria-pressed") === "true")
        .map((h) => h.dataset.value!);
      if (chosen.length === 0) {
        feedback.textContent = "Select a region first.";
        return;
      }
      this.saveState({ sel: chosen, submitted: true } satisfies HotspotState);
      const g = grade(this.#mode, this.#key, chosen);
      this.emitInteraction({
        id: this.id,
        type: "choice",
        result: g.result,
        score: g.score,
        response: g.response,
      });
      this.#showResult(g.result, feedback);
    });

    // Resume.
    const saved = this.loadState<HotspotState | undefined>(undefined);
    if (saved) {
      for (const hs of hotspots()) {
        const on = saved.sel.includes(hs.dataset.value!);
        hs.setAttribute("aria-pressed", String(on));
        hs.part.toggle("selected", on);
      }
      if (saved.submitted && !this.hasAttribute("retry")) this.#lock();
    }
  }

  #showResult(result: InteractionResult, feedback: HTMLElement): void {
    feedback.textContent =
      result === "passed" ? "Correct." : "Not quite — review the highlighted regions.";
    if (!this.hasAttribute("retry")) this.#lock();
    feedback.focus();
  }

  #lock(): void {
    const submit = this.querySelector<HTMLButtonElement>('[part~="submit"]');
    if (submit) submit.disabled = true;
    for (const hs of this.querySelectorAll<HTMLButtonElement>('[part~="hotspot"]')) {
      hs.disabled = true;
      const isKey = this.#key.includes(hs.dataset.value!);
      const selected = hs.getAttribute("aria-pressed") === "true";
      // Highlight the correct regions; flag the learner's wrong picks. Leave
      // unselected non-answers unmarked so feedback isn't noisy.
      let prefix: string | null = null;
      if (isKey) {
        hs.part.add("correct");
        prefix = selected ? "Correct region: " : "Missed correct region: ";
      } else if (selected) {
        hs.part.add("incorrect");
        prefix = "Incorrect region: ";
      }
      if (prefix) {
        const tag = document.createElement("span");
        tag.className = "oelt-visually-hidden";
        tag.textContent = prefix;
        hs.prepend(tag);
      }
    }
  }
}

const num = (s: string | null): number => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;");
