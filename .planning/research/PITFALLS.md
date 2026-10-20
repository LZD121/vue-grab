# Pitfalls Research

**Domain:** Vue 3.5+ dev-only inspection overlay, Vite compiler plugin, and CLI (Vue port of `react-grab`)
**Researched:** 2026-10-20
**Confidence:** HIGH for Vue internals and package versions (verified against `vuejs/core` v3.5.34 source, upstream `react-grab` v0.2.0 source, and the npm registry on 2026-10-20); MEDIUM for long-term ecosystem/tooling choices.

**Roadmap phases used below:**

| Phase | Scope |
|-------|-------|
| **P1** | Runtime foundation — Shadow DOM shell, element → Vue instance adapter, hover/click/drag selection |
| **P2** | Source locations — SFC transform, Vite plugin, runtime `__file` fallback |
| **P3** | Freeze and input integrity — `EffectScope`/animation/pseudo-state freeze, keyboard capture, teardown |
| **P4** | Copy and actions — context serialization, attribute stripping, clipboard, comments, open-in-editor |
| **P5** | CLI, frameworks, release — Nuxt/SSR, package layout, publishing, license, production-build gate |

---

## Recommended Stack Baseline

This is the "boring" set this document assumes. Versions were current on 2026-10-20.

| Area | Recommendation | Why / what not to use |
|------|----------------|-----------------------|
| Runtime UI | Separate `createApp` mounted into an **open Shadow DOM** (`attachShadow({ mode: 'open', delegatesFocus: true })`), authored as Vue SFCs; `vue` is a peer dependency (`^3.5.0`) | Keeps overlay state and styles isolated from the host Vue app. Do **not** render the overlay inside the host app tree (freeze would pause it) and do **not** use Solid/vanilla DOM (extra runtime, no Vue idioms). |
| Runtime build | **Vite 8.3.4 library mode** + `@vitejs/plugin-vue` 6.0.10, formats `es` + a single-entry `iife`, `vue` external, CSS imported with `?inline` and installed as a constructable stylesheet | Vite is the only recommended builder that compiles `.vue` SFCs and CSS in one step. `tsup`/`unbuild`/`tsdown` cannot compile the overlay SFCs without bolting on plugin-vue; `tsdown` is still 0.x (0.23.1), `unbuild` last published 2025-08. |
| Node packages (CLI, optional plugin entry) | **tsup 9.0.0**, ESM only, `target: node22`, shebang banner for the bin | Simple, stable, no SFC requirement. Vite lib mode is awkward for a shebang CLI; `tsdown` 0.x is unnecessary risk. |
| SFC transform | Vite plugin with `enforce: 'pre'`, transforming the `.vue` main module before `@vitejs/plugin-vue`; parse with the user's `vue/compiler-sfc` (3.5.44), edit with `magic-string` 1.4.3 | Proven by `vite-plugin-vue-inspector`; avoids coupling to plugin-vue internals and keeps positions file-relative. A compiler `nodeTransforms` hook is the alternative, but plugin-vue does not read `config.vue.compilerOptions`; it must be passed directly to `vue()` or injected through its semi-private `api.options`. |
| Package exposure | `vue-grab` runtime + `vue-grab/vite` subpath in one package; CLI as `@vue-grab/cli` with a `vue-grab` bin (and a thin bin in `vue-grab`) | One version for runtime and plugin. Keep all Node-only imports inside `vue-grab/vite`; never import it from the browser entry. No CJS: Vite/Nuxt are ESM. |
| CLI | `commander` 15.0.0, `@clack/prompts` 1.8.1, `package-manager-detector` 1.9.0, `picocolors` 1.1.1, `ora` 9.4.1, `tinyexec` 1.3.1 | Commander is the stable standard. `@clack/prompts` replaces the unmaintained `prompts` 2.4.2 (last release 2021); it is ESM and handles cancellation. `ora` 9 is ESM-only — the CLI must be ESM. |
| Tests | **Vitest 5.0.5** + `@vue/test-utils` 2.5.1 + `jsdom` 30.1.3 for logic; Vitest browser mode (`@vitest/browser-playwright` 5.0.5) for geometry/Shadow DOM; **Playwright 1.64.1** for end-to-end | jsdom has no layout and no real hit-testing; do not use it to prove hover/freeze/clipboard behavior. Playwright must test clipboard permissions and the real Vite dev server. |
| Lint / format | **ESLint 10.13.0** flat config + `typescript-eslint` 8.72.0 + `eslint-plugin-vue` 10.11.1 + `eslint-config-prettier` 10.1.8; **Prettier 3.9.10** | Mature Vue/TS support. Do not use `oxfmt` 0.74/`oxlint` 1.89 as the only gate (pre-1.0, incomplete rule parity); optional as a fast pre-commit pass only. |
| TypeScript | **5.9.3** | TypeScript 7.0.2 is latest, but `typescript-eslint` 8.72 declares `typescript >=4.8.4 <6.1.0`; TS 7 breaks type-aware linting. Upgrade only when the Vue/lint toolchain supports it. |
| Workspace | **pnpm 12.14.0**, Node `>=22.12.0`, `pnpm-workspace.yaml` with `packages/*` + `apps/*`, shared versions in a `catalog:`; add `onlyBuiltDependencies: [esbuild]` | Vite 8 wants Node `^20.19 || >=22.12`; Vitest 5 wants `^22.12 || ^24 || >=26`. pnpm 10+ blocks dependency build scripts by default; esbuild's binary will be missing without the allowlist. |
| License | MIT, upstream `Copyright (c) 2025 Aiden Bai` plus Vue Grab's copyright | Required for a port; see Pitfall 19. |

---

## Critical Pitfalls

### Pitfall 1: Depending on Vue's dev-only instance handles in a build that strips them

**What goes wrong:**
The overlay resolves nothing: hover shows "Unknown component", copied paths are missing, and freeze no-ops. This can happen in a normal `vite build`, in a library's production fixture, or in a host app that manually imports `vue-grab` into a prod entry.

**Why it happens:**
`__vueParentComponent` and `__vnode` are attached only under `if (__DEV__ || __FEATURE_PROD_DEVTOOLS__)` in `packages/runtime-core/src/renderer.ts` (verified: mount path line ~721, patch path ~837). Published production Vue replaces `__DEV__` with `false`, so both properties disappear. `app._instance` is also set only in that branch (`apiCreateApp.ts` ~403). `__file` is added by `@vitejs/plugin-vue` only when devtools are enabled or a dev server is present; a normal production build omits it entirely, and with prod devtools enabled it is only `path.basename(filename)`. Verified in a production build: `__vue_app__` **is** still assigned unconditionally on the mount container, while `__vueParentComponent`, `__vnode`, and `app._instance` are absent — so the presence of `__vue_app__` is not a dev-mode signal.

**How to avoid:**
- Isolate every internal read in one adapter (`resolveVueInternals.ts`) with capability checks, not assumptions.
- Runtime entry no-ops with one `console.warn` when `typeof window === 'undefined'` or a probe element has no `__vueParentComponent`.
- The Vite plugin injects the runtime only when `command === 'serve'`; production builds contain zero runtime bytes. Manual imports still self-guard.
- Add a release gate that builds a fixture with `vite build` and asserts the output contains neither `vue-grab` nor `data-vue-grab-`.

