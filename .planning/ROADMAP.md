# Roadmap: Vue Grab

## Overview

Vue Grab is built as five runnable vertical slices, each proving one link of the contract chain from research: constants and types → overlay interaction → compile-time attribute contract → freeze integrity → full agent-ready output → install path and release. Every phase ends with something a developer can exercise in the demo app, and every precise path ships with a labelled degraded path so a missing compiler attribute never breaks the copy loop. The finished milestone is a dev-only runtime, Vite plugin, and CLI that copy exact Vue component ancestry and `.vue` source locations to the clipboard.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and First End-to-End Grab** - A demo Vite app where one shortcut opens the overlay, hover highlights, and click copies DOM-level context.
- [x] **Phase 2: Compile-Time Exact Locations** - The Vite plugin and compiler inject exact template `file:line:column`, with a clean `__file` fallback.
- [x] **Phase 3: Freeze and Interaction Integrity** - Activation stops Vue reactivity, animations, and pseudo-states; deactivation restores the page exactly.
- [x] **Phase 4: Full Selection and Agent-Oriented Output** - Ancestry, multi-select, keyboard hierarchy, prompt mode, editor opening, toolbar, and context menu.
- [x] **Phase 5: Install Path, Frameworks, and Release** - `vue-grab` CLI, Nuxt integration, publishable packages, docs, and the verification matrix.

## Phase Details

### Phase 1: Foundation and First End-to-End Grab
**Goal**: A developer can open a shadow-root overlay in the demo app with the configured shortcut, hover any element for a labelled highlight, and click to copy a normalized HTML preview with best-effort element identification and visible feedback — from a clean, strict-TypeScript pnpm workspace.
**Mode:** mvp
**UI hint**: yes
**Depends on**: Nothing (first phase)
**Requirements**: ACT-01, ACT-02, ACT-03, OVL-01, OVL-02, OVL-03, SEL-01, CTX-04, API-01
**Success Criteria** (what must be TRUE):
  1. On the demo app, Cmd+C on macOS or Ctrl+C elsewhere opens the overlay and a bare `C` does not; hold and toggle modes follow the configured key and duration.
  2. Hovering any rendered element highlights its topmost grabbable node with tag, component name, and source label, skipping ignored, invisible, and page-covering layers; the box and label stay clamped through scroll and resize.
  3. Clicking a highlighted element copies a single-line HTML preview (internal/Vue attributes stripped, text escaped, long values truncated) and shows success or retryable failure feedback.
  4. `init()` is idempotent, returns a stable API, exposes `window.__VUE_GRAB__`, fires `vue-grab:init`, and returns a no-op without touching `window`/`document` outside a development browser; `dispose()` leaves no listeners, styles, or overlay nodes.
  5. A production build of the demo mounts no overlay and injects no Vue Grab styles.
**Plans**: 5 plans

Plans:
- [x] 01-01: Workspace, shared contract, and strict toolchain — pnpm monorepo with `packages/vue-grab`, `packages/cli`, `apps/demo`, Vite lib configs, TypeScript strict, ESLint/Prettier/Vitest, `constants.ts`, public types, state union, and copy-grammar fixtures.
- [x] 01-02: Overlay shell and lifecycle — separate `createApp` in an open ShadowRoot with `pointer-events` isolation, CSS injection, deferred body mount, dev-only guard, idempotent `init()`/`dispose()`, `window.__VUE_GRAB__`, and HMR dispose.
- [x] 01-03: Activation and hit-testing — capture-phase key handling with toggle/hold/duration, composed topmost-element resolution with ignore/visibility/overlay filtering, and viewport-clamped selection box and label.
- [x] 01-04: First copy slice — HTML preview normalization, clipboard write with synchronous `execCommand` fallback, and success/retryable-failure feedback.
- [x] 01-05: Demo app and unit harness — demo SFCs exercising nesting and ignore attributes, Vitest setup, and production-no-op build check.

### Phase 2: Compile-Time Exact Locations
**Goal**: Every native element in a dev-rendered SFC carries `data-vue-grab-loc="file:line:column"` from the Vite plugin, so copied context names the exact template position; without the plugin the same flow degrades to `__file` or component name without breaking copy.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CTX-02, VIT-01, VIT-02, VIT-03
**Success Criteria** (what must be TRUE):
  1. With the plugin enabled, every native element in a served SFC carries a loc attribute whose 1-based line/column matches the template, including nested elements, same-line siblings, and long `<script setup>` blocks.
  2. Clicking an element copies a location such as `in App (at /src/App.vue:LINE:COL)` that matches its template position, and Vite/Nuxt/Windows/query-string paths normalize to one display form.
  3. With the plugin disabled, the same click copies `__file` or component name with no line number and no error.
  4. Pug and external-`src` templates are skipped, source maps and HMR remain intact, and editing a template does not double-inject attributes.
  5. Production build output is byte-identical with and without the plugin.
