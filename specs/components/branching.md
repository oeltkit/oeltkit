# `<oelt-branching>` — branching scenario

**Status:** Draft for human review (Task 04). Implementation gated on sign-off.
**Base:** [base.md](./base.md). **Interaction type:** `sequencing`.

A decision scenario: a graph of nodes, each with narrative text and choices. Selecting a choice advances to the next node and emits one `oelt-interaction` per branch taken. Resume restores the learner's position by replaying a stored path — never by storing content.

## 1. DOM model

**Light DOM.** Node text is authored content that themes and author CSS must reach; the element renders the current node into its own light subtree and exposes parts for chrome. No shadow root.

## 2. Authoring shape

Scenario graph as a JSON document, inline or external:

```html
<oelt-branching id="sam" start="n1">
  <script type="application/json">
    {
      "nodes": {
        "n1": {
          "text": "<p>A colleague asks for a password. You…</p>",
          "choices": [
            { "label": "Share it", "to": "bad", "value": "share" },
            { "label": "Refuse and report", "to": "good", "value": "refuse" }
          ]
        },
        "good": { "text": "<p>Correct call.</p>", "end": "passed" },
        "bad": {
          "text": "<p>That exposes credentials.</p>",
          "choices": [{ "label": "Try again", "to": "n1", "value": "retry" }]
        }
      }
    }
  </script>
</oelt-branching>
```

Or `<oelt-branching id="sam" src="scenarios/sam.json" start="n1">`. Node `text` is an HTML fragment (sanitized on render). A node is terminal when it has `end: "passed" | "failed" | "completed"`.

## 3. Attributes

| Attribute | Values                      | Default       | Meaning                                                                                           |
| --------- | --------------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| `id`      | identifier                  | —             | Required. Interaction id.                                                                         |
| `src`     | path                        | —             | External scenario JSON (relative to the manifest). Mutually exclusive with the inline `<script>`. |
| `start`   | node id                     | first node    | Entry node.                                                                                       |
| `emit`    | `each-choice` \| `end-only` | `each-choice` | Whether every branch-take emits, or only the terminal node.                                       |

## 4. Slots & parts

The default slot holds the inline JSON `<script>` (not rendered). Parts: `::part(node)` (current node container), `::part(node-text)`, `::part(choices)` (the choice list), `::part(choice)` (each choice `<button>`), `::part(end)` (terminal node marker).

## 5. Events

- On each choice (when `emit=each-choice`): `oelt-interaction` `{ id, type:"sequencing", result:"completed", response: "<fromNode>:<choice.value>" }`. Mid-scenario choices report `completed` (a step taken), not pass/fail.
- On reaching a terminal node: `{ id, type:"sequencing", result: node.end, score: node.end==="passed"?1 : node.end==="failed"?0 : undefined, response: "<visited>" }` where `<visited>` is the visited node ids (joined by `>`). Ordered step-by-step analytics come from the per-choice interactions above, which the LRS retains; suspend stores only the bounded visited-set (OQ-002).

## 6. Keyboard

Choices are native `<button>`s.

| Key                 | Action                                        |
| ------------------- | --------------------------------------------- |
| `Tab` / `Shift+Tab` | Move among the current node's choice buttons. |
| `Enter` / `Space`   | Take the focused choice.                      |

No arrow-key hijacking; the choice list is buttons in document order.

## 7. Screen-reader behavior

- On node transition the element moves focus to the node container (`tabindex="-1"`, labelled by its heading/text) so the new content is read from the top; an `aria-live="polite"` status also announces "Step N" or the node's accessible name.
- The current node is the only node in the accessibility tree (previous nodes are removed, not merely hidden), so SR users never encounter stale choices.
- Terminal state is conveyed in text (not color/icon alone).
- Transitions respect `prefers-reduced-motion` (no slide/fade when set; instant swap). Documented in `README.md`; manual AT pass before `stable`.

## 8. State

Key: the element id. Value: `{ node: string, seen: string[] }` — current node id and the visited-set (unique node ids; per OQ-002, bounded by node count, not loop count). **Max 256 bytes.** On resume, restore `node` and re-render it without re-emitting prior interactions. If the stored node id is absent from the (possibly edited) scenario, fall back to `start` and clear `seen`.

## 9. Tracking mapping

Recorded as a sequencing interaction (`cmi.interactions` type `sequencing` / xAPI `progressed`/`answered` per the path), per tracking-semantics §7. Terminal `passed`/`failed` feeds completion/score rules when this interaction is `required` or scored in the manifest.

## 10. Validator obligations

- Valid JSON; every `choice.to` references an existing node; `start` (or the first node) exists.
- At least one terminal node reachable from `start` (no dead-end-only graphs).
- Element id present, unique, matches the manifest declaration.

## 11. Open questions

- **Cycle/path-length bound:** resolved — [OQ-002](../OPEN-QUESTIONS.md) chose current-node + visited-set with per-choice interactions for ordered analytics (§5, §8).
