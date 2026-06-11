# Component specs

One normative contract per component lives here as `<name>.md` (e.g. `mcq.md`). Each MUST define: behavior, attributes, events, accessibility (keyboard map + screen-reader behavior), and declared maximum state size (counts against the 3 KB suspend budget — see [`../tracking-semantics.md` §8](../tracking-semantics.md#8-state-resume-and-the-suspend-data-budget)).

A component is not "done" until its spec exists here and its implementation matches it (CLAUDE.md → Definition of done). Specs win over code. First components are built in [`../../tasks/04-first-components.md`](../../tasks/04-first-components.md).
