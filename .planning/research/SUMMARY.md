# Project Research Summary

**Project:** Vue Grab
**Domain:** Dev-only in-page Vue inspection overlay (browser runtime + compile-time Vite plugin + installer CLI); port of React Grab
**Researched:** 2026-10-20
**Confidence:** HIGH overall — versions, Vue 3.5 internals, and one compiler probe were verified; only long-term Vue 3.6/Vapor and strict-CSP behavior carry real uncertainty.

## Executive Summary

Vue Grab is a development-only overlay that turns "point at the UI" into clipboard text a coding agent can act on: an inline HTML preview, the Vue component ancestry, and the exact `.vue` template `file:line:column`. It ships as one runtime package (`vue-grab`) with Node-only subpaths (`./vite`, `./compiler`, `./nuxt`, `./constants`) plus a separate `@vue-grab/cli`. The unit of value is the copy grammar, not the overlay chrome — an inspector that opens the editor (LocatorJS, vue-inspector) or lists components (Vue DevTools) does not produce agent-ready context.

The research converges on four load-bearing decisions: (1) a **second `createApp` inside an open ShadowRoot**, so host CSS/events cannot touch the overlay and the host freeze cannot freeze it; (2) an **`enforce: 'pre'` raw-SFC transform** that parses with the consumer's `@vue/compiler-sfc`, walks the descriptor template AST, and injects static `data-vue-grab-loc` / `data-vue-grab-call` attributes with MagicString and a hires map; (3) a **per-instance `EffectScope.pause()` freeze** plus animation and pseudo-state pinning behind one ref-counted session; (4) **upstream-identical copy grammar** covered by golden tests. Everything else — toolbar, menus, keyboard hierarchy, prompt mode — is parity work on top of that spine.

The main risks are correctness-of-precision and completeness-of-freeze, not features. Compile-time injection can silently misplace lines (offset errors, `pug`/`src` templates, HMR double injection) and freeze can miss instances (component scopes are detached; Teleport/Suspense/KeepAlive/multi-app trees) or fail to restore. Both are mitigated by a hard rule the research repeats: **every precise path must have a labelled degraded path** (`__file` → selector-only) and every freeze/locate path needs a fixture that fails loudly.

## Key Findings

### Recommended Stack

Vue `3.5.44` (peer `^3.5.0`) and Vite `8.3.4` (peer `^5 || ^6 || ^7 || ^8`) are the runtime and build host; `vue` is external in the ESM build and provided by the consumer. TypeScript `6.0.3` (never 7.x — `typescript-eslint@8.72` caps at `<6.1`), pnpm `11.28.6` workspaces, Vite lib mode for every artifact (browser ESM, IIFE, `node22` subpaths, CLI with a shebang banner) — no tsup/unbuild/tsdown. Compiler work uses `@vue/compiler-sfc`/`@vue/compiler-dom` `3.5.44` + `magic-string@1.4.3`; editor opening uses `launch-editor@2.14.2` from the dev server. Tests: `vitest@5.0.5` + jsdom + `@vue/test-utils` for logic, `@playwright/test@1.64.1` for geometry, Shadow DOM, clipboard, freeze and HMR.

- **Vue 3.5+ / open ShadowRoot overlay** — only version with `EffectScope.pause()`, dev-only `__vueParentComponent`/`__vnode`, and `type.__file`/`__name`.
- **Vite lib mode + `@vitejs/plugin-vue@6.0.10`** — the only single toolchain that compiles overlay `.vue` SFCs, inlines CSS via `?inline`, and builds Node subpaths.
- **`@vue/compiler-sfc` descriptor AST + MagicString** — SFC-absolute positions without duplicating `plugin-vue` compilation or HMR handling.
- **`@clack/prompts@1.8.1` + `commander@14.0.3` + `magicast@0.5.5` + `tinyexec@1.3.1`** — the CLI in four dependencies; format-preserving config edits, no shell.
- **Changesets (linked group) + `publint` + `attw --profile esm-only`** — runtime and plugin share an attribute contract, so they must version together.

