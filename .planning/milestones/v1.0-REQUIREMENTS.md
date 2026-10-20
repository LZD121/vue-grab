# Requirements: Vue Grab

**Defined:** 2026-10-20
**Core Value:** One keyboard shortcut copies the exact Vue component and source location behind any element on screen, so a coding agent edits the real file instead of guessing.

## v1 Requirements

Requirements for the initial release. Each maps to exactly one roadmap phase.

### Activation

- [x] **ACT-01**: Developer can activate the overlay with Cmd+C on macOS or Ctrl+C elsewhere; a bare `C` does not activate
- [x] **ACT-02**: Developer can configure `activationKey` (string or predicate) and `activationMode` (`toggle` or `hold`) through `init()` and the CLI
- [x] **ACT-03**: In hold mode, the overlay activates only after `keyHoldDuration` and deactivates when the key/modifier is released; in toggle mode it stays active until Escape or an explicit toggle
- [x] **ACT-04**: Activation inside inputs, text selections, and IME composition does not steal the app's keystrokes or submit partial CJK input
- [x] **ACT-05**: Escape deactivates the overlay and restores focus without scrolling; claimed activation keys do not reach host app handlers while grab mode owns them

### Overlay

- [x] **OVL-01**: Runtime mounts a separate Vue app inside an open Shadow DOM on `<body>` (deferred until body exists), with `pointer-events: none` on the host and no host-app plugin/component-tree pollution
- [x] **OVL-02**: Hover hit-testing returns the topmost grabbable element, skipping invisible/zero-size nodes, the overlay, `data-vue-grab-ignore` subtrees, and transparent page-covering layers
- [x] **OVL-03**: A selection box and floating label show tag, Vue component name, and source path; both clamp to the viewport and follow scroll, resize, zoom, and element-size changes
- [x] **OVL-04**: A floating toolbar exposes the default action, collapse/expand, and a default-action menu; its edge, ratio, and collapsed state persist across reloads
- [x] **OVL-05**: Right-clicking an active selection opens a shadow-root context menu with Copy, Comment, and Open actions, correct enabled states, keyboard access, and outside/Escape dismissal
- [x] **OVL-06**: Overlay colors follow the host page's light/dark theme and expose CSS custom properties for basic customization
- [x] **OVL-07**: Injected overlay styles reuse a detected CSP nonce and use no inline event-handler attributes
- [x] **OVL-08**: Overlay activation works through focus traps and modal backdrops, and deactivation/`dispose()` removes every host listener, style, and observer

### Selection

- [x] **SEL-01**: Clicking a hovered element copies it immediately and shows success or retryable failure feedback
- [x] **SEL-02**: Shift-click toggles multiple elements, previews the pending selection, and copies one context block per element in document order
- [x] **SEL-03**: Dragging a rectangle selects every grabbable element covered by it, deduplicated and ordered by document position; Shift-drag extends an existing selection
- [x] **SEL-04**: Arrow keys navigate ancestors/siblings/children; Tab/Shift+Tab move between siblings; Shift opens a hierarchy dropdown; Enter copies; Escape backs out or cancels
- [x] **SEL-05**: Selection bounds stay correct through scrolling, window resize, visual-viewport zoom, and element size changes
- [x] **SEL-06**: A selection re-resolves to its replacement when HMR or a re-render swaps the DOM node, and is dropped only after recovery fails
- [x] **SEL-07**: Dragging near a viewport edge auto-scrolls the page without breaking the drag rectangle or selected set

### Context & Copy

- [x] **CTX-01**: Copied text uses the upstream grammar `[<tag attrs>text</tag> in Component (at path:line:column)]`, one bracket per selected element joined by newlines
- [x] **CTX-02**: The primary source location comes from the compiler-injected `data-vue-grab-loc`; without it, fall back to `instance.type.__file`, then component name only; normalize Vite/Nuxt/Windows/query-string paths
- [x] **CTX-03**: Component ancestry comes from the Vue instance parent chain, filters Vue/Nuxt built-ins, deduplicates, and respects `maxContextLines` while giving library/shared-UI frames a free budget
- [x] **CTX-04**: The HTML preview strips `data-v-*`, `data-vue-grab-*`, and internal attributes, escapes text, truncates long values, and collapses to a single line in reference context
- [x] **CTX-05**: Context includes a semantic selector and a `v-for` key hint when source is weak, without letting selector noise compete with a trusted source path
- [x] **CTX-06**: Clipboard writes include `text/plain`, escaped `text/html`, and metadata; failures are visible, retryable, and never leave the overlay stuck in "Copying"
- [x] **CTX-07**: Comment mode opens a prompt textarea, is IME-safe, submits with Enter, inserts newlines with Shift+Enter, asks before discarding, and prepends the prompt to the copied context
- [x] **CTX-08**: Open-in-editor sends the absolute path to the Vite/Nuxt `/__open-in-editor` endpoint, falls back to a configurable editor URL, and is disabled when no file is known

### Freeze