**Warning signs:**
Every hover says "Unknown"; a rendered child under `#app` has no `__vueParentComponent` in the console; the production fixture network panel downloads a `vue-grab` chunk; copied context silently omits `file:line`.

**Phase to address:**
**P1** (adapter and guards), verified again in **P5** (production-build gate).

---

### Pitfall 2: Assuming `EffectScope.pause()` is a complete freeze primitive

**What goes wrong:**
The page keeps updating after activation, or it "jumps" on exit. Components mounted after activation are not frozen. Global watchers and non-Vue animation loops continue. On Vue < 3.5 the call throws.

**Why it happens:**
- `EffectScope.pause()` exists only in Vue 3.5+. Vue 3.4 and earlier have no equivalent.
- Render effects live in each component instance's **detached** scope (`new EffectScope(true)` in `component.ts` ~636; the effect is created between `instance.scope.on()/off()` in `renderer.ts` ~1589), so pausing one app-level scope is not enough; each mounted instance scope must be paused.
- Paused effects that receive triggers are queued and re-run on `resume()` (`reactivity/src/effect.ts` ~133–146 and ~207–208). State changes that happen during the freeze are applied on exit, which can look like a jump.
- Pause stops reactive effects, not `setTimeout`, `requestAnimationFrame`, WebSocket handlers, media playback, canvas loops, or imperative DOM writes.
- Async components and route-level components created while frozen have new scopes that were never paused.

**How to avoid:**
- Feature-detect: `typeof instance.scope?.pause === 'function'`; if absent, disable freeze but keep inspect/copy working.
- Traverse the app's component tree and pause every instance scope once (dedupe with a `Set`), including `vnode.component` children; pause `app._context.effects` separately for app-level effects if reachable.
- Document that "freeze" is best-effort: reactivity + CSS/WAAPI are frozen; timers and imperative canvas are not.
- Re-sweep for newly mounted instances while active (a cheap MutationObserver or a 250 ms interval), and resume only scopes you paused.
- Accept queued-update flush on resume; do not promise pixel-identical state, and test a counter/animation fixture around the freeze boundary.

**Warning signs:**
A clock keeps ticking; a component added by `v-if` after activation animates; values visibly catch up when the overlay closes; console errors on Vue 3.4; `scope.run()` warns "cannot run an inactive effect scope".

**Phase to address:**
**P3**.

---

### Pitfall 3: Freezing the overlay's own Vue app (or missing other apps)

**What goes wrong:**
The toolbar and highlight stop responding immediately after activation, or only the currently hovered app freezes while widgets/micro-frontends keep moving.

**Why it happens:**
The overlay is itself a Vue app. A blanket "pause every `EffectScope` in the document" includes the overlay's scopes. Conversely, there is no global Vue app registry: `__vue_app__` lives on each mount container, and a page can contain several apps, shadow roots, and same-origin iframes. `app._instance` is dev-only, so discovering roots by that property fails in some builds.

**How to avoid:**
- Snapshot host apps **before** mounting the overlay (scan elements for the `__vue_app__` property, recurse into open shadow roots and same-origin iframes). Keep that set; never pause the overlay app.
- Alternatively, tag the overlay host with an internal marker and skip any instance whose `instance.appContext.app` is the overlay app.
- Deduplicate apps/scopes; two widgets may share a Vue runtime but not an app.
- Fail soft when an iframe is cross-origin: skip it, show "frame not accessible" in the UI, and never throw.

**Warning signs:**
Overlay freezes on first hover; highlight stays after the pointer moves; closing the overlay unfreezes only one widget; two dropdown widgets behave differently.

**Phase to address:**
**P3** (with discovery helpers from **P1**).

---

### Pitfall 4: Traversing only DOM-upward component parents

**What goes wrong:**
Ancestry is incomplete or wrong for Teleport, Suspense, KeepAlive, async and functional components; shadow DOM and iframes are dead zones. Freeze misses large parts of the page.

**Why it happens:**
`element.__vueParentComponent` gives the nearest **stateful** component that rendered the DOM, then `instance.parent` walks logical parents. That chain:
- skips functional components (no instance exists),
- does not represent Teleport targets (logical parent is the declaring component; DOM parent is the target),
- hides Suspense boundaries (not component instances),
- cannot reach deactivated KeepAlive cache entries (no public API),
- does not cross shadow roots or iframe documents,
- is empty inside `v-html` content (no Vue-created nodes),
- may name an async wrapper instead of the resolved component.

**How to avoid:**
- Resolve ancestry from instances (`instance.parent`, `instance.appContext.app`) and label it "component ancestry", never derive it from `parentElement`.
- For freeze/traversal, walk `instance.subTree` recursively: arrays/fragments, `vnode.component`, Teleport children, `vnode.suspense.activeBranch`/`pendingBranch`; pause each `vnode.component.scope`.
- For hit-testing, use `event.composedPath()[0]` and recurse `shadowRoot.elementFromPoint`; `document.elementFromPoint` returns the shadow host, not the inner element.
- Treat functional components and `v-html` as documented gaps: show the nearest stateful ancestor and a file-only fallback.
- Same-origin iframes need their own overlay instance/listeners (or a frame bridge); cross-origin is explicitly unsupported. Do not attempt `contentDocument` access without a try/catch.
- KeepAlive deactivated instances are not visible; do not chase internal `__v_cache` fields.

**Warning signs:**
A Teleported modal reports different ancestry depending on whether you walked DOM parents or `instance.parent`; ancestry is `[App]` for a deeply nested page; hover inside an iframe does nothing; a route transition keeps animating while "frozen"; clicking a functional component's output reports its parent.

**Phase to address:**
**P1** (resolution), **P3** (freeze traversal), **P4** (copy semantics).

---

### Pitfall 5: Assuming slot content belongs to the component that renders it

**What goes wrong:**
Copied context contradicts itself: the component name is the child that renders the slot, but the source location points into the parent's template (or vice versa). Deduplication/grouping by component or file merges unrelated rows.

**Why it happens:**
Verified with Vue 3.5.44: a `<button>` passed as slot content has `__vueParentComponent` equal to the **child** component that renders `<slot/>` (`Child`), because slot functions execute during the child's render and `currentRenderingInstance` is the child. But the element's compiled `data-vue-grab-loc` was injected into the **parent's** template, because that is where the element is written. The two "owners" are different by design.

