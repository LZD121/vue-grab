# Phase 1: Foundation and First End-to-End Grab - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A strict-TypeScript pnpm workspace with the `vue-grab` runtime, `@vue-grab/cli`, and a Vite demo app. The runtime mounts an isolated overlay, activates from the configured shortcut, hit-tests the page, resolves the nearest Vue component/source, and copies a normalized HTML preview. Compiler-injected line/column is Phase 2; freeze and multi-select are later phases.

</domain>

<decisions>
## Implementation Decisions

### Runtime Shape
- Use a separate `createApp` mounted in an open Shadow DOM instead of mounting into the host Vue app.
- Keep the overlay app marked with `__VUE_GRAB_OVERLAY__` so later freeze phases can exclude it.
- Use Vue `reactive` state with `markRaw` DOM elements so labels update without proxying DOM nodes.

### Activation and Selection
- Default to `Meta+C` on macOS and `Ctrl+C` elsewhere; parse `activationKey` strings and predicates.
- Support `toggle` and `hold` modes with a default 100 ms hold duration.
- Ignore IME composition and repeated keydowns; delay activation when text is selected in an editable target.
- Hit-test with `document.elementsFromPoint`, skipping the overlay, `data-vue-grab-ignore` subtrees, invisible nodes, and empty pointer-events-none overlays.

### Copy and Source
- Copy grammar is `[<html preview> in Component (at path:line:col)]`, one block per element.
- Use `data-vue-grab-loc` in Phase 2; Phase 1 falls back to `__vueParentComponent.type.__file` and component names.
- Strip `data-vue-grab-*`, `data-v-*`, and inline `style` from previews.
- Write plain text, escaped HTML, and the `application/x-vue-grab` metadata MIME type.

### Claude's Discretion
- Exact overlay CSS, toolbar button ordering, selector strategy, and error-copy wording.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None at phase start; the repository was an empty Git repo.

### Established Patterns
- pnpm workspace with `packages/*` and `apps/*`.
- Vite library mode with Vue as a peer dependency.
- Vitest for unit tests; Playwright for browser verification.

### Integration Points
- `packages/vue-grab/src/index.ts` auto-initializes in the browser and exposes `window.__VUE_GRAB__`.
- `apps/demo/src/main.ts` guards a dynamic `vue-grab` import with `import.meta.env.DEV`.
- `packages/cli` owns Node-only setup and never imports the browser runtime.

</code_context>

<specifics>
## Specific Ideas

- Demo must include nested components, a keyed list, an ignored subtree, and a reactive counter so later phases have realistic fixtures.

</specifics>

<deferred>
## Deferred Ideas

- Exact template locations (Phase 2), Vue scope/animation freeze (Phase 3), multi-select and full overlay UX (Phase 4), CLI/Nuxt/release (Phase 5).

</deferred>
