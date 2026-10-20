# Feature Research

**Domain:** Dev-only in-page element inspection overlay for Vue 3.5+ (runtime + Vite compiler plugin + CLI)
**Researched:** 2026-10-20
**Confidence:** HIGH — behavior enumerated from react-grab v0.2.0 source, its architecture doc and 58 Playwright specs, and Vue 3.5.34 internals.

**Complexity key:** S = one focused surface area; M = several interacting surfaces or one fragile subsystem; L = multiple subsystems, edge-case matrix, or performance-sensitive.

**Scope key:** `v1` = ships the validated core loop; `v1.x` = valuable polish after the core works; `v2` = deliberate expansion; `out` = explicitly excluded.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = the port is not Vue Grab.

| Feature | Why Expected | Complexity | Dependencies | Scope | Vue Implication | Notes |
|---------|--------------|------------|--------------|-------|-----------------|-------|
| Activation modes: toggle and hold, configurable key + hold duration | The shortcut is the only entrypoint; upstream users expect `Cmd/Ctrl+C` and hold-to-peek | M | Overlay mount, key parser | v1 | Listen in capture phase on `window`; Vue binds handlers per element, so capture runs first. Ignore `event.isComposing` and keyCode `229` or CJK input breaks. Never `preventDefault` on modifier-only keydown. Default `Meta+C`/`Ctrl+C`, but a bare `C` must not activate. | `activationMode: "toggle" \| "hold"`, `activationKey: string \| (e) => boolean`, `keyHoldDuration` (default 100 ms). Release of the activation key/modifier ends hold mode but not toggle mode. |
| Host key safety and input/IME handling | The overlay must not break the app's own keyboard handling | M | Activation modes | v1 | Vue apps have no global synthetic delegation; `stopImmediatePropagation` on a capture listener usually works, but the robust path is upstream's `KeyboardEvent.prototype.key` claimer (claimed events read `""`). Detect inputs with `event.composedPath()[0]` so `v-model` fields inside shadow roots are respected. | `allowActivationInsideInput` (default true upstream). Text selection in inputs must still copy normally when inactive. |
| Isolated overlay mount | Host styles, stacking contexts and event handlers must not be affected | M | Dev-only guard | v1 | Mount a second, independent `createApp` into an `open` shadow root on `<body>`; never register it on the host app. Host element is `position:fixed; inset:0; pointer-events:none`; children opt back in. `Teleport` inside the overlay must stay inside the shadow root, not target `body`. Defer mount to `DOMContentLoaded` if `<body>` is absent. | `data-vue-grab-host` / `data-vue-grab-ignore` attributes; overlay excluded from hit testing. Canvas or DOM highlights both work because the app is isolated. |
| Hover hit-testing with filtering | Hover is the primary discovery gesture | M | Overlay mount | v1 | `document.elementsFromPoint` returns the shadow host, not inner nodes; walk `elementsFromPoint` + open `shadowRoot.elementFromPoint` recursively. Resolve to the nearest element with `__vueParentComponent` (text nodes → parent). Skip invisible/zero-size elements, `data-vue-grab-ignore` subtrees, the overlay, and page-covering transparent layers. | Throttle ~16 ms, cache per point, re-detect on scroll/resize without pointer movement. `v-show` is skipped; `v-if` needs no special case. Same-origin iframe traversal is v2. |
| Selection box + element label | Users need immediate confirmation of what will be copied | M | Hover hit-testing | v1 | Label shows tag, Vue component name (`type.__name` → `type.name` → filename), and source path. Read source from the compiler attribute first; fall back to `instance.type.__file`. Strip `data-v-*` scoped-style attributes and the injected `data-vue-grab-loc` from the preview. | Label clamps to viewport, arrow flips, follows scroll and element resize. For multi-select show count and per-element labels. |
| Click-to-copy with success and failure feedback | Click is the fastest copy path | S | Selection, copy grammar | v1 | Clipboard write must happen in the click/keydown gesture; prefer synchronous `execCommand("copy")` with a hidden textarea (upstream choice), with async Clipboard API as fallback. Restore focus to the pre-activation element across shadow roots (`shadowRoot.activeElement`). | States: idle → copying → copied/error. Do not deactivate until the write resolves. Failure must be visible and retryable, never silent. |
| Shift-click multi-select | Users routinely grab several elements in one prompt | M | Click-to-copy, selection store | v1 | Accumulate by DOM element identity, not component identity: every `v-for` row shares one component. Shift re-click toggles off. On Shift release commit one copy containing one block per element. `element.__vnode.key` supplies the list-key hint React gets from fiber props. | Hover preview while Shift is held; per-element labels and copied flashes; reset on non-Shift click or window blur. |
| Drag-rectangle multi-select | Selecting a region is faster than clicking each item | L | Hover hit-testing, selection store | v1 | Sample a grid inside the drag rect with `elementsFromPoint`, select only elements whose boxes are covered (not merely intersected), dedupe, and order by document position. Only rendered Vue nodes exist (virtual scrolling is invisible), so results are inherently viewport-bound. | Coverage threshold, sample spacing, min/max samples, overlay exclusion. Shift+drag extends an existing selection. |
| Copy grammar: HTML preview + component ancestry + exact `file:line:column` | This text is the product; an agent must land in the real SFC | L | Source resolution, selection | v1 | Primary location is the compiler-injected template attribute on the element (usage site). This is essential for slot content: the DOM node is rendered by the child component, but `__vueParentComponent` may point at the child while the author wrote the markup in the parent. Component ancestry comes from `__vueParentComponent` and must filter Vue built-ins. | One bracket per element, joined by `\n`: `[<button class="btn" data-testid="save">Save</button> in SaveButton (at src/components/SaveButton.vue:12:5)]`. Flatten multi-line previews to spaces for the reference form. Multi-select preserves one entry per DOM element even when two entries render identical text. |
| Source resolution and normalization | Wrong paths are worse than no path | M | Vite plugin, Vue runtime | v1 | Resolve in order: `data-vue-grab-loc` → `instance.type.__file` → component name only. Normalize `/@fs/`, absolute Vite paths, `?vue&type=template`, Windows separators. Keep an absolute path for editor opening and a project-relative path for display. Cache per element; invalidate on HMR (`__hmrId`/component type change), not forever. | Runtime `__file` has no line/column, so it degrades to a file-only reference. Never fetch bundles or source maps at runtime. Display name fallback: `__name` is inferred from filename for `<script setup>`. |
| Freeze Vue reactivity | Moving/animating UI makes selection impossible | L | Activation, mounted app discovery | v1 | Discover mounted roots through `container.__vue_app__`; call `app._instance.scope.pause()` — Vue 3.5 recursively pauses child scopes and their effects. Must exclude the overlay's own app scope. On resume, Vue coalesces to the latest state rather than replaying every intermediate update (unlike upstream's React buffering). | Handle multiple apps (micro-frontends, tests). Pause only while grab mode is active; prompt mode and context menus stay frozen. Never monkey-patch the Vue scheduler. |
| Freeze CSS, WAAPI, SMIL and rAF animations | Frozen UI must look frozen, not jump | L | Freeze session | v1 | Vue `<Transition>` drives CSS transition/animation classes, and apps may also use WAAPI, so cover both: inject `animation-play-state:paused; transition:none` scoped to frozen elements, collect `element.getAnimations({subtree:true})`, pause SMIL via `pauseAnimations()`, and pause self-rescheduling rAF loops. Finish animations on unfreeze rather than resume mid-flight. Exclude overlay shadow root. | Use a global `*` pause only above an animation-count threshold; targeted selectors avoid full-document style recalc. Depth-count SVG freezes. |
| Freeze pseudo-states (`:hover`, `:focus`) | Hover styles vanish the moment the pointer moves to the overlay | M | Freeze session | v1 | Snapshot computed values for the hovered/focused chain and pin them as inline styles; include `display` so hover-revealed dropdowns stay open. `:focus-visible`, scoped CSS and `v-bind()` CSS variables are covered by computed values. Remove inline overrides on unfreeze. | Also block synthetic mouseenter/leave/focus events while hit testing. Follow the composed tree into open shadow roots. |
| Prompt/comment mode | "Copy with an instruction" is the agent workflow | M | Selection, copy flow | v1 | Overlay textarea lives in the shadow app; `compositionstart/end` must gate Enter so IME confirmation does not submit. `Enter` submits, `Shift+Enter` inserts newline, `Escape` with text asks to discard. Output is `prompt + "\n" + reference blocks`. The host app's frozen scopes must not freeze the overlay app. | Entering prompt mode freezes the chosen element; per-element prompt when a non-first multi-selection is targeted. Empty submission cancels without confirmation. |
| Open in editor | The copied location should be actionable without searching | M | Source resolution | v1 | Vite/Nuxt expose `/__open-in-editor?file=<abs>&line=&column=`. Send the absolute path, not the project-relative display path. Fallback to `vscode://file/<abs>:line:column` / configurable URL. Compiler paths may be root-relative; the runtime needs the dev root or an absolute path in the attribute. | `Cmd/Ctrl+O` and context-menu Open. Disable when only a component name is known. `transformOpenFileUrl` hook. |
| Context menu | Right-click is the discoverable action surface | M | Selection, plugin actions | v1 | Capture `contextmenu` only while active and suppress the host menu; freeze the target; position in viewport coordinates. Vue apps often ship their own custom context menu — do not suppress it when grab is inactive. Menu renders in the shadow root; do not `Teleport` to body. | Actions: Copy, Comment, Open. Disabled states per action. Escape/outside click dismisses; keyboard `Shift+F10`/`ContextMenu` opens. |
| Floating toolbar | Persistent affordance for activation and the default action | M | Activation, overlay mount | v1 | Independent Vue component in the shadow root; drag/snap to viewport edges; persist `edge`, `ratio`, `collapsed` (upstream persists in `localStorage`); vertical layout on left/right edges. Must remain visible through SPA route changes and body replacement. | Default action button (Copy or Comment), collapse/expand, toolbar menu for choosing the default. Toolbar hover must hide or keep the selection deliberately, not flicker. |
| Keyboard navigation and hierarchy dropdown | The overlay promises full keyboard operation | L | Hover/selection, hierarchy builder | v1 | Build hierarchy from DOM ancestors/siblings/children, labeling rows with tag + Vue component name. Arrow keys spatial-navigate, `Tab`/`Shift+Tab` mirror left/right sibling, `Shift` reveals the dropdown, `Enter` copies, `Escape` backs out. `display:contents` wrappers need bounds fallback. Skip overlay and ignored subtrees. | Navigation history, backtracking, "discard keyboard selection?" confirmation before mouse handoff, and no arrow navigation while prompt/menu is open. |
| Dev-only guard and SSR-safe import | Importing the package must never affect production or SSR | S | None | v1 | No top-level `window`/`document` access. Export a no-op API when `typeof window === "undefined"` or not DEV. In Nuxt, import only from a `.client` plugin guarded by `import.meta.dev`. `__VUE_GRAB_DISABLED__` escape hatch. | Vite conditions/tree-shaking must drop the runtime from production builds; an inert guarded import is acceptable. |
| Vite compiler plugin for exact template locations | `__file` alone cannot name a line/column | L | `@vue/compiler-sfc` / `@vitejs/plugin-vue` | v1 | Parse the SFC and inject `data-vue-grab-loc="relPath:line:col"` on native elements. Compiler AST positions are 1-based. Reusing the descriptor AST from `@vue/compiler-sfc`'s `parse()` keeps locations SFC-relative; if you parse `descriptor.template.content` yourself, add `descriptor.template.loc.start.line - 1` (and the first-line column offset). Components receive fallthrough attrs unreliably (`inheritAttrs:false`, fragment roots), so inject native elements only. Skip `lang="pug"`/external `src` templates. | Serve-only, before `vite:vue`; preserve source maps with `MagicString`; normalize Windows paths; do not touch `<script>`/`<style>`. Recommended exposure: separate `@vue-grab/vite` package so the browser runtime keeps zero Node deps; a `vue-grab/vite` subpath is a later convenience alias, not v1. |
| CLI `init` | Manual wiring is the main adoption friction | L | Runtime, Vite plugin, Nuxt | v1 | Detect `vue` ^3.5 plus Vite or Nuxt; detect `@vitejs/plugin-vue`; install packages with the detected package manager. Generate a managed `src/vue-grab.ts` with `if (import.meta.env.DEV) init({...})`, then add one idempotent import to `main.ts`. Add `vueGrab()` to `vite.config.ts`. Nuxt: add the Vite plugin for both client and server dev compilation and a `.client` plugin guarded by `import.meta.dev`. | Show the diff before writing; never overwrite user code without confirmation; non-interactive `-y`; works in monorepos (`-c`). No telemetry/version ping. |
| CLI `configure` | Users need to change the shortcut after install | M | CLI init | v1 | Re-prompt/validate `activationKey`, `activationMode`, `keyHoldDuration`, `maxContextLines`, `allowActivationInsideInput`; persist them into the generated `src/vue-grab.ts` options object (not a `data-options` script attribute, because the runtime is imported). Use managed markers so only the generated block changes. | `--key`, `--mode`, `--hold`, `--max-context-lines`; diff preview; live `setOptions` for programmatic users. |
| Nuxt integration | Nuxt is the dominant Vue meta-framework | M | Vite plugin, runtime | v1 | Vite plugin must run in both dev compilers (client and server) so SSR HTML and client DOM agree; otherwise the injected attribute causes hydration mismatch. Runtime loads from `plugins/vue-grab.client.ts` under `import.meta.dev`. Filter Nuxt internals (`NuxtPage`, `NuxtLayout`, `NuxtRoot`, router wrappers) from ancestry. | Prefer a thin Nuxt module (`@vue-grab/nuxt`) later; v1 can be CLI-generated config. `__file` paths are absolute in Nuxt, so relativize for display. |
| Viewport, scroll and DOM-mutation resilience | Real apps are SPAs with moving DOM | M | Hover, selection | v1 | Recompute bounds on scroll, resize, `visualViewport` zoom and element size changes. Re-resolve disconnected elements after route/HMR swaps using an anchor (selector + stable attributes) and drop only when recovery fails. Vue HMR replaces component types; cached source info must not outlive the type identity. | Element cache keyed by element + revision. Avoid restyling the whole document on hover/scroll. |
| Focus-trap and host-interaction isolation | Modals, dialogs and focus traps must not swallow the overlay | M | Overlay mount | v1 | Capture pointer/key events before app-level handlers; use `shadowRoot.activeElement` for focus checks. Return focus without scrolling on deactivate. Keep the host `pointer-events:none`; don't set `inert` on page content. | Verified scenarios: focus-trapped modal, body `pointer-events:none`, third-party interference overlays, host cleanup on dispose. |
| Basic public API | Tests, demos and CLI wiring need programmatic control | M | Runtime | v1 | `init(options)` returns the API; expose `window.__VUE_GRAB__`; no-op on SSR/prod. `getSource(element)` returns `{ filePath, lineNumber, columnNumber, componentName }` from the Vue resolver; `copyElement` accepts Vue-rendered elements; `dispose()` resumes scopes and removes listeners. Dispatch `vue-grab:element-selected`. | `activate`, `deactivate`, `toggle`, `comment`, `isActive`, `getState`, `setOptions`, `reset`, `dispose`, `copyElement`, `getSource`, `getStackContext`. |
| CSP nonce support | Strict dev apps block injected `<style>` | S | Overlay mount | v1 | Detect existing `nonce` on `<style>`/`<script>` and apply it to the shadow-root stylesheet; no inline event handler attributes; runtime-only Vue build (SFCs are precompiled, so no `unsafe-eval`). | Upstream has a dedicated CSP spec. Dev-only but trivial to do correctly. |