- [x] **FRZ-01**: On activation, every mounted Vue app's component scopes are discovered and paused, excluding the overlay's own app; no Vue scheduler or renderer internals are patched
- [x] **FRZ-02**: On deactivation, every paused scope resumes exactly once; Vue coalesces to the latest state, and partial failures are reported without leaking a frozen page
- [x] **FRZ-03**: CSS animations/transitions, WAAPI animations, SVG SMIL, and self-rescheduling rAF loops pause while frozen and finish cleanly on unfreeze
- [x] **FRZ-04**: `:hover` and `:focus` computed styles on the inspected chain are pinned during freeze and removed on unfreeze, including hover-revealed dropdowns
- [x] **FRZ-05**: Freeze state is released on Escape, `dispose()`, pagehide, and Vite HMR before a component type is replaced

### Vite Plugin

- [x] **VIT-01**: A development-only Vite plugin injects `data-vue-grab-loc="file:line:column"` on native elements in Vue SFC templates with exact 1-based template positions
- [x] **VIT-02**: The plugin preserves source maps, skips Pug and external-`src` templates, injects only on the main `.vue` request, and does not corrupt HMR
- [x] **VIT-03**: The plugin works with Vite 5–8 and `@vitejs/plugin-vue`, applies only while serving, and leaves production output byte-identical
- [x] **VIT-04**: In Nuxt dev, the plugin runs for both client and server compilation so SSR HTML and client DOM agree and hydration does not mismatch
- [x] **VIT-05**: The plugin and compiler helpers ship behind typed `vue-grab/vite` and `vue-grab/compiler` subpaths; the browser runtime imports no Node code

### CLI

- [x] **CLI-01**: `vue-grab init` detects Vue 3.5+, Vite or Nuxt, `@vitejs/plugin-vue`, package manager, monorepo/workspace layout, and existing installation; it is idempotent and offers a diff before writing
- [x] **CLI-02**: `init` installs `vue-grab` as a dev dependency, adds one dev-only import to the Vite entry, and adds the compiler plugin to `vite.config.*` without overwriting user config
- [x] **CLI-03**: `vue-grab configure` edits a managed options block for key, mode, hold duration, input activation, and context lines, and never rewrites user code outside that block
- [x] **CLI-04**: `init` wires Nuxt through a `.client` plugin guarded by `import.meta.dev` and keeps the Vite plugin active for both dev compilers
- [x] **CLI-05**: CLI supports `--yes`, `--force`, `--cwd`, `--skip-install`, and `--dry-run`, works non-interactively in CI, and reports actionable errors
- [x] **CLI-06**: CLI performs no telemetry or version ping; the only network access is the package manager install the user requested

### Public API & Integration

- [x] **API-01**: `init(options)` returns a stable API, exposes `window.__VUE_GRAB__`, dispatches `vue-grab:init`, and returns a no-op API on SSR/non-development without touching `window` or `document`
- [x] **API-02**: `activate`, `deactivate`, `toggle`, `comment`, `isActive`, `isEnabled`, `setEnabled`, `reset`, and `dispose` behave consistently with the keyboard/toolbar flows
- [x] **API-03**: `getState`, `setOptions`, `getToolbarState`, `setToolbarState`, and `onToolbarStateChange` expose the live overlay state and option overrides
- [x] **API-04**: `copyElement`, `getSource`, and `getStackContext` work on Vue-rendered elements and use the same resolver/copy pipeline as the UI
- [x] **API-05**: `vue-grab:element-selected` fires with tag, component, file, line, column, and text for each selected element

### Quality & Release

- [x] **QLT-01**: Vitest unit tests cover path normalization, copy grammar, ancestry filtering, scope discovery, freeze/resume, and compiler transforms
- [x] **QLT-02**: Playwright e2e on the demo app covers activation, hover, click/shift/drag copy, prompt mode, open-in-editor, freeze/unfreeze, CSP, focus trap, HMR, and production no-op
- [x] **QLT-03**: README, manual installation, Vite/Nuxt setup, CLI reference, API reference, and preserved upstream MIT attribution are complete
- [x] **QLT-04**: `npm pack` output passes `publint` and `attw --profile esm-only`; exports, types, bin, LICENSE, and peer dependencies are correct
- [x] **QLT-05**: Idle activation adds no measurable CPU; hover hit-testing stays within one frame on a 2,000-node page; freeze avoids full-document style recalculation
- [x] **QLT-06**: CI exercises Vue 3.5 + Vite 5/8 and Nuxt 3/4 on the supported Node floor, plus a production build that asserts the runtime is dropped or inert

## v2 Requirements

Deferred until the v1 core loop is validated.

### Distribution & Compatibility

- **DIST-01**: A standalone IIFE/CDN build for zero-build demos
- **DIST-02**: A Nuxt module package replacing CLI-generated config
- **DIST-03**: Same-origin iframe and open-shadow-root traversal for embedded previews
- **DIST-04**: Touch/mobile selection mode
- **DIST-05**: Theme customization (hue, per-layer visibility) beyond the basic tokens

### Extensibility

