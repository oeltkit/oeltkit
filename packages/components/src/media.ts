// <oelt-media> — accessible media wrapper. See specs/components/media.md.
// Wraps a native <video>/<audio>, ENFORCES captions/transcript, adds a
// transcript disclosure, and emits a completion interaction at a threshold.

import { OeltElement, ensureStyles } from "./base.js";

interface MediaState {
  pos: number;
  completed: boolean;
}

export class OeltMedia extends OeltElement {
  #completed = false;

  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const media = this.querySelector<HTMLMediaElement>("video, audio");
    if (!media) {
      this.#renderError("No <video> or <audio> element was provided.");
      return;
    }
    const isVideo = media.tagName === "VIDEO";
    const hasCaptions = !!media.querySelector('track[kind="captions"]');
    const transcript = this.querySelector('[slot="transcript"]');

    // The captions/transcript gate (media.md §3): refuse to present otherwise.
    if (!transcript && !(isVideo && hasCaptions)) {
      this.#renderError("Media is missing captions or a transcript and cannot be displayed.");
      return;
    }
    if (!media.hasAttribute("controls")) media.setAttribute("controls", "");
    media.setAttribute("part", "player");

    // Transcript disclosure (native <details>).
    if (transcript) {
      const details = document.createElement("details");
      if (this.hasAttribute("transcript-open")) details.open = true;
      const summary = document.createElement("summary");
      summary.setAttribute("part", "transcript-toggle");
      summary.textContent = "Transcript";
      const panel = document.createElement("div");
      panel.setAttribute("part", "transcript");
      panel.append(...transcript.childNodes);
      transcript.remove();
      details.append(summary, panel);
      this.append(details);
    }

    // Completion at threshold (furthest contiguous progress, robust to seeking).
    const threshold = clamp01(parseFloat(this.getAttribute("threshold") ?? "0.9"));
    const saved = this.loadState<MediaState | undefined>(undefined);
    this.#completed = saved?.completed ?? false;
    let furthest = saved?.pos ?? 0;

    media.addEventListener("timeupdate", () => {
      if (media.currentTime > furthest) furthest = media.currentTime;
      const frac = media.duration > 0 ? furthest / media.duration : 0;
      if (!this.#completed && frac >= threshold) {
        this.#completed = true;
        this.emitInteraction({
          id: this.id,
          type: "media",
          result: "completed",
          response: "watched",
        });
      }
      this.saveState({
        pos: Math.floor(furthest),
        completed: this.#completed,
      } satisfies MediaState);
    });

    // Opt-in autoplay, suppressed under reduced motion; always muted + controls.
    if (this.hasAttribute("autoplay") && !this.reducedMotion && isVideo) {
      media.muted = true;
      void (media as HTMLVideoElement).play?.().catch(() => {});
    }
  }

  #renderError(message: string): void {
    const div = document.createElement("div");
    div.setAttribute("part", "error");
    div.setAttribute("role", "alert");
    div.textContent = message;
    this.replaceChildren(div);
  }
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.9);