**How to avoid:**
- Model two fields: `renderedBy` (nearest instance from `__vueParentComponent`) and `definedIn` (the file/line from the loc attribute, plus the file's component when known).
- When `instance.type.__file` differs from the loc file, label the location as "template owner" and show both instead of claiming a single component.
- Do not dedupe selections by component or file alone; include element identity/selector and text.
- Test a parent → child slot fixture and snapshot the copied grammar.

**Warning signs:**
A copied entry says `Child` but the path is `Parent.vue`; moving the slot markup changes the reported component name; two selections from different parents collapse into one.

**Phase to address:**
**P2** (attribute schema), **P4** (serialization).

---

### Pitfall 6: Injecting location attributes onto components instead of native elements

**What goes wrong:**
Locations vanish on components with `inheritAttrs: false`; attributes land on an unexpected root; Vue warns about extraneous non-props attributes on multi-root components; component `$attrs` and prop identity are polluted.

**Why it happens:**
A `data-*` attribute on a component tag is not a DOM attribute at compile time — it becomes a fallthrough attr on the component's root element(s). Vue's compiler classifies nodes as `ELEMENT` (0), `COMPONENT` (1), or `SLOT` (2) (verified: `MyComp` = 1, `div` = 0, `<slot>` = 2). Injecting on `COMPONENT` or `SLOT` changes component props/attrs, not the rendered source location.

**How to avoid:**
- Inject only when `node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.ELEMENT`.
- Skip `<template>`, `<slot>`, `<component>`, `<Teleport>`, `<Suspense>`, `<KeepAlive>`, `<Transition>`, and other built-ins.
- Inject on native elements inside slots and `v-for`; they still carry the correct source line.
- Do not inject on a `<component :is>` usage expecting the resolved component's file; it only identifies the usage site.

**Warning signs:**
Missing loc on wrapper components; `[Vue warn]: Extraneous non-props attributes`; attrs appearing on a child's inner element; component props snapshots change after enabling the plugin.

**Phase to address:**
**P2**.

---

### Pitfall 7: Compile-time injection that changes SSR output, hydration, or hoisting

**What goes wrong:**
Server HTML and client DOM disagree; attributes are missing after hydration or stale after edits; absolute paths leak into SSR responses; dynamic injected expressions deoptimize static hoisting; malformed paths break attribute parsing.

**Why it happens:**
Adding a static attribute changes rendered vnode props on both server and client. Vue hydration only checks some props; it does not patch arbitrary attributes into the hydrated DOM. A client-only injected `data-*` attribute is therefore absent from SSR-rendered elements and is not repaired by hydration, while a server-only value can remain stale after the client would have changed it. Known HTML attributes may produce dev mismatch warnings; `data-*` attributes generally do not. Hoisted static vnodes are created once per module; `v-once`/cached subtrees keep the first value across HMR. Text-based injection also needs HTML attribute escaping (quotes, `&`, `<`). Injecting a computed expression (`:data-vue-grab-loc="..."`) turns a static prop into a dynamic one and can defeat hoisting.

**How to avoid:**
- Inject in **both** client and SSR dev transforms, or in neither; disable only in production builds (`command !== 'serve'`).
- Emit a **static** prop value (plain string), not a binding.
- Compute the path deterministically from the same Vite `root` on server and client; use root-relative POSIX paths.
- Escape text-transform values with the compiler's HTML escape helper; prefer AST/codegen injection where escaping is automatic.
- Do not claim hydration correctness without a fixture; add a Nuxt/SSR hydration test that counts elements with the attribute after hydration.
- Keep `v-once`/cached elements out of the "live loc" promise; document stale-loc behavior.

**Warning signs:**
Hydration warnings mentioning `data-vue-grab-loc`; some SSR elements selectable with no path; paths containing `/home/...` or `C:\...`; broken attributes on filenames with quotes or `&`; production HTML contains loc attributes.

**Phase to address:**
**P2** (injection), **P5** (SSR/hydration test, production leak check).

---

### Pitfall 8: Getting template line/column offsets wrong

**What goes wrong:**
Copied locations point into `<script setup>`, at the `<template>` tag, or at line 1; columns are off by one; Pug/Haml and external templates produce nonsense positions.

**Why it happens:**
- Verified: when compiling with `descriptor.template.ast`, `loc.start.line` is **SFC-relative** (a `<div>` on file line 6 reports line 6) and columns are 1-based. If you parse only `descriptor.template.content` without the AST, lines restart at the template block and columns restart at its first line.
- `<template lang="pug">` is preprocessed and the original AST is discarded; locations refer to generated HTML, not the `.vue` file.
- `<template src="./view.html">` compiles from a separate file; a transform on the `.vue` main module never sees it, and reporting the `.vue` line is wrong.
- Multi-line opening tags and elements on the same line expose column-offset bugs.
- Adding 1 to a 1-based column double-counts.

**How to avoid:**
- Parse the whole SFC (`@vue/compiler-sfc.parse`) and use `descriptor.template.ast` for locations, or pass that AST to `compileTemplate`.
- If standalone compilation is unavoidable, add `descriptor.template.loc.start.line - 1` and the first-line column offset.
- Skip line/column injection for non-HTML template languages and `src` templates; fall back to `__file` with "line unknown".
- Add golden tests: `<script setup>` with ≥10 lines before `<template>`, elements on the same line, nested elements, `v-for`, slots, and a multi-line opening tag. Assert exact `file:line:column`.
- Remember editor/launch-editor use 1-based line and column.

**Warning signs:**
Every loc is `:1:1` or `:2:1`; positions land in script lines; moving code inside `<script setup>` shifts reported template lines; the same element reports different lines in dev vs SSR.

**Phase to address:**
**P2**.

---

### Pitfall 9: Non-idempotent injection, HMR drift, and prebundled duplicates

**What goes wrong:**
Saving a file duplicates `data-vue-grab-loc` attributes, serves stale locations, or creates a second overlay/listener set. The host app runs two copies of Vue.

**Why it happens:**
- Vite can re-run transforms on already-transformed code; a naive text transform injects the attribute again.
- Text pre-transforms change the source plugin-vue sees. Its HMR descriptor comparison (`prevDescriptor` from disk vs current modified source) can consider the template changed on every edit and pick a rerender path; compiler-transform injection avoids this noise.
- A linked workspace package is prebundled by Vite's dependency optimizer; edits are not picked up and `vue` may be duplicated.
- The overlay module itself can hot-reload; re-evaluating it creates another app, host element, document listeners, and stylesheet.

**How to avoid:**
- Make injection idempotent: skip nodes that already have the attribute, or detect a marker in the source; never append a second attribute.
- Prefer a compiler `nodeTransforms` hook only when you can configure plugin-vue directly (no source mutation, accurate HMR diffs). The AST-parsed Vite pre-transform is the framework-agnostic path; add MagicString source maps and verify HMR with template-only, script-only, and style-only edits.
- Generate `optimizeDeps.exclude: ['vue-grab']` and `resolve.dedupe: ['vue']` in the CLI wiring.
- In the runtime, implement `import.meta.hot?.dispose(teardown)`: unmount the overlay app, remove the host node, remove window/document listeners, clear adopted stylesheets, resume frozen scopes/animations, and clear the singleton.
- Guard against double init with a versioned `window.__VUE_GRAB__` singleton, but still tear down on dispose.

**Warning signs:**
Two toolbars after a save; duplicate attribute in DevTools; old line after editing; Vite logs "new dependencies optimized"; console warning about two Vue copies; event handlers fire twice.

**Phase to address:**
**P2** (plugin idempotency/HMR), **P1** (teardown), **P5** (fixture verification).

---

### Pitfall 10: Making source maps or `__file` the primary location path

**What goes wrong:**
Copied context has a file but no line, absolute machine paths, or positions from compiled JS instead of the SFC. The overlay depends on a dev-server source-map endpoint that proxies/base paths break.

**Why it happens:**
`__file` is set by `@vitejs/plugin-vue` to the full filename when a dev server is present; a normal production build omits it, and with prod devtools enabled it is only `path.basename(filename)` (verified in plugin-vue 6.0.10). It has no line/column. Fetching source maps at runtime adds a network dependency, fails behind proxies and non-root `base`, and does not help for DOM created by render functions. Minification and production builds strip names, so any position derived from compiled code is unreliable.

**How to avoid:**
- Compile-time `data-vue-grab-loc` is the primary path; `__file` is a labelled fallback ("line unknown") and must never block copy.
- Do not build a source-map fetch path. It is out of scope for a dev overlay and violates the "no network except the dev server" simplicity.
- If `__file` is absolute, display the tail relative to a best-effort project root or just the basename; never send it off-machine.
- Keep the loc string parser greedy for the last two numeric segments so Windows drive colons (`C:/repo/App.vue:12:3`) survive.

**Warning signs:**
Copied entries end at the filename; every path starts with `/home/<user>` or `C:\`; positions point into `_sfc_render`; copy breaks when the dev server is behind a base path.

**Phase to address:**
**P2** (primary), **P4** (fallback wording).

---

### Pitfall 11: Internal attributes and freeze styles leaking into copied HTML/CSS

**What goes wrong:**
Pasted context contains `data-vue-grab-loc`, `data-vue-grab-frozen`, overlay host markers, absolute paths, and hover-freeze inline styles. The agent sees overlay plumbing as app markup, and the prompt is noisier than the page.

**Why it happens:**
`outerHTML`/`innerHTML` and `getAttribute` serialization read the live DOM, which includes injected attributes, runtime markers, and the inline styles pinned during pseudo-state freeze. The overlay's own host attributes can also be selected if hit-testing misses the shadow boundary.

**How to avoid:**
- Centralize one prefix (`data-vue-grab-`) and strip every attribute with that prefix when serializing HTML, CSS selectors, and attribute lists. Upstream uses exactly this rule (`strip-internal-attributes.ts`).
- Snapshot the original attribute values before freezing pseudo-states, or serialize from a clone with freeze-pinned styles removed. Do not let a hovered button's pinned `background-color` appear as authored CSS.
- Never copy the overlay host, shields, highlight canvas, or toolbar. Filter by the overlay's shadow host/marker at hit-test time and again at serialization time.
- Escape the copied text when writing the `text/html` clipboard flavor (`<pre><code>` + escaped content, as upstream does).

**Warning signs:**
Pasted HTML contains `data-vue-grab-loc` or `pointer-events: none`; copied CSS has `!important` hover colors the developer never wrote; an absolute path appears as an attribute value rather than in the source reference section.

**Phase to address:**
**P4** (with the marker contract defined in **P1**).

---

### Pitfall 12: Clipboard APIs used outside a user gesture or secure context

**What goes wrong:**
The UI says "Copied" but the clipboard is empty; copy fails on a LAN preview (`http://192.168.x.x`); copy fails when DevTools has focus or inside an iframe; the async call happens after an `await` and loses transient activation.

**Why it happens:**
`navigator.clipboard` requires a secure context (localhost is secure; LAN HTTP is not), document focus, and transient user activation. Permission policy can block it in iframes. Multi-format copy (plain text + HTML + custom MIME) also needs a synchronous `copy` event. Upstream uses `document.execCommand('copy')` with a hidden textarea and a `copy` listener precisely because it runs synchronously in the key event stack.

**How to avoid:**
- Attempt `navigator.clipboard.writeText` only inside the initiating click/key handler, before any await.
- Provide a synchronous `execCommand('copy')` fallback with a hidden textarea appended to `document.body` (not the shadow root) and a one-shot `copy` listener that sets `text/plain`, escaped `text/html`, and any custom MIME.
- Detect `window.isSecureContext` and `navigator.clipboard` and show a clear fallback message.
- Restore the previous focus and selection after copying; remove the textarea in `finally`.
- In Playwright, grant `clipboard-read`/`clipboard-write` explicitly and assert the actual clipboard contents.

**Warning signs:**
Works on `localhost` but not on the phone preview; `NotAllowedError` in the console; success toast without a paste; tests only mock the clipboard.

**Phase to address:**
**P4**.

---

### Pitfall 13: Keyboard capture that hijacks the host app

**What goes wrong:**
Typing in an input toggles the overlay; `Cmd/Ctrl+R` is swallowed; Escape closes a host modal; holding the activation key and Alt-Tabbing leaves the overlay stuck; shortcuts fire twice after HMR.

**Why it happens:**
Global `window` capture listeners run before the app's handlers. Listening for `keydown` without checking repeated keys, IME composition, editable targets, `defaultPrevented`, or shadow-DOM retargeting claims keystrokes the app needs. Hold mode needs a matching `keyup`, which never arrives if focus leaves the window. Event listeners added without teardown survive HMR.

**How to avoid:**
- Match the exact configured modifiers and the physical key (`event.code` for matching, `event.key` for display), not a loose `key` string.
- Ignore `event.repeat`, `event.isComposing`, `event.defaultPrevented`, and targets that are `input`, `textarea`, `select`, `[contenteditable]`, or inside the overlay (except overlay-owned shortcuts).
- `preventDefault` only the activation combo; do not `stopImmediatePropagation` for unrelated keys. When the overlay is active and consumes a key, `stopPropagation` from the capture listener is acceptable, but document it.
- Use `composedPath()` to detect overlay-origin events through the shadow boundary.
- Release hold mode on `window.blur`, `visibilitychange`, and `pointercancel`; remove all listeners in teardown.
- Test with a host app that binds the same combo and an input that receives plain characters.

**Warning signs:**
A "g" keystroke in a search box opens the overlay; browser reload shortcut is blocked; overlay stays active after switching windows; two handlers fire after saving.

**Phase to address:**
**P3**.

---

### Pitfall 14: Shadow DOM CSS leaks and the side effects of freezing pointer events

**What goes wrong:**
The overlay is styled by the host page (or the host page is restyled by the overlay); the overlay is unclickable because the page freeze also disabled it; hover states disappear or dropdowns collapse when the freeze starts; animations keep running; highlights are stale after scroll.

**Why it happens:**
Shadow DOM blocks selector matching but inherits font, color, direction, visibility, and custom properties. A freeze implemented as `html, body { pointer-events: none }` is inherited and also suppresses the overlay unless the overlay host re-enables `pointer-events`. It also suppresses `:hover`, so hover-revealed UI collapses. Toggling pointer-events on the root forces style recalculation across the whole document. `getAnimations()` forces a style flush, so freeze reads must happen before writes. Top-layer `<dialog>`/popover content renders above any z-index.

**How to avoid:**
- Style the overlay with a constructable stylesheet inside the shadow root; set `:host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }` and re-enable pointer events only on interactive overlay panels.
- Do not rely on Tailwind preflight or host CSS variables; define the overlay's own tokens, but allow a documented set of host custom properties.
- Use a hit-test shield of leaf panels (with holes for overlay/same-origin frames) instead of toggling `pointer-events` on `html`; upstream measured root toggling at 4.2 ms on 5.6k elements and 31–35 ms on 16k.
- Snapshot `:hover`/`:focus` computed values (background, color, border, shadow, transform, opacity, `display`, `visibility`) before dropping pointer events; restore exact inline values and priorities on exit, removing only properties you added.
- Freeze animations with `document.getAnimations()`/`element.getAnimations({subtree:true})` after all DOM reads, record the previous `playState`, and resume only animations you paused.
- Recompute highlight rects on scroll/resize (`ResizeObserver` + capture-phase scroll), not just on `mousemove`.
- For top-layer content, either append the highlight layer inside the dialog/popover or document the limitation.

**Warning signs:**
Host CSS changes the toolbar font; overlay clicks pass through; the hovered card loses its shadow when freeze starts; a dropdown closes instantly; animations continue; highlights detach on scroll; cannot select inside `<dialog>`.

**Phase to address:**
**P1** (shadow shell), **P3** (freeze and highlight geometry).

---

### Pitfall 15: CSP blocks the overlay's styles

**What goes wrong:**
The overlay renders unstyled or invisible under a strict Content Security Policy; console shows `style-src` violations; inline `style="..."` attributes are blocked.

**Why it happens:**
A `<style>` element inside a shadow root is still subject to `style-src`. Static `style="..."` attributes in overlay SFC templates are inline styles, and `setAttribute('style', ...)`/`style.cssText` are blocked too (verified in MDN's `style-src` guidance). Many Vite/Nuxt apps with CSP use nonces or hashes; the overlay cannot assume `'unsafe-inline'`. Constructable stylesheets (`new CSSStyleSheet(); sheet.replaceSync(css); shadowRoot.adoptedStyleSheets = [sheet]`) avoid `<style>` elements; current browsers do not block CSSOM parsing methods, but verify in the target browsers. Direct `el.style.prop = ...` writes are not blocked. Inline event handlers and `eval` are never acceptable.

**How to avoid:**
- Inject CSS via `adoptedStyleSheets`, with a `<style>` fallback only when constructable stylesheets are unavailable.
- Avoid static `style` attributes in overlay templates; use classes and CSSOM property writes for geometry.
- Use inline SVG for icons; avoid data-URI images if `img-src` is strict.
- Add a CSP fixture to the e2e suite (`style-src 'self' 'nonce-...'`) and document the requirement.
- Do not attempt to relax the host's CSP.

**Warning signs:**
Overlay HTML is correct but visually raw; CSP violation reports for inline styles; works in the demo app but not in the enterprise fixture.

**Phase to address:**
**P1** (styles), **P5** (CSP fixture).

---

### Pitfall 16: Nuxt SSR imports and Vite plugins that run in the build

**What goes wrong:**
`nuxt build` fails with `window is not defined`; the overlay never appears on SSR pages; server HTML contains absolute paths; hydration leaves some elements without loc attributes; the plugin bakes dev code into production.

**Why it happens:**
A top-level `window`/`document` access in the runtime module is evaluated during SSR. Nuxt applies `vite.plugins` to both client and server Vite configs, while `transformIndexHtml` is client-only, so the runtime injection mechanism may not reach the client. Dev SSR renders template attributes into HTML; a client-only transform does not repair them during hydration, because Vue does not patch arbitrary `data-*` attributes. `command === 'serve'` is the correct build gate — `mode === 'development'` is not (`vite build --mode development` still builds).

**How to avoid:**
- Runtime module: no top-level DOM access; export `initVueGrab()` and call it from a guarded client entry.
- Nuxt wiring: write `plugins/vue-grab.client.ts` with `export default defineNuxtPlugin(() => { if (import.meta.dev) initVueGrab() })`; add the compile-time Vite plugin to `nuxt.config.ts` (Nuxt 3.10+/4.x).
- Compile-time injection: apply in dev for both client and server so SSR HTML and client vnodes agree; never in `command === 'build'`.
- Runtime injection: client only. Do not rely on `transformIndexHtml` for Nuxt SSR.
- Test `nuxt build` (not just `nuxt dev`) and assert no `vue-grab` in the server or client output.

**Warning signs:**
`window is not defined` during build; overlay loads only after client navigation; hydration warnings; `.output/server` contains loc attributes; production bundle includes `vue-grab`.

**Phase to address:**
**P2** (SSR-safe injection), **P5** (Nuxt wiring and build test).

---

### Pitfall 17: Wrong Vite plugin ordering or applying in build

**What goes wrong:**
The transform runs after `@vitejs/plugin-vue` has already produced JS, so no template is touched. Or it runs on every `?vue&type=...` request and corrupts compiled modules. Or it runs during `vite build` and ships source paths.

**Why it happens:**
Vite applies plugin hooks in order; `enforce: 'pre'` is required to see the SFC source before plugin-vue's `transformMain`. Query-suffixed requests (`?vue&type=template`, `?vue&type=style`) carry compiled block content, not the SFC. `apply: 'serve'` is the only reliable dev gate; `mode`, `NODE_ENV`, or a custom flag can be true during builds. Vite 8's Environment API is not available in Vite 5, which the project still supports.

**How to avoid:**
- Plugin name, `enforce: 'pre'`, `apply: 'serve'`.
- Transform only the main SFC id: strip the query, require `.vue`, and require no `vue`/`type` query params.
- Guard against missing `descriptor.template`; skip `<template src>` and non-HTML languages rather than guessing.
- Use `filter`/`createFilter` to include the app root and exclude `node_modules` (except explicitly linked packages).
- Keep the plugin compatible with Vite 5 by avoiding `this.environment`-only logic; if you need environment awareness, feature-detect it.
- If injecting the runtime through `transformIndexHtml`, set an explicit `order` and resolve the virtual module id from a `resolveId`/`load` pair.

**Warning signs:**
No loc attributes in dev; `descriptor.template` is `undefined`; attributes appear in compiled JS strings; loc attributes in `vite build` output; plugin works only when placed after `vue()` in the array.

**Phase to address:**
**P2** (ordering), **P5** (build gate).

---

### Pitfall 18: Monorepo publishing mistakes

**What goes wrong:**
Consumers install `vue-grab` and get `workspace:*` as a version; `vue-grab/vite` has no types; the bin is not executable; a second Vue copy is installed; the tarball ships `src/` and tests; runtime and plugin versions drift and the attribute schema breaks.

**Why it happens:**
`npm publish` does not rewrite `workspace:*` (use `pnpm publish` or Changesets). `exports` maps need a `types` condition per subpath. `files` is a whitelist. `vue` must be a peer, not a dependency, or the overlay gets its own runtime. The CLI bin needs a shebang and the package needs `bin`. Fixed version groups are needed when runtime and compiler plugin share an attribute protocol. Vite/Rolldown lib builds can emit declarations with paths that do not match `exports`.

**How to avoid:**
- Publish with `pnpm publish -r` or `changeset publish`; use a Changesets fixed group for `vue-grab` and `@vue-grab/cli`.
- `peerDependencies: { "vue": "^3.5.0" }`; `vite` optional peer only for the `/vite` subpath, with a clear runtime error if missing.
- `exports`: `"."`, `"./vite"`, `"./package.json"`; `types` first; no CJS entries if ESM-only.
- `files`: `dist`, `bin`, `README.md`, `LICENSE`; verify with `npm pack --dry-run` and `publint`/`attw`.
- Bin: `#!/usr/bin/env node`, executable, and a real CLI entry. Keep Node-only code out of the browser entry.
- `engines.node: ">=22.12.0"`; `packageManager: "pnpm@12.14.0"`.
- Add `onlyBuiltDependencies: ["esbuild"]` so pnpm 12 does not block the esbuild binary.

**Warning signs:**
Tarball contains `workspace:*`; `npx vue-grab` says it cannot determine an executable; `vue-grab/vite` resolves to JS but types fail; `pnpm why vue` shows two versions; `src/` in the tarball.

**Phase to address:**
**P5**.

---

### Pitfall 19: Missing upstream MIT attribution

**What goes wrong:**
The port copies substantial structure or code but ships a LICENSE naming only the new authors, or a README implying the project is the original. This is a license violation and a reputational problem.

**Why it happens:**
MIT requires the copyright notice and permission notice to be included in all copies or substantial portions. A rewrite that keeps the interaction model, copy grammar, constants, and file structure is still derived work. Upstream's LICENSE is `Copyright (c) 2025 Aiden Bai` (verified). Copying only the idea is not the issue; copying the expression is.

**How to avoid:**
- Keep the upstream MIT text verbatim in `LICENSE` and add the Vue Grab copyright line alongside it (do not replace it).
- Add a `NOTICE` or a README "Attribution" section: "Based on react-grab by Aiden Bai (MIT)", with the upstream URL and a statement of changes.
- Put a short header in files that are direct ports: "Portions derived from react-grab (c) 2025 Aiden Bai, MIT."
- Do not use upstream trademarks/logo as the project's identity; make the Vue port's name and non-affiliation clear.
- Add a release checklist item and a test that fails if `LICENSE` lacks "Aiden Bai".

**Warning signs:**
`LICENSE` has only one copyright line; `git grep -i "aiden\|react-grab"` returns nothing outside the README; package metadata lists only the new author; copied files have no provenance note.

**Phase to address:**
**P1** (first commit) and **P5** (release gate).

---

### Pitfall 20: Toolchain version skew (TypeScript 7, ESLint, Node)

**What goes wrong:**
`pnpm install` succeeds but `vue-tsc`/type-aware ESLint crashes or silently skips `.vue` files; CI uses Node 20 and Vite 8/Vitest 5 refuse to run; the lockfile resolves incompatible peers.

**Why it happens:**
On 2026-10-20, `typescript@latest` is 7.0.2, but `typescript-eslint@8.72.0` declares `typescript >=4.8.4 <6.1.0`, so TS 7 breaks type-aware linting. The Vue language tooling (`vue-tsc@3.3.13`) declares `typescript >=5.0.0` but the Vue/lint ecosystem is exercised against the 5.x line. Vitest 5 requires Node `^22.12 || ^24 || >=26`; Vite 8 requires `^20.19 || >=22.12`. `@vitejs/plugin-vue` 6 requires Vite 5–8 and Vue `^3.2.25 || ^3.6.0-rc.10`.

**How to avoid:**
- Pin TypeScript 5.9.3 across the workspace via a pnpm catalog; do not float to `latest`.
- Pin ESLint 10.13.0, typescript-eslint 8.72.0, eslint-plugin-vue 10.11.1, Prettier 3.9.10.
- Set `engines.node: ">=22.12.0"` and run CI on Node 22.23/24.
- Add a `pnpm install --frozen-lockfile` + `pnpm -r typecheck` + `pnpm lint` CI gate; upgrade TypeScript only after checking the peer ranges of vue-tsc, typescript-eslint, and eslint-plugin-vue.
- Treat Vite as a peer with the full supported range; test the minimum (Vite 5) and current (Vite 8) in CI if feasible.

**Warning signs:**
Peer dependency warnings on install; `vue-tsc` exits with an internal error; ESLint ignores `.vue`; `EBADENGINE`; tests pass locally on Node 24 but fail in CI on Node 20.

**Phase to address:**
**P1**.

---

### Pitfall 21: Storing DOM nodes and component instances in deep reactive state

**What goes wrong:**
Element identity checks fail, `__vueParentComponent` is missing on a "proxied" element, hover logic compares the wrong objects, and the overlay re-renders on every pointer move. Repeated `v-for` rows collapse or disappear because they share a location key.

**Why it happens:**
`ref([])`/`reactive({ el })` wraps DOM nodes and Vue instances in proxies. `el === rawEl` becomes false, `instanceof` checks can fail, and Vue's internal expando properties may not be visible through the proxy. Deep reactivity over a growing selection list is also unnecessary: DOM nodes are not meant to be reactive data.

**How to avoid:**
- Use `shallowRef` for selections and `markRaw()` for DOM elements and component instances before storing them.
- Keep a stable selection id separate from the element reference; re-resolve elements by selector/rect after HMR or re-render.
- Key overlay `v-for` lists by the selection id, not by source loc (identical rows legitimately share a loc).
- Deduplicate selections by element identity (and maybe DOM path), not by file/line.
- Use `shallowRef` + `triggerRef` for high-frequency hover state.

**Warning signs:**
`el.__vueParentComponent` is `undefined` only when read from state; highlight flickers on pointer move; selecting two rows of a list produces one entry; overlay components re-render dozens of times per second.

**Phase to address:**
**P1**.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Auto-initializing the runtime as an import side effect | One-line install | Breaks SSR, tree-shaking, and double-init control; hides teardown | **Never** as the library default; acceptable only in a CLI-generated client-only virtual module |
| `as any` casts for Vue internals | Fast adapter | Silent breakage on Vue upgrade; hides missing capabilities | Acceptable only inside one `vueInternals.ts` adapter, with capability checks and a version-matrix test |
| Regex/text injection without an SFC AST | Quick to write | Wrong line offsets, escaping bugs, preprocessing gaps | **Never**; parse the SFC and insert at AST positions, or use a compiler `nodeTransforms` hook |
| Shipping CJS output "just in case" | Some old tooling works | Two bundles, `.d.cts` maintenance, ESM-only deps (ora 9) fail anyway | Skip; Vite/Nuxt are ESM |
| `window.__VUE_GRAB__` global singleton | Easy HMR guard | Collides with another copy; leaks across micro-frontends | Acceptable if versioned and cleared on teardown |
| Hand-rolled key-combo parser | No dependency | Layout/IME/modifier bugs; hard to test | Acceptable only with a table-driven test suite; consider a tiny parser |
| Skipping cross-origin iframe support | Less code | Users expect it; silent dead zones | Acceptable if the UI explicitly says "cross-origin frame not supported" |
| Not minifying the IIFE | Debuggable | Larger demo/manual-install payload | Acceptable; the primary consumer uses ESM + bundler |
| Using `document.execCommand('copy')` | Synchronous, works on LAN HTTP | Deprecated API | Acceptable as a fallback; keep the async Clipboard API first |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@vitejs/plugin-vue` | Transforming after plugin-vue compiled the SFC | `enforce: 'pre'`, main `.vue` id only, before plugin-vue |
| Vite dev/build | Using `mode` or `NODE_ENV` to decide dev | use `command === 'serve'` (`apply: 'serve'`), plus an explicit fixture flag for e2e dev builds |
| Vite dependency optimizer | Importing a linked workspace package | `optimizeDeps.exclude: ['vue-grab']`, `resolve.dedupe: ['vue']` |
| Vue compiler version | Bundling a private `@vue/compiler-sfc` | Resolve `vue/compiler-sfc` from the project root (`createRequire`), like plugin-vue |
| Nuxt 3/4 | Adding the runtime import through `vite.plugins` | Write a `.client.ts` plugin and keep compile injection SSR-aware |
| Vite open-in-editor | Passing `?file=...&line=...&column=...` | Vite 8 middleware only reads `file`; pack the position into it: `/__open-in-editor?file=<encoded abs path:line:column>` |
| Playwright | Mocking the clipboard | Grant `clipboard-read`/`clipboard-write`, assert actual clipboard text/HTML |
| Vitest/jsdom | Testing hover/rects/clipboard in jsdom | Use Vitest browser mode or Playwright for geometry and clipboard |
| pnpm 12 | Missing esbuild binary | `onlyBuiltDependencies: ['esbuild']` in the workspace config |
| Changesets | Publishing with `npm publish` | `pnpm publish -r`/`changeset publish`, fixed version group |
| Windows paths | `C:\repo\App.vue:12:3` breaks a naive `split(':')` | Normalize to POSIX for attributes; parse loc with a greedy last-two-number regex |
| Vue 3.6 dev | Compiler/AST behavior changes | Test against Vue 3.5.x and current 3.6 rc in CI before widening the peer range |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Hit-testing on every `mousemove` with layout reads | Dropped frames while moving the pointer | Throttle to `requestAnimationFrame`; cache rects per frame; use `elementsFromPoint` once | ~200+ pointer events/sec on a large DOM |
| Freezing by pausing every scope on every hover | Activation/selection lag | Pause once at activation; memoize the paused set; re-sweep only for new instances | 1k+ component instances |
| Toggling `pointer-events` on `html` around each hit test | Style recalc spikes, jank on large pages | Use a leaf-panel shield with holes; avoid root-wide property flips | 5k+ elements (upstream: 4–35 ms per toggle) |
| `getAnimations()` / `getComputedStyle` in a loop | Forced style flushes; frame drops | Batch reads before writes; call `document.getAnimations()` once; reuse snapshots | Hundreds of animated elements |
| Deep `reactive` selection arrays | Re-renders on every mutation; proxy identity bugs | `shallowRef` + `markRaw`; immutable selection updates | Every pointer move / selection change |
| `outerHTML` of a huge subtree for copy previews | Main-thread stall and oversized clipboard | Truncate text/attributes (upstream caps counts/lengths); serialize only on copy | 10k+ node subtrees |
| Whole-document `MutationObserver` with deep traversal | CPU wakeups while idle | Observe only while the overlay is active; disconnect on freeze/exit; debounce | Complex apps with frequent mutations |
| Re-rendering the overlay app on pointer move via reactive hover state | Toolbar/highlight jank | Keep hover state in `shallowRef`; render only the highlight layer; avoid deep prop graphs | 60 Hz pointer movement |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Writing absolute source paths into dev SSR HTML and loc attributes | Local username/project layout disclosure when a dev server is tunneled or exposed | Store root-relative POSIX paths; never include env/user data; dev-only transform |
| Relying on a custom "open file" endpoint that shells out | Arbitrary command execution if the dev server is exposed | Use Vite's built-in `/__open-in-editor` with a validated path; bind dev servers to localhost; never build a shell command from page data |
| Trusting page text/attributes in the copied prompt | Prompt injection from user-generated content into the coding agent | Delimit page content as untrusted data; label source references; keep instructions out of copied DOM text |
| Putting unescaped page HTML into the `text/html` clipboard flavor | Rich-text clients may render unexpected markup | Escape `<`, `>`, `&`; wrap in `<pre><code>`; keep the plain-text flavor canonical |
| Over-broad internal-attribute stripping or selector copy | Removing app attributes that matter, or exporting internal ones | Strip only the documented `data-vue-grab-` prefix; keep `data-v-*` scope ids unless the user opts into clean mode |
| Injecting into production SSR/build | File paths and dev tooling shipped to users | `apply: 'serve'`; build-output assertion; runtime self-guard |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|------------------|
| Freeze kills `:hover`, so the element under the cursor changes appearance | Selection feels like it highlights the wrong thing | Snapshot and pin hover/focus computed styles before freezing; restore on exit |
| Highlights are computed once and not updated on scroll/resize | Outline detaches from the element | Capture-phase scroll listener + `ResizeObserver`; recompute on animation frame |
| Drag-select conflicts with text selection/scroll | User cannot select or scroll; accidental selections | Distinguish click vs drag threshold; only `preventDefault` once a drag starts; allow wheel scrolling |
| Copy succeeds/fails silently | User pastes stale or empty context | `aria-live` status, explicit failure with a "copy as text" fallback, and a visible shortcut hint |
| Keyboard-only navigation only covers hover/click | Toolbar/context menu/prompt unreachable | Roving tabindex inside the shadow root, documented keys, focus restore, visible focus rings |
| `Escape` closes both the prompt and the overlay/host modal | Lost comment or host modal dismissal | Consume `Escape` only when overlay UI has focus; otherwise pass through |
| Top-layer `<dialog>`/popover cannot be highlighted | "It doesn't work on my modal" | Document the limitation or render the highlight inside the top-layer element |
| Overlay z-index below host modals/toasts | Overlay hidden by the app | Max z-index on the host; test with host dialogs and portals |
| Dark/light/forced-colors mismatch | Invisible text or highlights | Use `color-scheme`, `prefers-color-scheme`, and `forced-colors` media queries; test both themes |

## "Looks Done But Isn't" Checklist

- [ ] **Locations:** Every native element has `data-vue-grab-loc` with the exact SFC line/column (not template-relative); elements after a long `<script setup>` are correct; slots and `v-for` rows are covered.
- [ ] **Components:** `__vueParentComponent`/`__vnode` are read only through the adapter; no production build depends on them; the production fixture contains zero `vue-grab` bytes.
- [ ] **Freeze:** Vue reactivity, CSS animations, WAAPI, and hover/focus states freeze; the overlay's own app remains interactive; timers/canvas limitations are documented; resume restores prior play/paused state and inline styles exactly.
- [ ] **Traversal:** Teleport, Suspense, async components, KeepAlive, multiple apps, open shadow roots, and same-origin iframes have fixtures; cross-origin iframes fail gracefully.
- [ ] **Slots:** A slotted element reports both its rendered-by component and its defining file; no contradictory single "component" claim.
- [ ] **Copy:** `data-vue-grab-*`, freeze-pinned inline styles, overlay host nodes, and absolute paths do not appear in copied HTML/CSS/text.
- [ ] **Clipboard:** Copy works on `localhost` and a LAN HTTP preview (fallback), in an iframe with permission, and with DevTools focused or not; actual clipboard content is asserted.
- [ ] **Keyboard:** Typing in inputs is unaffected; the configured combo works; hold mode releases on blur; Escape behavior is context-aware; HMR does not duplicate listeners.
- [ ] **Shadow DOM/CSP:** Host CSS does not style the overlay; the overlay is not styled by host resets; strict `style-src` with constructable stylesheets works.
- [ ] **SSR/Nuxt:** `nuxt build` passes; no `window is not defined`; hydration leaves loc attributes present; server output has no absolute paths.
- [ ] **HMR:** Template-only, script-only, and style-only edits update locations without duplicates; editing the runtime does not leave two overlays.
- [ ] **Release:** Tarballs contain no `src`/tests, no `workspace:*`, types resolve for `vue-grab/vite`, bins are executable, peer `vue` is deduped, and the LICENSE contains the upstream notice.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dev-only internals missing in a build | LOW | Detect in the adapter, disable features with a warning, fix the injection gate; no data loss |
| Wrong line offsets shipped | LOW–MEDIUM | Recompute from the SFC AST; re-run golden tests; bump the attribute schema version |
| Overlay app frozen | LOW | Exclude the overlay app from the pause set; snapshot host apps before mounting; add a regression test |
| Duplicate overlays/listeners after HMR | LOW | Add `import.meta.hot.dispose(teardown)` and a versioned singleton; clear hosts/listeners/styles |
| SSR/hydration mismatch | MEDIUM | Align server/client injection, make paths deterministic, add an SSR fixture; attrs are dev-only |
| Clipboard broken on LAN/CSP | LOW–MEDIUM | Add the synchronous `execCommand` fallback and a visible failure path; test `isSecureContext` |
| Location attributes contaminate copied output | LOW | Centralize stripping and serialize from a pre-freeze snapshot; add a snapshot test |
| Published package broken (`workspace:*`, bins, types) | MEDIUM–HIGH | Re-publish with pnpm/Changesets, fix `exports`/`files`, deprecate the broken version, verify with `npm pack` + a fresh install |
| Vue upgrade breaks internals | MEDIUM | Cap the peer range, add a version-matrix test, keep all internals in one adapter; fall back to file-only locations |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Dev-only internals stripped | P1, P5 | Production fixture build contains no runtime and no loc attrs; adapter warns once when internals are missing |
| 2. `EffectScope.pause` incomplete/pre-3.5 | P3 | Freeze fixture: counter stops, CSS/WAAPI stop, resume restores; Vue 3.4 guard disables only freeze |
| 3. Freezing the overlay / missing apps | P3 | Toolbar remains responsive; two-app and shadow-root fixtures both freeze |
| 4. Traversal gaps | P1, P3, P4 | Teleport/Suspense/async/KeepAlive/iframe/shadow fixtures; ancestry snapshots |
| 5. Slot attribution mismatch | P2, P4 | Slot fixture shows `renderedBy` ≠ `definedIn` with both paths |
| 6. Injecting on components | P2 | Compiled output has attrs only on native elements; no extraneous-attrs warnings |
| 7. SSR/hydration/hoisting/props | P2, P5 | SSR hydration test; deterministic paths; no static `style`/dynamic bindings injected |
| 8. Line offsets/preprocessors | P2 | Golden `file:line:column` tests with `<script setup>` offset, same-line elements, Pug/src fallbacks |
| 9. HMR idempotency/prebundle | P2, P5 | Template/script/style edits produce one attr and one overlay; `optimizeDeps.exclude` present |
| 10. Source-map/`__file` reliance | P2, P4 | Fallback labels "line unknown"; no network source-map fetch |
| 11. Internal attrs in copied output | P4 | Snapshot copied HTML/CSS contains no `data-vue-grab-` or freeze styles |
| 12. Clipboard gesture/secure context | P4 | Playwright asserts clipboard on localhost and with the fallback path; LAN HTTP documented |
| 13. Keyboard hijack | P3 | Host app input and reload shortcuts work; hold mode releases on blur; overlay keys work |
| 14. Shadow DOM/pointer-events freeze | P1, P3 | Host CSS isolation test; hover pin test; animation playState restore; scroll highlight test |
| 15. CSP | P1, P5 | CSP fixture renders styled overlay via `adoptedStyleSheets` |
| 16. Nuxt SSR/import | P2, P5 | `nuxt build` passes; hydration keeps attrs; no server path leak |
| 17. Vite ordering/build apply | P2, P5 | Works with plugin-vue in any array position; no attrs in build output |
| 18. Publishing | P5 | `npm pack` inspection + fresh install resolves types/binaries/peers |
| 19. MIT attribution | P1, P5 | LICENSE contains upstream copyright; NOTICE/README present; release checklist |
| 20. Toolchain skew | P1 | Frozen lockfile, Node 22.12+, `pnpm -r typecheck`/`lint` green |
| 21. Reactive proxies on DOM | P1 | Selection state uses `shallowRef`/`markRaw`; identity and repeated-row tests |

## Sources

- Vue core v3.5.34 source: `packages/runtime-core/src/renderer.ts` (dev-gated `__vnode`/`__vueParentComponent`, render-effect scope), `packages/runtime-core/src/component.ts` (detached `EffectScope`, `__file`), `packages/runtime-core/src/apiCreateApp.ts` (`__vue_app__` unconditional, `app._instance` dev-gated), `packages/reactivity/src/effectScope.ts` and `effect.ts` (pause/resume and paused-queue behavior), `packages/compiler-sfc/src/compileTemplate.ts`, `packages/compiler-sfc/src/parse.ts` (SFC-relative AST locations).
- Empirical checks in this workspace (Vue 3.5.44 + jsdom): slot content's `__vueParentComponent` is the rendering child; production `vue.cjs.prod.js` exposes `__vue_app__` but not `__vueParentComponent`/`__vnode`/`app._instance`; SFC `<div>` on file line 6 reports `loc.start.line === 6`, column 3; standalone template compilation reports template-relative lines; `tagType` is 0 for native, 1 for components, 2 for `<slot>`.
- Upstream `react-grab` v0.2.0 (MIT): `packages/react-grab/src/utils/freeze-pseudo-states.ts`, `pointer-events-freeze.ts`, `create-hit-test-shield.ts`, `freeze-animations.ts`, `copy-content.ts`, `strip-internal-attributes.ts`, `html-preview.ts`, `packages/react-grab/package.json`, `packages/cli/package.json`, `LICENSE` (Copyright (c) 2025 Aiden Bai).
- `vite-plugin-vue-inspector` dist (current): pre-plugin text fallback with MagicString, `data-v-inspector` attribute, file-relative locations, idempotency and HMR considerations.
- Vite 8.3.4 dist: `/__open-in-editor` middleware and launch-editor `file:line:column` parsing.
- npm registry, 2026-10-20: `vue` 3.5.44, `@vue/compiler-sfc` 3.5.44, `vite` 8.3.4, `@vitejs/plugin-vue` 6.0.10, `vitest` 5.0.5, `@vue/test-utils` 2.5.1, `playwright` 1.64.1, `eslint` 10.13.0, `typescript-eslint` 8.72.0 (peer TypeScript `<6.1.0`), `eslint-plugin-vue` 10.11.1, `prettier` 3.9.10, `typescript` 7.0.2 (latest) / 5.9.3 (supported), `pnpm` 12.14.0, `tsup` 9.0.0, `unbuild` 3.6.1, `tsdown` 0.23.1, `commander` 15.0.0, `@clack/prompts` 1.8.1, `prompts` 2.4.2, `package-manager-detector` 1.9.0, `picocolors` 1.1.1, `ora` 9.4.1, `tinyexec` 1.3.1, `nuxt` 4.6.2.
- `@vitejs/plugin-vue` 6.0.10 dist: `__file` dev/prod behavior, `api.options`, `descriptor.template.ast` reuse, query-suffixed template compilation.

---

*Pitfalls research for: Vue Grab (Vue 3.5+ inspection overlay, Vite plugin, CLI)*
*Researched: 2026-10-20*