### Expected Features

The v1 surface is full core parity with upstream; almost nothing is deferrable without breaking the "inspect → select → copy" promise.

**Must have (table stakes):** toggle **and** hold activation with configurable key/duration and IME/`isComposing`/editable-target safety; shadow-root overlay with composed hit-testing; selection box + label; click-to-copy with visible success/failure; Shift multi-select; drag-rectangle multi-select; copy grammar with Vue ancestry and exact location; Vue + CSS/WAAPI + SMIL + rAF freeze; pseudo-state (`:hover`/`:focus`) pinning; prompt/comment mode; open-in-editor; context menu; floating toolbar; full keyboard hierarchy navigation; Vite compiler plugin; CLI `init`/`configure`; Nuxt wiring; viewport/scroll/HMR resilience; focus-trap isolation; basic public API; CSP nonce.

**Should have (differentiators):** compile-time exact template line/column (the product's core claim); SFC-aware ancestry that filters `Transition`/`KeepAlive`/`Teleport`/`Suspense`/`Fragment`/Nuxt router internals; multi-element context blocks; selector + `v-for` key hints; `maxContextLines` budget with library/shared-UI frames treated as cheap.

**Defer (v1.x / v2+):** theme hue/layer toggles, touch mode, accessible overlay semantics, IIFE/CDN convenience, editor-URL transforms (v1.x); plugin registry, framework-agnostic primitives subpath, iframe/open-shadow traversal, copy presets, standalone Nuxt module package (v2+). **Excluded:** runtime source-map symbolication, scheduler patching, production injection, telemetry, browser extension, Three.js, Vue < 3.5, non-Vue adapters, automatic code edits.

### Architecture Approach

Read-mostly runtime. `core/` owns state, events, hit-test, freeze session, copy, format, selectors, plugin registry and is framework-agnostic; `vue/` is the only code touching Vue internals (`adapter.ts` interface, `apps.ts` discovery + instance walk, `source.ts`, `freeze.ts`); `overlay/` is a separate Vue app with its own effect scope; `vite/`, `compiler/`, `nuxt/` are Node-only entries; `packages/cli` only edits config files and never imports the runtime or injects entry-file imports.

1. **Overlay app** — host `<div data-vue-grab-host>` with `position:fixed; inset:0; pointer-events:none; z-index:max`, open shadow root, CSS injected from `styles.css?inline`, `pointer-events:auto` only while active.
2. **Vue adapter** — element → `__vueParentComponent` (walk composed ancestors), ancestry via `instance.parent` with built-in filtering, `resolveSource` precedence `loc attr → call attr → __file → null`.
3. **Freeze controller** — app discovery (`__vue_app__` scan incl. open shadow roots/iframes), full vnode walk (components, children, Teleport, Suspense branches, KeepAlive cache), pause each unique `instance.scope`; animations and pseudo-states in the same session; strict restore order with `try/finally`.
4. **Compiler + Vite plugin** — raw SFC parse, native-element-only `data-vue-grab-loc`, component-tag `data-vue-grab-call`, idempotent, escaped, hires source map, main `.vue` request only; virtual config/client modules and a validated `POST /__vue-grab/open`.
5. **Copy pipeline** — one bracketed reference per DOM element (not per component), internal `data-vue-grab-*` attributes stripped, prompt prepended, clipboard written inside the gesture.

### Critical Pitfalls / Watch-outs

1. **Dev-only Vue internals vanish in prod/tests** — `__vueParentComponent`, `__vnode`, `app._instance` are `__DEV__`-gated while `__vue_app__` is not. Isolate every read in one adapter, feature-detect once, warn once, and add a build fixture that asserts zero `vue-grab` bytes and zero `data-vue-grab-` attributes.
2. **Freeze must be a per-instance walk** — every component scope is `new EffectScope(true /* detached */)`, so `app._instance.scope.pause()` freezes only the root. Missing Teleport/Suspense/KeepAlive/multi-app scopes leaves the page moving; pausing the overlay's own app freezes the UI. De-dupe scopes, record pre-paused state (`_isPaused`) and resume only what this session paused.
3. **Line/column drift** — template-relative parsing, `pug`/`src` templates, query-suffixed requests, double injection and multiple roots all produce plausible-but-wrong locations. Parse the SFC descriptor AST, transform the main request only, skip non-HTML templates, escape values, keep source maps, and golden-test `<script setup>` offsets, same-line and nested elements.
4. **Hydration and dev-only leakage** — injecting on one side (or in build) yields SSR/client disagreement that hydration does not repair for arbitrary `data-*`. Inject in **both** dev compilers, never in build; root-relative POSIX paths only.
5. **Input hijack and freeze side effects** — capture-phase keys need `event.code` matching, `repeat`/`isComposing`/`defaultPrevented`/editable-target guards and release on blur; a `pointer-events` flip on `html` suppresses `:hover` and costs tens of ms, so use a leaf shield and pin computed hover/focus styles before any write.
6. **Copy-time contamination and weak clipboard paths** — `data-vue-grab-*`, freeze-pinned inline styles and absolute paths must never reach the clipboard; `navigator.clipboard` needs a gesture and a secure context, so keep a synchronous `execCommand` fallback and assert real clipboard contents in Playwright.

### Verified Technical Facts (probe results)

- **Compiler probe (verified):** a `@vue/compiler-sfc` node transform run on the **descriptor AST** emitted `data-vue-grab-loc="/src/App.vue:6:3"` for nested elements — the line/column are SFC-absolute and 1-based, and the path is Vite-root-absolute. Runtime must therefore keep the value opaque for display (strip the leading `/`) and join it with the injected `root` for editor opening. This supersedes the `STACK.md` claim that `@vue/compiler-dom.parse()` over the whole SFC yields file-absolute positions.
- **Freeze probe (source-verified):** `EffectScope.pause()` only cascades to non-detached children, and component scopes are always detached, so freezing requires walking per-instance scopes (see watch-out 2). `FEATURES.md`'s "pause `app._instance.scope`" line is wrong and is superseded.
- **Slot attribution (verified):** slot content's `__vueParentComponent` is the *rendering child*, while the loc attribute lives in the *parent's* template. Model `renderedBy` and `definedIn` separately; never dedupe selections by component or file.
- **`tagType` (verified):** `0` native, `1` component, `2` slot — inject only on `ELEMENT` with non-builtin tags, and never use fallthrough attributes as an element's own location.

## Open Questions / Contradictions Resolved

| Topic | Conflict | Resolution (most conservative, evidence-backed) |
|-------|----------|------------------------------------------------|
| SFC parsing API | `STACK` says `@vue/compiler-dom.parse()` on the whole SFC; `FEATURES`/`PITFALLS` say `@vue/compiler-sfc.parse()` + descriptor AST | **Descriptor AST.** Probe-confirmed absolute positions; compiler-dom remains the walker for AST/`transform`. Resolve the SFC compiler from the consumer's Vue so two compilers never run. |
| Freeze primitive | `FEATURES` says pausing the app/root scope freezes children; `ARCHITECTURE`/`PITFALLS` say scopes are detached | **Per-instance walk.** Source-verified; root-only pause is a no-op beyond the root component. |
| SSR injection | `ARCHITECTURE` returns early on `ssr: true`; `STACK`/`PITFALLS`/`FEATURES` require both dev compilers or neither | **Inject in both dev client and server transforms**, never in build; only the runtime bootstrap is client-only. Otherwise SSR HTML lacks attributes that the client has, and hydration will not patch them. |
| Overlay mount target | `STACK` says `document.documentElement`; `ARCHITECTURE`/`FEATURES`/`PITFALLS` say `document.body` | **`document.body`** plus a re-attach guard; fall back to `documentElement` only when body carries a transform or clipping overflow. |
| Overlay CSS delivery | `STACK` `<style>`; `PITFALLS` `adoptedStyleSheets`; `FEATURES` nonce | **`<style>` with a copied CSP nonce**, `adoptedStyleSheets` when a strict `style-src` has no nonce. Never export a stylesheet. |
| Animation freeze scope | `ARCHITECTURE` implies a document-wide pause rule; `FEATURES`/`PITFALLS` reject blanket `*` | **Targeted** per-element/`getAnimations()` pause with a global-rule fallback only above an animation-count threshold. |
| CLI build tool | `PITFALLS` tsup 9; `STACK`/`ARCHITECTURE` Vite lib mode | **Vite lib mode** with `output.banner` shebang; one toolchain. |
| TypeScript | `PITFALLS` 5.9.3; `STACK`/`ARCHITECTURE` 6.0.3 | **6.0.3**; fall back to 5.9.3 only if a peer regresses. Never 7.x. |
| Tooling pins | `PITFALLS` pnpm 12 / commander 15 / picocolors+ora; `STACK`/`ARCHITECTURE` pnpm 11 / commander 14 / `@clack` only | **pnpm 11.28.6, commander 14, `@clack` only** — Node 20 floor, fewer dependencies. |
| Published `engines` | `>=22.12` vs `>=20.19` | **`^20.19.0 \|\| >=22.12.0`** (Vite 8 floor + `require(esm)`); repo/CI on Node 22.23/24.22. |
| Nuxt packaging | `FEATURES` prefers a later module package; `STACK`/`ARCHITECTURE` use a subpath | **`vue-grab/nuxt` subpath** immediately; `@nuxt/kit` optional peer `^3.13 \|\| ^4`. No separate package. |

Remaining genuine unknowns: Vue 3.6/Vapor AST and instance-shape drift; CSP without nonce/hash in the target app; drag-rectangle coverage threshold calibration; Windows/WSL path shapes in real projects; whether a Vite-5 consumer can be covered by the Playwright fixture alone (Vitest 5 cannot run on Vite 5).

## Implications for Roadmap

Five coarse phases, each ending in a runnable slice. Order is driven by the contract chain found in research: **constants/types → overlay + interaction → attribute contract → freeze → full output → install path**.

### Phase 1: Foundation and first end-to-end grab
**Goal:** a demo Vite app where one shortcut opens a shadow-root overlay, hover highlights, click copies DOM-level context (preview + selector), and teardown is clean.
**Prerequisites:** none.
**Delivers:** pnpm workspace with `packages/vue-grab`, `packages/cli`, `apps/demo`; strict TS/ESLint/Prettier/Vitest; `constants.ts` + public types + state union + copy-grammar fixtures; overlay app mount; activation toggle/hold; composed hit-test; clipboard write + fallback; dev guard; idempotent `init()`/`dispose()`; `import.meta.hot.dispose`.
**Findings applied:** stack (Vite lib mode, `<style>` injection, no exported CSS); watch-outs 1, 5, 6; pitfalls 13, 14, 15, 20, 21; table stakes activation/overlay/hover/click copy/public API.
**Avoids:** production leakage, keyboard hijack, reactive-proxy identity bugs, toolchain skew from the first commit.

### Phase 2: Compile-time exact locations
**Goal:** every native element in a dev-rendered SFC carries `data-vue-grab-loc`, and copy shows `file:line:column`; without the plugin, the same flow degrades to `__file` + "line unknown".
**Prerequisites:** Phase 1 resolver seam, demo SFCs with deep nesting and a long `<script setup>`.
**Delivers:** `vue-grab/compiler` (`transformSFC` over the descriptor template AST, native elements only, `data-vue-grab-call` on component tags, idempotent, escaped, hires map, pug/`src` skips, POSIX/`/@fs/`/Windows normalization); `vue-grab/vite` (`apply: 'serve'`, `enforce: 'pre'`, main `.vue` id only, both dev compilers, virtual config/client, `POST /__vue-grab/open`); runtime loc parser (greedy last-two-number regex) and `__file` fallback; golden tests.
**Findings applied:** compiler probe; watch-out 3; pitfalls 6, 7, 8, 9, 10, 17; `STACK` subpath packaging; copy grammar `in Name (at path:line:col)`.
**Research flag:** source-map/HMR chaining and AST offsets across `@vue/compiler-sfc` minors — keep the probe and goldens as the regression net.

### Phase 3: Freeze and interaction integrity
**Goal:** activating the overlay visibly stops the page — reactive updates, CSS/WAAPI/SMIL animations, rAF loops, and hover/focus styling — and deactivation restores it exactly.
**Prerequisites:** Phase 1 event lifecycle; adapter skeleton for app discovery.
**Delivers:** `vue/apps.ts` discovery (`__vue_app__`, open shadow roots, same-origin iframes) + full vnode walk; per-instance scope pause/resume with pre-paused bookkeeping and session id; animation snapshot/pause with overlay exclusion; pseudo-state computed-style pinning with exact inline restore; release-on-blur/`visibilitychange`; `pagehide`/HMR restore; freeze torture fixtures (counter, watcher side effect, Teleport/Suspense/KeepAlive, two apps).
**Findings applied:** freeze probe; watch-outs 2, 5; pitfalls 2, 3, 4, 13, 14; `FEATURES` freeze rows.
**Research flag:** no public API for "is this scope paused" or KeepAlive caches — needs a real-browser matrix rather than docs.

### Phase 4: Full selection and agent-oriented output
**Goal:** upstream-parity selection and copy: ancestry, multi-select, keyboard, prompt, editor.
**Prerequisites:** Phases 2–3 (loc resolver, freeze session, adapter).
**Delivers:** ancestry with built-in filtering and `data-vue-grab-call` enrichment; slot `renderedBy` vs `definedIn`; Shift multi-select and drag-rectangle selection keyed by element identity; keyboard navigation + hierarchy dropdown; toolbar, context menu, prompt mode with composition guarding; open-in-editor action; selector/`v-for` key hints; `maxContextLines`; internal-attribute stripping; grammar goldens and clipboard failure UX.
**Findings applied:** slot/tagType probes; watch-outs 1, 4, 6; pitfalls 4, 5, 11, 12, 21; differentiators.
**Research flag:** drag coverage threshold and label/geometry behavior need Playwright calibration, not more reading.

### Phase 5: Install path, frameworks, and release
**Goal:** `pnpm dlx @vue-grab/cli init` works on a cold Vite project and a Nuxt project; packages publish cleanly.
**Prerequisites:** stable attribute/config contract from Phases 2–4.
**Delivers:** CLI `init`/`configure`/`remove` (detect Vue ≥3.5 + Vite/Nuxt, install, magicast `addVitePlugin`/`addNuxtModule`, managed option block, diff preview, `--yes`, no entry-file edits); `vue-grab/nuxt` module (`addVitePlugin`, client-only `addPluginTemplate`, Nitro open handler, dev-only early return); exports/types/dts/`publint`/`attw`; IIFE pass; production-leak, CSP, SSR-hydration and Vite 5 Playwright fixtures; ESLint/`optimizeDeps.exclude`/`resolve.dedupe` wiring; MIT attribution gate; changesets.
**Findings applied:** pitfalls 15, 16, 17, 18, 19; `STACK` packaging/engines; `FEATURES` CLI/Nuxt rows.
**Research flag:** Vite 8/Rolldown option surface and Nuxt HTML/module wiring still shift between minors — verify against the exact pinned versions.

### Phase Ordering Rationale

- The **attribute contract** (`constants.ts` + loc grammar) must exist before the compiler, runtime resolver, and CLI can be built independently; it is Wave 0 in the architecture's build graph.
- A **DOM-only copy slice first** proves activation, hit-testing, clipboard, teardown and the demo harness — the risks that do not need Vue internals — before precision and freeze add their own failure modes.
- **Freeze before full output** because every later feature (multi-select, drag, prompt) assumes a stable page; retrofitting freeze after the UI is assembled hides double-freeze and restore bugs.
- **CLI last** because it writes `vue-grab/vite` and `vue-grab/nuxt` into user config; shipping it against an unstable option shape creates migration debt.
- This ordering matches `PITFALLS`' P1–P5 mapping while satisfying `PROJECT.md`'s "each phase is a runnable slice" rule.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every version/peer/engine from the npm registry on 2026-10-20; core APIs verified in Vue 3.5.34 source. |
| Features | HIGH | Enumerated from upstream v0.2.0 source, its architecture doc and 58 Playwright specs, then mapped to Vue. |
| Architecture | HIGH (internals) / MEDIUM (3.6+) | Component/scope/vnode behavior read from source; Vapor is still RC. |
| Pitfalls | HIGH | Source-verified mechanisms plus empirical probes (slots, prod build, offsets, `tagType`). |

**Overall confidence:** HIGH.

### Gaps to Address

- **Vue 3.6/Vapor:** keep the peer range at `^3.5.0` until an e2e run passes on 3.6 RC; the adapter is the only seam that should change.
- **CSP without nonce:** decide during Phase 5 whether `adoptedStyleSheets` becomes primary; test with `style-src 'self'` in the fixture app.
- **SSR hydration proof:** the both-compilers rule is reasoned, not yet experimentally confirmed — add the Nuxt hydration count test in Phase 2 or 5.
- **Drag-select semantics:** coverage threshold, sampling density, and ordering by document position need measured defaults.
- **Vite 5 coverage:** only Playwright can exercise it (Vitest 5 needs Vite 6.4+); keep the fixture minimal but real.

## Sources

### Primary (HIGH confidence)
- `vuejs/core` v3.5.34 source — `renderer.ts` (dev-gated `__vnode`/`__vueParentComponent`, render effect inside `instance.scope`), `component.ts` (detached `EffectScope`, `__file`/`__name`, `getComponentName`), `reactivity/effectScope.ts` + `effect.ts` (`pause`/`resume`, paused-effect queue), `apiCreateApp.ts` (`__vue_app__`), `compiler-core`/`compiler-sfc` (1-based `loc`, descriptor AST).
- npm registry queried 2026-10-20 — versions, peer ranges and `engines` for Vue, Vite, `@vitejs/plugin-vue`, TypeScript, Vitest, Playwright, ESLint, Nuxt, pnpm and all runtime/CLI libraries.
- Vite docs — library mode, `build.rolldownOptions`, plugin hooks, `configureServer`, `transformIndexHtml`, `/__open-in-editor`.
- `@vitejs/plugin-vue` 6.0.10 dist — `__file` dev behavior, descriptor caching, `api.options`.
- Nuxt docs — `defineNuxtModule`, `addVitePlugin`, `addPluginTemplate`, `addServerHandler`.
- Local probe in this workspace — `@vue/compiler-sfc` node transform on the descriptor AST produced `/src/App.vue:6:3` for nested elements.

### Secondary (MEDIUM confidence)
- `vite-plugin-vue-inspector` 7.0.0 dist — proven `enforce: 'pre'` + compiler parse + MagicString pattern and its idempotency/HMR caveats.
- `react-grab` v0.2.0 source, architecture doc and e2e specs — grammar constants, freeze/pseudo-state/clipboard utilities, CLI detection, MIT attribution.
- MDN — `attachShadow`, `style-src`/CSP behavior for inline styles and constructable stylesheets.

### Tertiary (LOW confidence — needs validation)
- Vue 3.6/Vapor compatibility and Rolldown hook/option stability — inferred from RC status, not verified in this repo.
- CSP fixtures in enterprise apps without nonces — behavior reasoned from spec, not measured here.

---
*Research completed: 2026-10-20*
*Ready for roadmap: yes*