**Plans**: 4 plans

Plans:
- [x] 02-01: Compiler transform — `vue-grab/compiler` parses the SFC descriptor AST, injects loc attributes on native elements and call attributes on component tags, escapes values, skips Pug/`src`, and emits a high-resolution source map.
- [x] 02-02: Vite plugin entry — `vue-grab/vite` with `apply: 'serve'`, `enforce: 'pre'`, main `.vue` request only, query/id normalization, and HMR-safe idempotency.
- [x] 02-03: Runtime location resolver — parse loc attributes, join the injected root for display/editor use, and fall back through `__file` to component name.
- [x] 02-04: Golden regression suite — fixtures for offsets, nesting, same-line elements, multiple roots, and degraded mode, plus a source-map assertion.

### Phase 3: Freeze and Interaction Integrity
**Goal**: Activating the overlay visibly stops the page — Vue reactive updates, CSS/WAAPI/SMIL animations, rAF loops, and hover/focus styling — and deactivation restores it exactly, while activation remains safe inside inputs, IME composition, focus traps, and modals.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ACT-04, ACT-05, OVL-08, SEL-05, SEL-06, FRZ-01, FRZ-02, FRZ-03, FRZ-04, FRZ-05
**Success Criteria** (what must be TRUE):
  1. While active, a ticking counter, CSS/WAAPI/SMIL animations, a self-rescheduling rAF loop, and a hover-revealed dropdown all visibly stop; the overlay itself stays responsive.
  2. Deactivation resumes every paused scope exactly once and the page continues from its current state; repeated toggle, Escape, `dispose()`, `pagehide`, and HMR never leave a frozen page or leaked inline styles.
  3. Activating inside a focused input, with an active text selection, or during CJK IME composition neither submits text nor steals keystrokes; claimed keys do not reach host handlers and Escape restores focus without scrolling.
  4. The overlay activates inside a modal focus trap and through a backdrop, and selection bounds survive scroll, resize, visual-viewport zoom, and element size changes.
  5. A selection re-resolves to its replacement after HMR or a re-render and is dropped only after recovery fails.
**Plans**: 5 plans

Plans:
- [x] 03-01: Vue app discovery and scope freeze — `__vue_app__` scan on the main document and open shadow roots; full vnode walk incl. Teleport/Suspense/KeepAlive; per-instance scope pause with pre-paused bookkeeping and overlay exclusion.
- [x] 03-02: Animation freeze — targeted CSS/WAAPI/SMIL pause plus rAF interception with overlay exclusion and clean finish on resume.
- [x] 03-03: Pseudo-state pinning — snapshot and inline-pin `:hover`/`:focus` computed styles along the inspected chain and restore exactly.
- [x] 03-04: Freeze lifecycle safety — single ref-counted session, strict restore order with `try/finally`, partial-failure reporting, and release on Escape/blur/`visibilitychange`/`pagehide`/HMR/`dispose()`.
- [x] 03-05: Interaction integrity — editable-target and `isComposing` guards, key ownership and focus restoration, focus-trap/backdrop activation, bounds tracking, HMR selection re-resolution, and full listener/style/observer teardown.

### Phase 4: Full Selection and Agent-Oriented Output
**Goal**: Developers get upstream-parity selection and copy: Vue component ancestry, shift and drag multi-select, full keyboard hierarchy navigation, toolbar and context menu, prompt mode, open-in-editor, and theming — producing one agent-ready block per selected element.
**Mode:** mvp
**UI hint**: yes
**Depends on**: Phase 3
**Requirements**: OVL-04, OVL-05, OVL-06, OVL-07, SEL-02, SEL-03, SEL-04, SEL-07, CTX-01, CTX-03, CTX-05, CTX-06, CTX-07, CTX-08, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. Copied text uses the upstream grammar `[<tag attrs>text</tag> in Component (at path:line:column)]`, one block per selected element, joined in document order, with Vue ancestry that filters built-ins and respects `maxContextLines`.
  2. Shift-click and drag-rectangle select multiple elements with a live pending preview, deduplicated and ordered; Shift-drag extends, and edge dragging auto-scrolls without losing the rectangle or set.
  3. Arrow/Tab/Shift navigation plus the hierarchy dropdown reach ancestors, siblings, and children; Enter copies and Escape backs out.
  4. The floating toolbar and right-click menu expose Copy, Comment, and Open with correct enabled states, keyboard access, outside/Escape dismissal, and persisted position/collapsed state; overlay colors follow the host theme and CSP nonce.
  5. Comment mode is IME-safe and prepends its prompt, open-in-editor resolves the real file or disables cleanly, and the public API (`toggle`, `comment`, `copyElement`, `getSource`, `getStackContext`, toolbar state, `vue-grab:element-selected`) mirrors the UI.
