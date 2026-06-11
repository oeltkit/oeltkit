# `<oelt-media>` — accessible media wrapper

**Status:** Draft for human review (Task 04). Implementation gated on sign-off.
**Base:** [base.md](./base.md). **Interaction type:** `media`.

Wraps a native `<video>` or `<audio>` element, **enforces captions/transcript**, provides a transcript panel, and emits a completion interaction at a configurable watched threshold. Accessibility is the product here — a media element without alternatives must not silently ship.

## 1. DOM model

**Light DOM.** The media element, its `<track>`s, and the transcript are authored content. The wrapper enhances the slotted `<video>`/`<audio>` and adds a transcript disclosure; no shadow root.

## 2. Authoring shape

```html
<oelt-media id="intro-video" threshold="0.9">
  <video controls preload="metadata" slot="media">
    <source src="media/intro.mp4" type="video/mp4" />
    <track kind="captions" src="media/intro.en.vtt" srclang="en" label="English" default />
  </video>
  <div slot="transcript">
    <p>Welcome to the course…</p>
  </div>
</oelt-media>
```

`<audio>` is supported identically (audio MUST supply a `transcript` slot since captions don't apply). The native `controls` attribute provides accessible playback controls — the wrapper does not reimplement them.

## 3. The captions/transcript gate

On upgrade the element validates its alternatives and **refuses to present the media** otherwise:

- `<video>`: requires at least one `<track kind="captions">` **or** a `transcript` slot.
- `<audio>`: requires a `transcript` slot.

If unmet, the element renders a **visible error state** (`::part(error)`, an `alert`) — "Media is missing captions or a transcript and cannot be displayed" — instead of the player, and emits no interaction. This is mirrored by a build-time validator rule so the failure is caught before delivery, not just at runtime.

## 4. Attributes

| Attribute         | Values     | Default | Meaning                                                                                                    |
| ----------------- | ---------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `id`              | identifier | —       | Required. Interaction id.                                                                                  |
| `threshold`       | 0–1        | `0.9`   | Fraction of duration watched/listened that counts as completed.                                            |
| `transcript-open` | boolean    | absent  | Start with the transcript panel expanded.                                                                  |
| `autoplay`        | boolean    | absent  | Opt-in autoplay; **ignored** when `prefers-reduced-motion: reduce`, and always starts muted with controls. |

The element never sets autoplay implicitly; `controls` on the inner media is required (validator-checked).

## 5. Slots & parts

Slots: `media` (the `<video>`/`<audio>`), `transcript` (transcript markup). Parts: `::part(player)`, `::part(transcript-toggle)` (a native `<button>`/`<summary>`), `::part(transcript)` (the panel), `::part(error)` (the gate's error state).

## 6. Events

- At `threshold` of cumulative playback (tracked via `timeupdate`, resilient to seeking — measures furthest contiguous progress, not scrubbing): `oelt-interaction` `{ id, type:"media", result:"completed", response:"watched" }`, emitted once.
- No score (media completion is binary). Re-watching does not re-emit.

## 7. Keyboard

Playback uses the native media `controls` (already keyboard-accessible). The transcript toggle is a native `<button>` (or `<details>/<summary>`):

| Key                 | Action                                               |
| ------------------- | ---------------------------------------------------- |
| `Tab`               | Reach the player controls and the transcript toggle. |
| `Enter` / `Space`   | Operate the focused control / toggle the transcript. |
| (native media keys) | Provided by the browser's `controls`.                |

## 8. Screen-reader behavior

- Captions are available via the native track menu; the transcript toggle has an accessible name and `aria-expanded`; the transcript panel is a labelled region.
- The error state (§3) is an `role="alert"` so it is announced if the gate fails.
- No autoplay under reduced-motion; no information conveyed by motion alone. Documented in `README.md`; manual AT pass before `stable`.

## 9. State

Key: the element id. Value: `{ pos: number, completed: boolean }` — furthest position (seconds, integer) and completion flag. **Max 48 bytes.** On resume, optionally offer to resume from `pos` (does not auto-seek); restore `completed` so the interaction is not re-emitted.

## 10. Tracking mapping

Recorded as `cmi.interactions` (type `other`) / an xAPI statement at completion, per tracking-semantics §7. Media completion contributes to completion rules only when declared `required` in the manifest.

## 11. Validator obligations

- The captions/transcript gate (§3) as a hard rule: media without an alternative fails `oelt validate a11y`.
- Inner media has `controls`; `autoplay` is not set directly on the inner element.
- Element id present, unique, matches the manifest declaration.

## 12. Open questions

_None blocking. Whether to offer auto-resume-seek by default (vs prompt) is a UX call deferred to authoring feedback._
