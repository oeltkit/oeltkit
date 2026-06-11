# Component specs

One normative contract per component lives here as `<name>.md`. Each MUST define: behavior, attributes, events, accessibility (keyboard map + screen-reader behavior), light/shadow DOM decision, and declared maximum state size (counts against the 3 KB suspend budget — see [`../tracking-semantics.md` §8](../tracking-semantics.md#8-state-resume-and-the-suspend-data-budget)).

- [base.md](./base.md) — the shared contract every `<oelt-*>` element obeys (the `oelt-interaction` event, tokens/parts, DOM rules, state budget, a11y baseline). Read first.
- [mcq.md](./mcq.md) — `<oelt-mcq>` multiple choice / multiple response.
- [branching.md](./branching.md) — `<oelt-branching>` branching scenario.
- [media.md](./media.md) — `<oelt-media>` accessible media wrapper.

A component is not "done" until its spec exists here and its implementation matches it (CLAUDE.md → Definition of done). Specs win over code. Per [`../../tasks/04-first-components.md`](../../tasks/04-first-components.md), the spec is reviewed and signed off **before** implementation; components may then merge as `beta` pending a manual NVDA/VoiceOver pass.