### Differentiators (Competitive Advantage)

Features that set Vue Grab apart from both React Grab and existing Vue tooling.

| Feature | Value Proposition | Complexity | Dependencies | Scope | Notes |
|---------|-------------------|------------|--------------|-------|-------|
| Compile-time exact template line/column | Agents edit the right line, not the `<script setup>` or a guess from `__file` | L | Vite plugin, copy grammar | v1 | The core differentiator versus runtime-only resolvers. Must survive slots, `v-for` and dynamic components. |
| Vue SFC-aware ancestry | The copied trace names real Vue components, not DOM wrappers | M | `__vueParentComponent` | v1 | Filter `Transition`, `KeepAlive`, `Teleport`, `Suspense`, `BaseTransition`, `Fragment` and Nuxt router internals; use `__name`/`__file` fallbacks; include usage-site and definition paths when they differ (slots, dynamic components). |
| Multi-element context blocks | One prompt can describe a whole section | M | Shift/drag selection, copy flow | v1 | Deduplicate identical text but never collapse distinct DOM elements. One bracket per element keeps the agent's edit target unambiguous. |
| Agent-oriented hints: selector + `v-for` key | Gives the agent a second way to locate an element when source paths are ambiguous | M | Copy grammar | v1 | Semantic selectors only (`#id`, `data-testid`, `aria-label`, `href`) beside trusted source; structural selector as fallback when no trustworthy source exists. `element.__vnode.key` for list rows. |
| Context budget / source classification | Keeps traces short but surfaces the meaningful feature component | M | Ancestry | v1 | `maxContextLines` default 3; library and shared-UI frames (`components/ui`, `packages/ui`, `design-system`) are free up to a hard cap, so wrapper noise cannot crowd out app code. |
| Theme system (hue + layer visibility) | Fits the overlay into any app without CSS fighting | M | Overlay mount | v1.x | CSS custom properties inside the shadow root; `hue` rotation plus toggles for selection box, drag box, grabbed boxes, label and toolbar. Deep-partial merge from `init`/`setOptions` options. |
| Touch/mobile mode | Reviewing responsive layouts from a tablet | M | Activation, selection | v1.x | Pointer events; tap selects, short drag is a tap, touch flag suppresses stale hover; textarea font-size ≥16 px avoids iOS zoom. |
| Accessible overlay semantics | Keyboard-first users and audits | M | Toolbar/menu/nav | v1.x | Roles, labels, focus rings, Escape hierarchy; overlay must not become a page-wide focus trap. |
| Plugin registry + action/hook pipeline | Teams can replace copy/comment/open or add actions without forking | L | Public API, action context | v2 | Upstream-shaped: `Plugin`, `actions`, `hooks`, `transformCopyContent`, `transformAgentContext`, `transformOpenFileUrl`, ordered reduce. |
| Framework-agnostic primitives subpath | Build custom pickers on the same engine | M | Runtime core | v2 | `getElementAtPoint`, `getElementBounds`, `getElementContext`, `freeze`, `copyContent`. Vue-specific resolver stays an internal adapter. |
| Same-origin iframe + open shadow-root traversal | Component previews/storybooks embed apps | L | Hit testing, source resolution | v2 | Cross-realm `instanceof` checks must be duck-typed; forward pointer/key events from iframes; closed shadow roots only degrade to the host. |
| Global IIFE build / CDN install | Zero-build demos and quick trials | S | Runtime | v1.x | Manual `<script>` path; the npm + Vite path remains primary. |
| Editor URL transform + fallbacks | Works with VS Code, Cursor, JetBrains, remote dev containers | S | Open in editor | v1.x | `transformOpenFileUrl` plus dev-server first, protocol fallback second. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative | Complexity | Dependencies | Scope |
|---------|---------------|-----------------|-------------|------------|--------------|-------|
| Runtime source-map fetching/symbolication (the React/bippy approach) | React Grab resolves bundled frames this way | Vue templates are compiled into render functions; bundle positions do not map to template columns, and fetching bundles/source maps adds network traffic, latency and dev-server load | Inject a template location attribute at compile time; use `__file` only as a degraded fallback | L | — | out |
| Patching the Vue scheduler/renderer or `nextTick` internals to buffer updates | Mirrors React's update buffering | Coupled to Vue internals, breaks across minors, can corrupt watcher ordering, and is unnecessary: `EffectScope.pause()` is public in 3.5 | Pause component scopes and accept latest-state coalescing on resume | L | — | out |
| Mounting the overlay inside the host Vue app | "Reuse the app's Vue instance" | Pollutes the component tree, inherits app plugins/provides, can be unmounted by route changes, and exposes overlay internals to user code | Independent `createApp` in a shadow root | M | — | out |
| Universal `* { animation-play-state: paused }` freeze on every activation | Simplest freeze implementation | Forces a full-document style recalculation (~62 ms measured upstream on a CSS-heavy page) and can break overlay animations | Targeted attribute-scoped freeze; global fallback only above an animation-count threshold | S | Freeze session | out |
| Searching the DOM at runtime for `__file` on every element | Avoids a compiler plugin | No line/column, slow on large trees, and wrong for slot content; encourages per-hover full scans | Compiler attribute primary, cached nearest-instance fallback | M | — | out |
| Production injection or automatic dev-only detection by bundler heuristics | "Just works everywhere" | Changes production HTML and bundle output, leaks source paths, can break hydration | Explicit `import.meta.env.DEV` / `import.meta.dev` guard, serve-only plugin | S | — | out |
| Telemetry / anonymous version check | Usage analytics and upgrade prompts | Violates the stated privacy constraint; adds a network dependency to a dev tool | None; print version locally | S | — | out |
| Browser extension distribution | Upstream has one | Separate distribution, permissions, CSP and cross-origin source access; not core value | npm + Vite plugin + CLI | L | — | out |
| Three.js/WebGL object selection | Upstream supports R3F meshes | Separate picking subsystem, renderer-specific, no Vue equivalent in scope | DOM-only selection | L | — | out |
| Vue 2 / Vue < 3.5 compatibility | Larger install base | No `EffectScope.pause()`, different component internals, EOL | Require Vue 3.5+ | L | — | out |
| React/Svelte/Solid adapters | "One tool for every framework" | Multiplies resolvers and test matrices; Vue-specific source accuracy is the product | Vue-only runtime; primitives stay framework-agnostic | L | — | out |
| Automatic code edits, MCP server, agent client | "Close the loop" | Expands scope from context supplier to agent integration, auth, permissions and file mutation | Clipboard text plus a stable public API; agents consume the text | L | — | out |
| Persisting active selection across reloads | "Resume where I left off" | Stale DOM references and surprising activation on page load | Persist toolbar position/collapse and options only | S | — | out |
| Closed shadow-root introspection | Complete coverage | The DOM API cannot reach closed roots; any workaround is a hack with misleading source | Degrade to the shadow host; document the limitation | M | — | out |
| Auto-installing packages / rewriting files without confirmation | Faster onboarding | Irreversible edits in unfamiliar repos, lockfile churn, broken configs | Show diff, require confirmation, support `--dry-run` | S | CLI init | out |
| Nuxt server-component symbolication (RSC equivalent) | React Grab has Next.js symbolication | No Vue/Nuxt equivalent in scope; compile-time attributes already cover SSR dev output | Compiler attributes for server-rendered templates | M | — | out |

