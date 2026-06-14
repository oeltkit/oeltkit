// <oelt-quiz> — question container. See specs/components/quiz.md.
// Light DOM: discovers question children, optionally pools/shuffles them,
// aggregates their oelt-interaction events into one weighted score, and emits a
// single interaction for the quiz. Children still report individually.

import { OeltElement, ensureStyles, type InteractionDetail } from "./base.js";
import { quizGrade, selectPool, itemScore } from "./quiz-grade.js";

/** Tags treated as scored questions (quiz.md §2). Extend as components are added. */
const QUESTION_TAGS = new Set(["OELT-MCQ", "OELT-TEXT-ENTRY"]);

interface QuizState {
  active: string[];
  scores: Record<string, number>;
  done: boolean;
}

export class OeltQuiz extends OeltElement {
  #mastery: number | undefined;
  #questions: HTMLElement[] = []; // active questions, in display order
  #weights = new Map<string, number>();
  #scores = new Map<string, number>();
  #done = false;
  #status!: HTMLElement;

  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  #init(): void {
    const masteryAttr = this.getAttribute("mastery");
    this.#mastery = masteryAttr !== null && masteryAttr !== "" ? Number(masteryAttr) : undefined;
    if (this.#mastery !== undefined && !Number.isFinite(this.#mastery)) this.#mastery = undefined;

    // Discover all known question children (in document order).
    const all = [...this.querySelectorAll<HTMLElement>("*")].filter(
      (el) => QUESTION_TAGS.has(el.tagName) && el.id,
    );
    for (const q of all) this.#weights.set(q.id, Math.max(0, Number(q.getAttribute("weight")) || 1));

    const saved = this.loadState<QuizState | undefined>(undefined);

    // Determine the active set + order: restored from state, else pool/shuffle.
    let activeIds: string[];
    if (saved) {
      activeIds = saved.active.filter((id) => all.some((q) => q.id === id));
      this.#done = saved.done;
      for (const [id, s] of Object.entries(saved.scores)) this.#scores.set(id, s);
    } else {
      const ids = all.map((q) => q.id);
      const pool = this.#poolSize(ids.length);
      activeIds = pool < ids.length ? selectPool(ids, pool, Math.random) : ids;
      if (this.hasAttribute("shuffle")) activeIds = shuffle(activeIds);
    }

    const byId = new Map(all.map((q) => [q.id, q]));
    this.#questions = activeIds.map((id) => byId.get(id)!).filter(Boolean);

    // Hide pooled-out questions from layout + a11y tree (quiz.md §7).
    const activeSet = new Set(activeIds);
    for (const q of all) if (!activeSet.has(q.id)) q.hidden = true;

    // Apply restored/shuffled order to the DOM so visual + focus order match.
    for (const q of this.#questions) this.appendChild(q);

    // Inject the status / summary region.
    this.#status = document.createElement("div");
    this.#status.setAttribute("part", "status");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    this.appendChild(this.#status);

    // Listen for child interactions (do NOT stop propagation — the runtime still
    // records each as item-level analytics). Ignore the quiz's own emission.
    this.addEventListener("oelt-interaction", (e: Event) => {
      const ev = e as CustomEvent<InteractionDetail>;
      if (ev.target === this || ev.detail.id === this.id) return;
      if (!activeSet.has(ev.detail.id)) return; // pooled-out / unknown
      this.#scores.set(ev.detail.id, itemScore(ev.detail.result, ev.detail.score));
      this.#persist();
      this.#refresh(true);
    });

    this.#refresh(false);
  }

  #poolSize(count: number): number {
    const p = Number(this.getAttribute("pool"));
    return Number.isInteger(p) && p >= 1 ? p : count;
  }

  /** Update the status region and emit the aggregate once every question is answered. */
  #refresh(allowEmit: boolean): void {
    const total = this.#questions.length;
    const answered = this.#questions.filter((q) => this.#scores.has(q.id)).length;

    if (answered < total) {
      this.#status.textContent = `Answered ${answered} of ${total} questions.`;
      return;
    }

    const items = this.#questions.map((q) => ({
      weight: this.#weights.get(q.id) ?? 1,
      score: this.#scores.get(q.id) ?? 0,
    }));
    const g = quizGrade(items, this.#mastery);
    this.#status.textContent = `Quiz complete. Score ${Math.round(g.score * 100)}%.`;
    this.#status.part.remove("passed", "failed");
    if (this.#mastery !== undefined) this.#status.part.add(g.result === "passed" ? "passed" : "failed");

    // Emit only when triggered by a live answer (not on resume restore), and
    // re-emit on subsequent answers (retry) so the latest aggregate wins.
    // Defer to a microtask so the child interaction that completed the quiz is
    // recorded by the runtime *before* the aggregate — the aggregate logically
    // follows its constituents in the interaction log.
    if (allowEmit) {
      this.#done = true;
      this.#persist();
      queueMicrotask(() =>
        this.emitInteraction({ id: this.id, type: "performance", result: g.result, score: g.score }),
      );
    }
  }

  #persist(): void {
    this.saveState({
      active: this.#questions.map((q) => q.id),
      scores: Object.fromEntries(this.#scores),
      done: this.#done,
    } satisfies QuizState);
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
