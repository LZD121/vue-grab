# Phase 4: Full Selection and Agent-Oriented Output - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Upstream-parity selection and output: Vue ancestry, Shift/drag multi-select, keyboard hierarchy, floating toolbar, context menu, prompt mode, open-in-editor, theming, CSP nonce, and the full public API.

</domain>

<decisions>
### Selection
- Selection identity is the DOM element, never the component; `v-for` rows share a component but are distinct targets.
- Shift-click toggles a selection; Shift-drag extends; plain click copies.
- Drag sampling uses a 5×5 grid and filters out selected descendants so the top-level covered regions win.
- Keyboard: arrows navigate DOM hierarchy, Shift opens the hierarchy dropdown, Enter/c copies, O opens, Escape backs out.

### Output
- One bracketed reference per element, joined by newlines.
- Ancestors are formatted as `in Component (at path:line:col)`.
- Prompt text is prepended to the reference block.
- Selector and `v-for` key hints appear only when source is weak or a key exists.
- Clipboard writes plain text, escaped HTML, and metadata.

### Overlay
- Toolbar supports copy/comment, collapse, edge snapping, and localStorage persistence.
- Context menu mirrors Copy/Comment/Open and disables Open without a source.
- Prompt mode guards IME composition and discards empty submissions.
- Open uses the Vite `/__open-in-editor` endpoint and a VS Code URL fallback.
- Theme detection reads page luminance and exposes light/dark CSS variables.
- CSP nonces are copied to the injected overlay style.

### Claude's Discretion
- Toolbar art, menu spacing, label density, and exact error wording.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Controller state is already reactive with raw DOM elements.
- `context.ts`, `preview.ts`, `selection.ts`, and `freeze.ts` provide the primitives.
- `OverlayRoot.vue` renders all overlay surfaces in one shadow root.

### Established Patterns
- Controller methods are the single source of truth for UI and public API actions.

### Integration Points
- `GrabController.api` maps public methods to controller actions.
- `OverlayRoot.vue` calls controller methods directly.

</code_context>

<specifics>
## Specific Ideas

- Copy grammar and multi-select are covered by unit tests and browser automation.
- Toolbar state persists at `vue-grab:toolbar` in localStorage.

</specifics>

<deferred>
## Deferred Ideas

- Plugin registry/hooks and framework-agnostic primitives are v2.
- Theme hue controls and touch mode are v1.x.