## Feature Dependencies

```
Overlay mount (shadow root)
    ├──requires──> Dev-only guard
    └──requires──> Activation modes
                       └──requires──> Host key safety

Hover hit-testing ──requires──> Overlay mount
        │
        ├──requires──> Element resolver (Vue instance + compiler loc)
        │                   └──requires──> Source normalization
        └──requires──> Selection box + label

Click-to-copy ──requires──> Copy grammar
Shift multi-select ──requires──> Click-to-copy + selection store
Drag multi-select ──requires──> Hover hit-testing + selection store

Copy grammar ──requires──> Vue ancestry
        └──requires──> Source resolution
                ├──enhanced by──> Vite compiler plugin
                └──enhanced by──> Runtime `__file` fallback

Freeze session
    ├──requires──> Activation modes
    ├──requires──> Vue app/scope discovery
    ├──requires──> Animation freeze
    └──requires──> Pseudo-state freeze

Prompt mode ──requires──> Copy flow
Open in editor ──requires──> Source resolution
Context menu ──requires──> Selection + action registry
Toolbar ──requires──> Activation + overlay mount
Keyboard navigation ──requires──> Selection + hierarchy builder

CLI init ──requires──> Runtime + Vite plugin
CLI configure ──requires──> CLI init
Nuxt integration ──requires──> Vite plugin + runtime (client-only import)

Basic public API ──enhances──> CLI init + tests
Theme ──enhances──> Overlay mount
Plugin registry ──enhances──> Context menu + copy pipeline (v2)
Primitives ──requires──> Runtime core (v2)
Iframe/shadow traversal ──enhances──> Hit testing + source resolution (v2)
```

