// <oelt-branching> — branching scenario. See specs/components/branching.md.
// Light DOM: renders the current node; choices are native <button>s. Resume by
// stored current-node + visited-set (OQ-002), not by content.

import { OeltElement, ensureStyles } from "./base.js";

type End = "passed" | "failed" | "completed";
interface Choice {
  label: string;
  to: string;
  value: string;
}
interface Node {
  text: string;
  choices?: Choice[];
  end?: End;
}
interface Scenario {
  nodes: Record<string, Node>;
}
interface BranchState {
  node: string;
  seen: string[];
}

export class OeltBranching extends OeltElement {
  #scenario: Scenario = { nodes: {} };
  #current = "";
  #seen = new Set<string>();
  #emitMode: "each-choice" | "end-only" = "each-choice";

  connectedCallback(): void {
    ensureStyles();
    if (this.dataset.oeltUpgraded) return;
    this.dataset.oeltUpgraded = "true";
    this.whenReady(() => this.#init());
  }

  async #init(): Promise<void> {
    this.#emitMode = this.getAttribute("emit") === "end-only" ? "end-only" : "each-choice";
    this.#scenario = await this.#loadScenario();

    const nodeIds = Object.keys(this.#scenario.nodes);
    const start = this.getAttribute("start") ?? nodeIds[0] ?? "";

    const saved = this.loadState<BranchState | undefined>(undefined);
    if (saved && this.#scenario.nodes[saved.node]) {
      this.#seen = new Set(saved.seen);
      this.#render(saved.node, false);
    } else {
      this.#render(start, false);
    }
  }

  async #loadScenario(): Promise<Scenario> {
    const src = this.getAttribute("src");
    try {
      if (src) return (await (await fetch(src)).json()) as Scenario;
      const inline = this.querySelector('script[type="application/json"]')?.textContent ?? "{}";
      return JSON.parse(inline) as Scenario;
    } catch (err) {
      console.error(`[oelt-branching] invalid scenario for "${this.id}":`, err);
      return { nodes: {} };
    }
  }

  #render(nodeId: string, focus: boolean): void {
    const node = this.#scenario.nodes[nodeId];
    if (!node) return;
    this.#current = nodeId;
    this.#seen.add(nodeId);

    const choices = node.choices ?? [];
    this.innerHTML = `
      <div part="node" tabindex="-1" role="group" aria-label="Scenario step">
        <div part="node-text">${sanitize(node.text)}</div>
        ${
          choices.length
            ? `<div part="choices">${choices
                .map(
                  (c, i) =>
                    `<button part="choice" type="button" data-i="${i}">${escapeHtml(c.label)}</button>`,
                )
                .join("")}</div>`
            : `<p part="end" role="status">${node.end ? `Scenario complete: ${node.end}.` : "End."}</p>`
        }
      </div>`;

    const container = this.querySelector<HTMLElement>('[part~="node"]')!;
    container.querySelectorAll<HTMLButtonElement>('[part~="choice"]').forEach((btn, i) => {
      btn.addEventListener("click", () => this.#choose(choices[i]!));
    });
    if (focus) container.focus();

    this.saveState({ node: nodeId, seen: [...this.#seen] } satisfies BranchState);

    if (node.end) {
      this.emitInteraction({
        id: this.id,
        type: "sequencing",
        result: node.end,
        ...(node.end === "passed" ? { score: 1 } : node.end === "failed" ? { score: 0 } : {}),
        response: [...this.#seen].join(">"),
      });
    }
  }

  #choose(choice: Choice): void {
    if (this.#emitMode === "each-choice") {
      this.emitInteraction({
        id: this.id,
        type: "sequencing",
        result: "completed",
        response: `${this.#current}:${choice.value}`,
      });
    }
    this.#render(choice.to, true); // move focus to the new node
  }
}

function sanitize(html: string): string {
  // Author-trusted scenario content; strip script/style/event handlers defensively.
  return html.replace(/<\/?(script|style)[^>]*>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
}
const escapeHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
