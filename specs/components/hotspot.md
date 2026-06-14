# `<oelt-hotspot>` — image hotspot selection

**Status:** `beta` (pending manual NVDA/VoiceOver pass).
**Base:** [base.md](./base.md). **Interaction type:** `choice`.

Select the correct region(s) on an image ("click the part that stores genetic material"). Single- or multiple-select. Reports one `oelt-interaction` on **Check**.

## 1. DOM model & the accessibility decision (DECIDED)

**Light DOM.** The image plus **labeled `<button>` overlays** positioned over it. Pixel-hunting image maps (classic `<map>`/`<area>`, or "click anywhere on the X") **cannot be made accessible** — a screen-reader user can't see the image. So:

> **Every hotspot MUST have a text `label` (its accessible name), and the `<img>` MUST have `alt`.** The component is a *labeled-region selection*, not pixel-hunting. A SR user perceives it as a labelled group of toggle buttons and can answer without seeing the image; a sighted user sees the same labels positioned on the diagram.

This is the careful a11y model the component exists to enforce. Hotspots are toggle `<button>`s with `aria-pressed`; selection state is conveyed by `aria-pressed` + a visible ✓ (never colour alone).

## 2. Authoring shape

```html
<oelt-hotspot id="cell" mode="multiple" src="images/cell.svg" alt="Diagram of an animal cell">
  <p slot="prompt">Select every structure that stores genetic material.</p>
  <oelt-area value="nucleus" x="10" y="18" w="26" h="30" label="Nucleus" correct></oelt-area>
  <oelt-area value="mito" x="55" y="50" w="22" h="20" label="Mitochondria"></oelt-area>
  <oelt-area value="dna" x="16" y="24" w="10" h="10" label="DNA" correct></oelt-area>
</oelt-hotspot>
```

`<oelt-area>` places a hotspot by **percentage** of the image box: `x`/`y` (top-left) and `w`/`h` (size), each 0–100. `label` is the visible + accessible name; `value` is the reported token (defaults to a slug of the label); `correct` marks answer regions. Percentages keep hotspots aligned as the image scales (responsive).

## 3. Attributes

| Attribute      | Values                 | Default          | Meaning                                                                  |
| -------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------ |
| `id`           | identifier             | —                | Required. Interaction id; matches the manifest declaration & `detail.id`. |
| `src`          | URL                    | —                | Required. The image.                                                     |
| `alt`          | string                 | —                | Required (a11y). Alternative text for the image.                          |
| `mode`         | `single` \| `multiple` | `single`         | One correct region vs a set.                                             |
| `submit-label` | string                 | `"Check answer"` | Label of the Check button.                                               |
| `retry`        | boolean                | absent           | Allow re-answering after feedback.                                       |

## 4. Slots & parts

Slots: `prompt` (the question; labels the hotspot group), default slot (`<oelt-area>`s).

Parts: `::part(prompt)`, `::part(stage)` (the positioned image container), `::part(image)`, `::part(hotspot)`, `::part(hotspot selected)`, `::part(hotspot correct)` / `::part(hotspot incorrect)` after Check, `::part(submit)`, `::part(feedback)`.

## 5. Interaction & grading

Hotspots are toggle buttons inside a `role="group"` labelled by the prompt. **Single** mode: selecting one deselects the others (one answer). **Multiple** mode: independent toggles. Keyboard: `Tab` between hotspots, `Space`/`Enter` toggles, then `Tab` to the Check button.

On **Check**, emits `oelt-interaction`:

```js
{ id, type: "choice", result, score, response }
```

Graded identically to `<oelt-mcq>` (shared `grade()`): single passes iff the one selected value is the correct one; multiple passes iff the selected set equals the `correct` set exactly, with partial-credit score `(correct − incorrect)/|key|` clamped 0–1. `response` = selected values joined by `,`. Without `retry`, hotspots lock and the interaction emits once; per-hotspot correctness is shown in `::part(hotspot correct|incorrect)` + a visually-hidden text prefix.

## 6. Keyboard & screen reader

- Hotspots are real `<button>`s — in the tab order, operable by `Space`/`Enter`, focus-visible for free.
- The group is `role="group"` `aria-labelledby` the prompt; each hotspot's accessible name is its `label`; `aria-pressed` conveys selection.
- The image has `alt`; SR users answer from the labels alone. On Check, focus moves to the `aria-live="polite"` feedback.

## 7. State

Key: the element id. Value: `{ sel: string[], submitted: boolean }` — selected values + submitted flag. **Max 64 bytes.** On resume, restore the selection and locked UI without re-emitting.

## 8. Tracking mapping

`cmi.interactions.n.*` with `type=choice`, `student_response` = selected values, `result` correct/wrong. cmi5/xAPI: an `answered` statement. (SCORM has no distinct "hotspot" type; a labelled-region selection is a choice.) Contributes to completion/score rules as the manifest specifies.

## 9. Validator obligations

- Element id present and unique; matches a manifest interaction declaration when declared.
- `src` and `alt` present (alt non-empty — a11y).
- At least two `<oelt-area>`s, each with a `label`; at least one `correct`; `x/y/w/h` numeric in 0–100.

## 10. Open questions

_None blocking. Non-rectangular regions and a "reveal info on click" (presentation, ungraded) mode are candidates for a later revision; v0 is rectangular labelled regions, graded._