### Dependency Notes

- **Copy grammar is enhanced by the Vite plugin, but must not fail without it:** the runtime fallback (`__file`) keeps manual-install and non-Vite users functional, just less precise. This is why the plugin ships in v1 but copy cannot hard-depend on it.
- **Freeze must be one coordinated session:** reactivity, animations and pseudo-states share activation/deactivation. Splitting them produces visual jumps and double-resume bugs.
- **Multi-select requires per-element entries, not per-component:** Vue's `v-for` renders many DOM nodes from one component, so component identity is not a selection identity.
- **Nuxt requires both compilers to agree:** injecting the location attribute only on the client produces a hydration mismatch in dev SSR. The Nuxt integration depends on applying the Vite plugin to server and client dev compilation.
- **CLI configure depends on generated-file ownership:** options must live in a managed block so re-running configure never rewrites user code.
- **Plugin registry and primitives conflict with a tiny runtime:** they are deferred to v2 so the v1 browser bundle stays close to upstream's footprint.

## MVP Definition

### Launch With (v1)

The validated core loop plus the installation path required to exercise it.

- [ ] Toggle/hold activation with configurable key and input/IME safety — the product has no entrypoint without it
- [ ] Shadow-root overlay, hover hit testing, selection box/label — the visible inspection loop
- [ ] Click copy, Shift multi-select, drag multi-select — all three selection modes are named requirements
- [ ] Copy grammar with Vue ancestry and exact `file:line:column` — the core value
- [ ] Vue scope freeze + animation/pseudo-state freeze — a moving page makes selection unusable
- [ ] Prompt/comment mode — required for agent-ready prompts
- [ ] Open in editor — completes the "context → edit" loop
- [ ] Context menu, floating toolbar, full keyboard hierarchy — upstream parity and an explicit requirement
- [ ] Vite compiler plugin (dev-only template locations)
- [ ] CLI `init` and `configure` for Vite, plus Nuxt detection/wiring
- [ ] Demo Vue app + Vitest unit tests + Playwright copy-flow e2e
- [ ] Basic public API and SSR-safe import (needed by the CLI, demo and tests)