**Plans**: 5 plans

Plans:
- [x] 04-01: Ancestry and copy grammar — parent-chain resolution with built-in filtering and dedupe, slot `renderedBy` vs `definedIn` attribution, `maxContextLines` budgeting, and grammar goldens.
- [x] 04-02: Multi-select interactions — Shift-click set model, drag-rectangle coverage with dedupe/document ordering, Shift-drag extension, pending preview, and edge auto-scroll.
- [x] 04-03: Keyboard, toolbar, and context menu — hierarchy navigation and dropdown, floating toolbar with persistence, and shadow-root context menu with enabled states and dismissal.
- [x] 04-04: Prompt, editor, and clipboard — IME-safe prompt mode with discard confirmation, `POST /__vue-grab/open`, editor-URL fallback, and multi-format clipboard writes with retryable failures.
- [x] 04-05: Output quality and public API — selector/`v-for` key hints, internal-attribute stripping, light/dark theming and CSP nonce, full method surface, toolbar state events, and selection events.

### Phase 5: Install Path, Frameworks, and Release
**Goal**: `pnpm dlx @vue-grab/cli init` wires a cold Vite or Nuxt project end-to-end, both packages publish with correct exports and types, and the documented verification matrix proves the copy flow, freeze, SSR hydration, CSP, and production no-op.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: VIT-04, VIT-05, CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, QLT-01, QLT-02, QLT-03, QLT-04, QLT-05, QLT-06
**Success Criteria** (what must be TRUE):
  1. `vue-grab init --yes` on a cold Vite project installs `vue-grab`, adds one dev-only import, and adds the compiler plugin without overwriting user config; the shortcut then works with no manual edits.
  2. The same init on a Nuxt project wires a client-only plugin and both dev compilers so SSR HTML and client DOM agree, with no hydration mismatch and working open-in-editor.
  3. `configure` edits only its managed options block and `--dry-run`/diff, `--force`, `--cwd`, `--skip-install`, and non-interactive CI runs behave as documented with actionable errors and no telemetry.
  4. Unit tests cover normalization, grammar, ancestry, scope discovery, freeze/resume, and compiler transforms, and Playwright e2e covers activation, hover, click/shift/drag copy, prompt, editor, freeze, CSP, focus trap, HMR, and the production no-op.
  5. `npm pack` passes `publint` and `attw`, typed subpaths and MIT attribution are present, and CI exercises the Vue 3.5 + Vite 5/8 + Nuxt 3/4 matrix on the Node floor.
**Plans**: 5 plans

Plans:
- [x] 05-01: Nuxt subpath — `vue-grab/nuxt` with both dev compilers, client-only plugin template, dev-only early return, Nitro open handler, and typed `vue-grab/vite`/`vue-grab/compiler`/`vue-grab/constants` exports that keep Node code out of the browser bundle.
- [x] 05-02: CLI detection and wiring — `init` detection (Vue ≥3.5, Vite/Nuxt, plugin-vue, package manager, workspace), dev-dependency install, entry import, and magicast plugin insertion for Vite and Nuxt with idempotency and diff preview.
- [x] 05-03: CLI configure and ergonomics — managed options block for key/mode/hold/input/context lines, `--yes`, `--force`, `--cwd`, `--skip-install`, `--dry-run`, non-interactive CI behavior, actionable errors, and no telemetry or version ping.
- [x] 05-04: Coverage and documentation — Vitest suite across normalization, grammar, ancestry, scope discovery, freeze, and compiler transforms; Playwright specs for the full interaction matrix; README, manual install, Vite/Nuxt, CLI, API, and upstream MIT attribution.
- [x] 05-05: Packaging and release gates — exports/types/bin/peer/engines, `publint` and `attw --profile esm-only`, production-leak and CSP fixtures, supported-version CI matrix, performance checks, and changesets.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and First End-to-End Grab | 1/1 | Complete | 2026-10-20 |
| 2. Compile-Time Exact Locations | 1/1 | Complete | 2026-10-20 |
| 3. Freeze and Interaction Integrity | 1/1 | Complete | 2026-10-20 |
| 4. Full Selection and Agent-Oriented Output | 1/1 | Complete | 2026-10-20 |
| 5. Install Path, Frameworks, and Release | 1/1 | Complete | 2026-10-20 |