- **EXT-01**: Plugin registry and ordered hook pipeline (`onBeforeCopy`, `transformCopyContent`, `transformAgentContext`, `transformOpenFileUrl`, action context)
- **EXT-02**: Framework-agnostic `vue-grab/primitives` subpath exposing hit testing, bounds, context, freeze, and clipboard helpers
- **EXT-03**: Copy-format presets for different agent targets
- **EXT-04**: Configurable editor URL transforms and additional editor fallbacks

### CLI Extras

- **CLI2-01**: `vue-grab add/remove` installs the agent skill
- **CLI2-02**: `vue-grab pull/watch/stop` captures grabs from the clipboard daemon
- **CLI2-03**: `vue-grab upgrade` checks the registry and upgrades the package
- **CLI2-04**: Accessible overlay semantics audit and fixes beyond keyboard operation

## Out of Scope

Explicitly excluded to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Vue 2 and Vue < 3.5 | Vue 2 is EOL; `EffectScope.pause()` is the clean freeze primitive and only exists in 3.5+ |
| React/Solid/Svelte adapters | The product is a Vue port; multi-framework support multiplies resolvers and test matrices |
| Browser extension | Separate distribution, permissions, CSP, and cross-origin source access; not core value |
| Three.js/WebGL object selection | A separate renderer-specific picking subsystem with no Vue equivalent in scope |
| Runtime source-map fetching/symbolication | Vue templates compile to render functions; bundle positions do not map to template columns, and fetching adds latency and dev-server load |
| Patching the Vue scheduler/renderer/`nextTick` | Coupled to internals and can corrupt watcher ordering; `EffectScope.pause()` is public in 3.5 |
| Mounting the overlay inside the host Vue app | Pollutes the component tree, inherits plugins/provides, and can be unmounted by route changes |
| Production injection or telemetry | Leaks source paths, changes production output, and violates the privacy constraint |
| Automatic code edits, MCP server, or agent client | Vue Grab supplies clipboard context and a stable API; it is not an agent integration |
| Closed shadow-root introspection | The DOM API cannot reach closed roots; degrade to the shadow host |
| Persisting the active selection across reloads | Stale DOM references and surprising activation on page load |
| Next.js/RSC server-frame symbolication | No Vue equivalent in scope; compile-time attributes already cover dev SSR |
| Nuxt server-component symbolication | Same as above |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACT-01 | Phase 1 | Complete |
| ACT-02 | Phase 1 | Complete |
| ACT-03 | Phase 1 | Complete |
| ACT-04 | Phase 3 | Complete |
| ACT-05 | Phase 3 | Complete |
| OVL-01 | Phase 1 | Complete |
| OVL-02 | Phase 1 | Complete |
| OVL-03 | Phase 1 | Complete |
| OVL-04 | Phase 4 | Complete |
| OVL-05 | Phase 4 | Complete |
| OVL-06 | Phase 4 | Complete |
| OVL-07 | Phase 4 | Complete |
| OVL-08 | Phase 3 | Complete |
| SEL-01 | Phase 1 | Complete |
| SEL-02 | Phase 4 | Complete |
| SEL-03 | Phase 4 | Complete |
| SEL-04 | Phase 4 | Complete |
| SEL-05 | Phase 3 | Complete |
| SEL-06 | Phase 3 | Complete |
| SEL-07 | Phase 4 | Complete |
| CTX-01 | Phase 4 | Complete |
| CTX-02 | Phase 2 | Complete |
| CTX-03 | Phase 4 | Complete |
| CTX-04 | Phase 1 | Complete |
| CTX-05 | Phase 4 | Complete |
| CTX-06 | Phase 4 | Complete |
| CTX-07 | Phase 4 | Complete |
| CTX-08 | Phase 4 | Complete |
| FRZ-01 | Phase 3 | Complete |
| FRZ-02 | Phase 3 | Complete |
| FRZ-03 | Phase 3 | Complete |
| FRZ-04 | Phase 3 | Complete |
| FRZ-05 | Phase 3 | Complete |
| VIT-01 | Phase 2 | Complete |
| VIT-02 | Phase 2 | Complete |
| VIT-03 | Phase 2 | Complete |
| VIT-04 | Phase 5 | Complete |
| VIT-05 | Phase 5 | Complete |
| CLI-01 | Phase 5 | Complete |
| CLI-02 | Phase 5 | Complete |
| CLI-03 | Phase 5 | Complete |
| CLI-04 | Phase 5 | Complete |
| CLI-05 | Phase 5 | Complete |
| CLI-06 | Phase 5 | Complete |
| API-01 | Phase 1 | Complete |
| API-02 | Phase 4 | Complete |
| API-03 | Phase 4 | Complete |
| API-04 | Phase 4 | Complete |
| API-05 | Phase 4 | Complete |
| QLT-01 | Phase 5 | Complete |
| QLT-02 | Phase 5 | Complete |
| QLT-03 | Phase 5 | Complete |
| QLT-04 | Phase 5 | Complete |
| QLT-05 | Phase 5 | Complete |
| QLT-06 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-20*
*Last updated: 2026-10-20 after roadmap creation (SEL-07 moved to Phase 4, QLT-01 moved to Phase 5 — both depended on capabilities delivered by later phases)*