### Add After Validation (v1.x)

- [ ] Theme system (hue + layer toggles) — once the overlay structure is stable
- [ ] Touch/mobile mode — when responsive review becomes a real workflow
- [ ] Accessible overlay semantics — after keyboard navigation proves the interaction model
- [ ] Global IIFE/CDN build — for zero-build demos
- [ ] Editor URL transforms and additional editor fallbacks — on user request
- [ ] Richer copy feedback (per-element status, retry hints) — when real clipboard failures are observed

### Future Consideration (v2+)

- [ ] Plugin registry/hooks — after the public API is exercised by real consumers
- [ ] Framework-agnostic primitives subpath — once the internal adapters are stable
- [ ] Same-origin iframe and open shadow-root traversal — storybook/design-system use cases
- [ ] Copy-format presets for agent targets — still clipboard text, not agent integration
- [ ] Nuxt module package — replace generated config once Nuxt usage is validated

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Activation modes + host key safety | HIGH | MEDIUM | P1 |
| Shadow-root overlay mount | HIGH | MEDIUM | P1 |
| Hover hit-testing + selection label | HIGH | MEDIUM | P1 |
| Click-to-copy + feedback | HIGH | LOW | P1 |
| Shift multi-select | HIGH | MEDIUM | P1 |
| Drag multi-select | HIGH | HIGH | P1 |
| Copy grammar + Vue ancestry + exact locations | HIGH | HIGH | P1 |
| Vue reactivity freeze | HIGH | HIGH | P1 |
| Animation/pseudo-state freeze | HIGH | HIGH | P1 |
| Prompt/comment mode | HIGH | MEDIUM | P1 |
| Open in editor | MEDIUM | MEDIUM | P1 |
| Context menu | HIGH | MEDIUM | P1 |
| Floating toolbar | MEDIUM | MEDIUM | P1 |
| Keyboard hierarchy navigation | HIGH | HIGH | P1 |
| Vite compiler plugin | HIGH | HIGH | P1 |
| CLI init | HIGH | HIGH | P1 |
| CLI configure | MEDIUM | MEDIUM | P1 |
| Nuxt integration | HIGH | MEDIUM | P1 |
| Viewport/DOM-mutation resilience | HIGH | MEDIUM | P1 |
| Focus-trap isolation | MEDIUM | MEDIUM | P1 |
| Basic public API | MEDIUM | MEDIUM | P1 |
| CSP nonce | MEDIUM | LOW | P1 |
| Theme system | MEDIUM | MEDIUM | P2 |
| Touch mode | MEDIUM | MEDIUM | P2 |
| Accessible semantics | MEDIUM | MEDIUM | P2 |
| Plugin registry | MEDIUM | HIGH | P3 |
| Primitives subpath | MEDIUM | MEDIUM | P3 |
| Iframe/shadow traversal | LOW | HIGH | P3 |
| Global IIFE build | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | React Grab (upstream) | Vue DevTools | vite-plugin-vue-inspector | LocatorJS | Our Approach |
|---------|-----------------------|--------------|---------------------------|-----------|--------------|
| Selection | Hover, click, Shift multi-select, drag rectangle | Component tree/instance inspection | Click-to-source on one element | Alt+click-to-source on one element | Same full selection model, Vue-native |
| Source accuracy | React fiber owner stack + source-map symbolication | Runtime component metadata; no template coordinates | Resolves the SFC; no agent-ready context | Resolves component source | Compile-time `data-vue-grab-loc` attribute; exact SFC template line/column |
| Copy for agents | Rich `[<tag> in Component (at path:line:col)]` grammar | None (inspect only) | None (opens editor) | None (opens editor) | Same grammar, Vue ancestry, selector/key hints |
| Multi-select | Yes | No | No | No | Yes, one context block per DOM element |
| Freeze | React dispatcher buffering + animation/pseudo-state freeze | No | No | No | `EffectScope.pause()` + animation/pseudo-state freeze |
| Prompt/comment | Yes | No | No | No | Yes, prepended to copied context |
| Open in editor | Next.js/Vite dev server + VS Code fallback | Yes | Yes | Yes | Vite/Nuxt endpoint + configurable fallback |
| Works without compiler plugin | Yes (runtime source maps) | Yes | Yes | Yes | Degraded: `__file` only (no line/column) |
| Framework | React only | Vue only | Vue only | Multi-framework | Vue 3.5+ only, by design |

## Sources

- `aidenybai/react-grab` v0.2.0 — `README.md`, `packages/react-grab/docs/architecture.md`, `src/types.ts`, `src/constants.ts`, `src/core/store.ts`, `src/core/context.ts`, `src/core/copy.ts`, `src/core/plugin-registry.ts`, `src/core/plugins/*`, `src/core/open-file-action.ts`, `src/primitives.ts`, `src/global-api.ts`
- Upstream Playwright specs (`packages/react-grab/e2e/*.spec.ts`): activation, hold activation, activation-key config, selection, drag selection, shift multi-select, prompt mode, context menu, open file, keyboard navigation/shortcuts, focus trap, freeze animations/pseudo-states/updates, shadow DOM, iframe, toolbar, theme customization, API methods, event callbacks, SSR, CSP, viewport, visual feedback, hover reveal, hit-test shield, style invalidation, heavy UI, zoom canvas
- Upstream CLI: `packages/cli/src/commands/init.ts`, `configure.ts`, `src/utils/detect.ts`, `src/utils/templates.ts`, `src/utils/transform.ts`
- Vue core v3.5.34 — `packages/runtime-core/src/renderer.ts` (`__vueParentComponent`, `__vnode`), `packages/runtime-core/src/component.ts` (`__file`, `getComponentName`), `packages/reactivity/src/effectScope.ts` (`pause`/`resume` recursive over scopes/effects), `packages/compiler-core/src/parser.ts` / `tokenizer.ts` (1-based line/column relative to the parsed template content), `packages/runtime-core/src/apiCreateApp.ts` (`__vue_app__`)
- Project constraints — `.planning/PROJECT.md` (Vue 3.5+, no telemetry, dev-only, runtime + Vite plugin + CLI, full core UX parity)

---
*Feature research for: Vue Grab — dev-only in-page Vue inspection overlay*
*Researched: 2026-10-20*
