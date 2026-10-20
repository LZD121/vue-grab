# Stack Research

**Domain:** Vue 3.5+ dev-only inspection overlay (browser runtime + compile-time Vite plugin + installer CLI), port of React Grab
**Researched:** 2026-10-20
**Confidence:** HIGH for the recommended stack on Vue 3.5 / Vite 5–8 today (versions, peer ranges, engines, and core APIs verified); MEDIUM for Vue 3.6/Vapor and future Rolldown API churn.

## Recommended Stack

Two decisions drive the rest of the stack:

1. **Overlay rendering:** a **second Vue `createApp` mounted inside an open ShadowRoot**, attached to a host element appended to `document.documentElement`. The overlay is *not* rendered in the host app's component tree and does *not* use an iframe.
2. **Compiler-plugin packaging:** the compiler integration ships as **subpath exports of the core `vue-grab` package** — `vue-grab/vite`, `vue-grab/compiler`, `vue-grab/nuxt`, `vue-grab/constants` — built as separate entries. There is no separate `@vue-grab/vite` package.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vue | `3.5.44` (peer `^3.5.0`) | Host framework, overlay UI, dev-only instance metadata | `EffectScope.pause()/resume()` exists in 3.5+; dev DOM nodes carry `__vueParentComponent`/`__vnode`; `type.__file` and `type.__name` supply source/name. Vue already depends on `@vue/compiler-dom`, so the compiler plugin dedupes. |
| Vite | `8.3.4` dev/build; peer `^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0` | Dev server, plugin host, library builds, demo/e2e app | One toolchain for SFC compilation, `?inline` CSS, multi-entry lib mode, and the plugin API. Vite 8 is Rolldown-based; the plugin deliberately uses only classic hooks available in 5–8. |
| TypeScript | `6.0.3` | Language and type checking | `typescript-eslint@8.72` supports `>=4.8.4 <6.1.0`; `vue-tsc@3.3.13` supports `>=5`. TypeScript 7 (native) is not yet supported by the lint/type toolchain. |
| @vue/compiler-dom | `3.5.44` | AST parse/transform for the compiler plugin | Exposes `parse()` and `transform()` with `node.loc` line/column in the original SFC. No Vite dependency, so the same transform is reusable from `vue-grab/compiler` in vue-loader. |
| magic-string | `1.4.3` | Source-preserving attribute injection and source maps | Generates hires maps from surgical edits; battle-tested in the Vue/Vite ecosystem. ESM-only, matching this package. |
| @vitejs/plugin-vue | `6.0.10` | Compile overlay SFCs and fixture/demo SFCs | Required to build the runtime's `.vue` overlay components in Vite lib mode. Not a runtime dependency of `vue-grab`; consumers bring their own. |
| vue-tsc | `3.3.13` | Type-check `.vue` files | The standard Vue type checker; used for `--noEmit` and as the d.ts fallback if the declaration plugin misbehaves. |
| vite-plugin-dts | `5.1.2` | Emit `.d.ts` during the Vite build | `unplugin-dts@1.1.2` explicitly supports Vite/Rolldown and `.vue` sources via `@vue/language-core`; keeps declarations in the same build as JS. |
| @vue/language-core | `3.3.13` | Vue language service used by the d.ts plugin | Optional peer of `unplugin-dts`; declare it explicitly so pnpm's strict layout resolves it (also brought in by `vue-tsc`). |
| launch-editor | `2.14.2` | Open `file:line:column` in the developer's editor | Standard Vite-ecosystem editor launcher; Node-only, used from the dev middleware. Avoids hand-rolling editor detection/spawn. |
| Open ShadowRoot + separate Vue app | — (approach) | Overlay rendering | Styles and events are isolated from the host page; the overlay has its own effect scope, so pausing host component scopes does not freeze the overlay. Vue is a peer, so the ESM build adds no Vue bytes. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @clack/prompts | `1.8.1` | CLI prompts, confirmations, spinner, styled log output | Interactive `vue-grab init`; replaced by `--yes` in CI. Covers the prompts/ora/picocolors/boxen role with one dependency. |
| commander | `14.0.3` | CLI command tree, flags, help | `init` / `configure` / `remove`. Version 14 keeps Node 20 support; commander 15 requires Node 22.12+. |
| package-manager-detector | `1.9.0` | Detect npm/pnpm/yarn/bun/deno | `detect()` from `package-manager-detector/detect`, then `resolveCommand(agent, 'add', ['-D', 'vue-grab'])` from `package-manager-detector/commands`. |
| tinyexec | `1.3.1` | Spawn installs and git commands without a shell | `x(cmd, args, { nodeOptions: { cwd } })`; argv arrays avoid shell-injection bugs from user paths. |
| magicast | `0.5.5` | Format-preserving edits to `vite.config.*` / `nuxt.config.*` | Use `magicast/helpers`: `addVitePlugin`, `findVitePluginCall`, `updateVitePluginConfig`, `addNuxtModule`. Handles `defineConfig()` and config-variable forms. |
| @nuxt/kit | `4.6.2` (optional peer `^3.13.0 \|\| ^4.0.0`) | Nuxt module API | Only imported by `vue-grab/nuxt`; optional peer so non-Nuxt installs do not pull it in. |
| @vue/test-utils | `2.5.1` | Mount overlay components in unit tests | Component tests for toolbar/menu/prompt/focus behavior; not for layout proof. |
| vitest | `5.0.5` | Unit, compiler, and CLI tests | `test.projects` at the root: node project for compiler/CLI, jsdom project for Vue components. |
| @vitest/coverage-v8 | `5.0.5` | Coverage | V8 provider, same version as Vitest. |
| jsdom | `30.1.3` | DOM environment for component tests | Vue Test Utils' compatibility baseline; Shadow DOM basics work, but layout is not faithful. |
| @playwright/test | `1.64.1` | Real-browser e2e | Hover/drag/keyboard, Shadow DOM, clipboard permissions, freeze/restore, HMR. Chromium in CI; add WebKit/Firefox nightly if budget allows. |
| @changesets/cli | `3.0.3` | Versioning and publishing | `linked` group for `vue-grab` and `@vue-grab/cli` so subpath/config contracts ship together. |
| publint | `0.3.25` | Validate package exports/files | CI packaging gate; catches missing `types`, bad `exports`, and ESM/CJS mistakes. |
| @arethetypeswrong/cli | `0.18.5` | Validate type resolution across module modes | `attw --pack . --profile esm-only`; the ESM-only profile ignores the expected CJS-resolves-to-ESM warning. |
| tsx | `4.23.15` | Run TypeScript scripts/CLI during development | `tsx src/cli.ts` while iterating; production bin runs built ESM. |
| @types/node | `22.20.5` | Node typings | Pin to the minimum published runtime (Node 22 line) to avoid using Node-24-only APIs accidentally, even though CI also runs Node 24. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Workspace + package manager | `11.28.6`; `packageManager` pin; workspace settings/catalogs in `pnpm-workspace.yaml`. |
| Node.js | Runtime for tooling and CLI | Repo `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` (Nuxt 4.6 + Changesets 3 constraints); published packages `>=20.19.0` (Vite 8 floor and `require(esm)`). CI matrix: 22.23.x and 24.22.x. |
| ESLint | Lint | `10.13.0` flat config. |
| typescript-eslint | Type-aware TS rules | `8.72.0`; supports TypeScript `<6.1`. |
| eslint-plugin-vue | Vue rules | `10.11.1`; `flat/recommended` (or `flat/essential` + type-aware extras). |
| @vue/eslint-config-typescript | Vue + TS flat-config glue | `14.9.0`; use `withVueTs(pluginVue.configs['flat/recommended'], vueTsConfigs.recommendedTypeChecked)`. |
| Prettier | Formatting | `3.9.10`; built-in `.vue` parser. |
| eslint-config-prettier | Disable formatting rules in ESLint | `10.1.8`. |
| globals | ESLint global sets | `17.13.0`; browser + node. |
| GitHub Actions | CI | Node 24, pnpm cache, `--frozen-lockfile`; run lint → typecheck → unit → build → e2e → publint/attw. |
| vite-plugin-inspect | Optional plugin-debug UI | `12.1.0` only supports Vite 8. Debug aid for the demo/fixture, not a dependency of published packages. |

### Overlay Rendering Decision

**Use a separate Vue app in an open ShadowRoot.** Concretely:

- Create `<div data-vue-grab-root>` and append it to `document.documentElement` (not `body`, to avoid body transforms/overflow and body replacement during HMR).
- `host.attachShadow({ mode: 'open' })`; create an inner mount container inside the shadow root; `createApp(Overlay).mount(container)`.
- Do **not** render the overlay with the host app's components or inject it into the host component tree. The host freeze pauses every component's `EffectScope`; a host-tree overlay would freeze with it.
- Keep the overlay's app/effect scope entirely separate. The overlay's DOM is inside a shadow root, so `document.querySelectorAll('[data-v-app]')` on the host document does not even see the overlay app.
- Import the overlay stylesheet once as a string (`import overlayCss from './styles.css?inline'`) and inject a `<style>` element into the shadow root. Do **not** use `<style scoped>` in overlay SFCs: Vite extracts SFC styles to a global CSS asset, which is exactly what Shadow DOM is meant to avoid. Assert the build emits no `.css` asset.
- Event handling: use `event.composedPath()[0]` for the real target, and keep a host-level listener that stops overlay-origin events from reaching host bubble listeners. Document the one limitation: a host app's **document-level capture** listeners can still observe retargeted overlay events; an iframe would be required to block those, and is not worth the coordinate/clipboard/event cost.
- Freeze integration: pause host instances' detached component scopes, not the root scope; filter `document.getAnimations()` so overlay animations are not paused. See the architecture doc for the instance walk and pseudo-state restoration.

Why not the alternatives:

| Option | Why not |
|--------|---------|
| Vanilla DOM + a small reactive store | The overlay has a real state machine (idle/holding/active/copying), hierarchy menus, prompt mode, focus management, and a plugin registry. Rebuilding this without a component framework costs more code and bugs than it saves; Vue is already guaranteed. |
| Solid / Preact | Adds a second framework and build transform for no capability gain; the host already ships Vue. |
| iframe | Strongest isolation, but coordinate translation, clipboard permissions, focus, and event bridging are all harder. Shadow DOM is sufficient here. |
| Render in the host app tree | Host CSS can bleed in, the overlay freezes with the host, and the host's app/DOM is polluted. |
| `adoptedStyleSheets` | Supported in modern browsers, but a `<style>` element is simpler, works in jsdom, and avoids constructable-stylesheet test setup. Revisit only if style injection shows up in profiling. |

### Compiler-Plugin Packaging Decision

**Ship the compiler integration as subpath exports of `vue-grab`.** `src/vite.ts`, `src/compiler.ts`, `src/nuxt.ts`, and `src/constants.ts` are separate build entries; the package's `exports` map points at `dist/vite.js`, `dist/compiler.js`, `dist/nuxt.js`, `dist/constants.js`.

- `vue-grab/vite` is the zero-config Vite plugin. `apply: 'serve'` (dev only), `enforce: 'pre'`, classic `transform(code, id)` hooks for Vite 5–8 compatibility.
- It handles `foo.vue` (the main SFC request) and skips `?vue&type=template`/`src` sub-requests, `lang="pug"`/`jade`, `node_modules`, and production builds. Parse the **whole SFC** with `@vue/compiler-dom`'s `parse()` so `node.loc.start.line/column` are already file-absolute; run `transform(ast, { nodeTransforms })` and insert `data-vue-grab-loc="relpath:line:col"` with `MagicString`.
- Inject `data-vue-grab-call="relpath:line:col"` on component tags as an ancestry/call-site hint. Skip `<template>`, `<script>`, `<style>`, `<slot>`, and non-native nodes where fallthrough would misattribute. Never inject twice (check for the attribute).
- Return `{ code, map: s.generateMap({ hires: true, source: filename, includeContent: true }) }`; source-map chaining is mandatory or HMR/stack traces drift.
- Also add `configureServer` middleware for `POST /__vue-grab/open` (validate the resolved path is inside `root`, then call `launchEditor` with `<abs>:<line>:<column>`) and `transformIndexHtml` tags that set `window.__VUE_GRAB_CONFIG__` and import `vue-grab/auto`. Offer `runtime: false` to disable the runtime injection.
- `vue-grab/compiler` exports the framework-agnostic `vueGrabNodeTransform`/`transformSFC` with no Vite import. Vue-loader/webpack users can add the node transform to `compilerOptions.nodeTransforms`; otherwise they get the `__file` fallback.
- `vue-grab/nuxt` is a `defineNuxtModule` that returns early when `!nuxt.options.dev`, adds the Vite plugin via `addVitePlugin`, and adds the client bootstrap via `addPluginTemplate` (mode: `client`). Do not ship a separately built Nuxt client file that imports `#app`.

Why not the alternatives:

| Alternative | Why not |
|-------------|---------|
| Separate `@vue-grab/vite` package | Version skew between the runtime's attribute contract and the plugin is the main failure mode; one install line and one changeset group are worth more than install-size isolation. `@vue/compiler-dom` is already a dependency of Vue, and `magic-string`/`launch-editor` are small. |
| Mutate `vite:vue`'s `api.options.template.compilerOptions.nodeTransforms` | Plugin ordering and the `api` surface differ across Vite/plugin-vue versions; a later plugin's `configResolved` can observe different resolved options. A raw-source pre-transform is version-independent. |
| Recompile the SFC in a `transform` with `@vue/compiler-sfc` | Duplicates `@vitejs/plugin-vue`, loses scoped-style/HMR handling, and makes source maps the plugin's problem. |
| Add `vite-plugin-vue-inspector` as a dependency | It injects its own `data-v-inspector` and client/editor behavior. Reuse its **pattern** (pre-transform + compiler-dom + MagicString), not the package. |
| Build the Node subpaths with tsup/tsdown/unbuild | A second bundler and a second config surface for no gain; Vite lib mode already handles the `.vue` runtime and can target Node for the subpaths. See Alternatives for the cases where those tools win. |

### pnpm Workspace Layout

```text
vue-grab/
├── package.json                  # private root; packageManager pnpm@11.28.6
├── pnpm-workspace.yaml           # packages/*, apps/demo, apps/fixtures/*
├── pnpm-lock.yaml
├── tsconfig.base.json            # strict, Bundler resolution, ES2022, esModuleInterop
├── eslint.config.js              # flat: withVueTs(pluginVue, vueTsConfigs.recommendedTypeChecked)
├── prettier.config.js
├── vitest.config.ts              # test.projects: packages/vue-grab, packages/cli
├── e2e/
│   └── playwright.config.ts      # webServer(s) against apps/demo + fixtures
├── packages/
│   ├── vue-grab/
│   │   ├── package.json          # exports: ., ./auto, ./vite, ./compiler, ./nuxt, ./constants
│   │   ├── vite.config.ts        # browser ESM + dts
│   │   ├── vite.iife.config.ts   # standalone IIFE (VueGrab), bundles Vue
│   │   ├── vite.node.config.ts   # node22: vite/compiler/nuxt entries, deps external
│   │   ├── src/
│   │   │   ├── index.ts          # side-effect-free public API
│   │   │   ├── auto.ts           # side-effect bootstrap: read config global, init, HMR dispose
│   │   │   ├── global.ts         # IIFE entry: auto-init + VueGrab global
│   │   │   ├── constants.ts      # attribute names, virtual IDs, config global
│   │   │   ├── vite.ts           # Vite plugin entry
│   │   │   ├── compiler.ts       # vueGrabNodeTransform/transformSFC
│   │   │   ├── nuxt.ts           # Nuxt module
│   │   │   ├── core/             # state, events, hit-test, freeze, copy, format, plugins
│   │   │   ├── vue/              # adapter: apps, source, freeze (only code touching Vue internals)
│   │   │   └── overlay/          # app.ts + *.vue + styles.css (?inline)
│   │   └── test/
│   └── cli/
│       ├── package.json          # @vue-grab/cli; bin: vue-grab -> dist/cli.js
│       ├── vite.config.ts        # node22 ESM, deps external, shebang banner
│       ├── src/{cli.ts,commands/,utils/}
│       └── test/
└── apps/
    ├── demo/                     # Vue 3.5 + Vite 8 + vueGrab(); scenarios for e2e
    └── fixtures/
        ├── vite5/                # Vite 5.4.21 compatibility fixture (Playwright only)
        └── nuxt/                 # Nuxt 4.6.2 module fixture
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
  - apps/demo
  - apps/fixtures/*
catalog:
  vue: 3.5.44
  vite: 8.3.4
  typescript: 6.0.3
  vitest: 5.0.5
  '@playwright/test': 1.64.1
onlyBuiltDependencies:
  - esbuild
  - '@parcel/watcher'
```

Root `package.json` (shape):

```json
{
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.28.6",
  "engines": { "node": "^22.22.3 || ^24.15.0 || >=26.0.0", "pnpm": ">=11" },
  "scripts": {
    "build": "pnpm -r --filter './packages/*' build",
    "typecheck": "pnpm -r --filter './packages/*' typecheck",
    "test": "vitest run",
    "test:e2e": "playwright test -c e2e/playwright.config.ts",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "check:exports": "pnpm -r --filter './packages/*' run check:exports"
  }
}
```

`packages/vue-grab/package.json` (essential fields):

```json
{
  "name": "vue-grab",
  "type": "module",
  "license": "MIT",
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": ["./dist/auto.js"],
  "unpkg": "./dist/index.global.js",
  "exports": {
    ".":           { "types": "./dist/index.d.ts",     "import": "./dist/index.js",     "default": "./dist/index.js" },
    "./auto":      { "types": "./dist/auto.d.ts",      "import": "./dist/auto.js",      "default": "./dist/auto.js" },
    "./vite":      { "types": "./dist/vite.d.ts",      "import": "./dist/vite.js",      "default": "./dist/vite.js" },
    "./compiler":  { "types": "./dist/compiler.d.ts",  "import": "./dist/compiler.js",  "default": "./dist/compiler.js" },
    "./nuxt":      { "types": "./dist/nuxt.d.ts",      "import": "./dist/nuxt.js",      "default": "./dist/nuxt.js" },
    "./constants": { "types": "./dist/constants.d.ts", "import": "./dist/constants.js", "default": "./dist/constants.js" },
    "./package.json": "./package.json"
  },
  "peerDependencies": {
    "vue": "^3.5.0",
    "vite": "^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0",
    "@nuxt/kit": "^3.13.0 || ^4.0.0"
  },
  "peerDependenciesMeta": {
    "vite": { "optional": true },
    "@nuxt/kit": { "optional": true }
  },
  "dependencies": {
    "@vue/compiler-dom": "^3.5.44",
    "magic-string": "^1.4.3",
    "launch-editor": "^2.14.2"
  },
  "engines": { "node": ">=20.19.0" }
}
```

The `default` condition is **not** a CJS build. It points at the same ESM file so Node 20.19+/22.12+ can `require()` it via `require(esm)`; older Node still fails, which matches `engines`. There is no `.cjs` output and no `require` condition to keep in sync.

Build outputs:

| Artifact | Format | Target | Notes |
|----------|--------|--------|-------|
| `dist/index.js`, `dist/auto.js` | ESM | es2022 | `vue` external (peer); overlay CSS inlined via `?inline` |
| `dist/vite.js`, `dist/compiler.js`, `dist/nuxt.js`, `dist/constants.js` | ESM | node22 | All deps external; no DOM globals at import |
| `dist/index.global.js` | IIFE (`VueGrab`) | es2022 | Standalone manual `<script>` path; bundles Vue; not in `exports` |
| `dist/*.d.ts` | declarations | — | `vite-plugin-dts@5.1.2` + `@vue/language-core@3.3.13` |
| `packages/cli/dist/cli.js` | ESM | node22 | Node deps external; `output.banner` adds the shebang |

Run the browser ESM build first (it empties `dist`), then the Node build and IIFE pass with `emptyOutDir: false`. Keep minification on, source maps on, and a preserved MIT/upstream license banner.

## Installation

### Consumers

```bash
# Vite (runtime + compiler plugin + auto wiring)
pnpm add -D vue-grab
pnpm dlx @vue-grab/cli@latest init

# Nuxt (the CLI writes modules: ['vue-grab/nuxt'])
pnpm add -D vue-grab
pnpm dlx @vue-grab/cli@latest init

# Manual / webpack / no CLI
pnpm add -D vue-grab
```

`vue-grab` is always a **devDependency**. The Vite plugin injects the runtime only during `serve`; manual imports must be guarded or only reachable in dev.

Vite config:

```ts
import vue from '@vitejs/plugin-vue'
import { vueGrab } from 'vue-grab/vite'

export default defineConfig({
  plugins: [vue(), vueGrab({ key: 'Meta+Shift+.', mode: 'toggle' })],
})
```

Nuxt config:

```ts
export default defineNuxtConfig({
  modules: ['vue-grab/nuxt'],
  vueGrab: { key: 'Meta+Shift+.', mode: 'toggle' },
})
```

Manual runtime wiring (no plugin injection):

```ts
if (import.meta.env.DEV) {
  const { init } = await import('vue-grab')
  init({ key: 'Meta+Shift+.' })
}
// or: import 'vue-grab/auto' (reads window.__VUE_GRAB_CONFIG__)
```

### Contributors

```bash
corepack enable
corepack prepare pnpm@11.28.6 --activate
pnpm install
pnpm build
pnpm test
pnpm test:e2e
pnpm check:exports
```

Package dependencies (`packages/vue-grab`, not dev-only):

```bash
pnpm add @vue/compiler-dom@3.5.44 magic-string@1.4.3 launch-editor@2.14.2
```

Build/test dev dependencies:

```bash
pnpm add -D vue@3.5.44 vite@8.3.4 @vitejs/plugin-vue@6.0.10 \
  vue-tsc@3.3.13 @vue/language-core@3.3.13 typescript@6.0.3 \
  vite-plugin-dts@5.1.2
pnpm add -D vitest@5.0.5 @vitest/coverage-v8@5.0.5 jsdom@30.1.3 \
  @vue/test-utils@2.5.1 @playwright/test@1.64.1
pnpm add -D eslint@10.13.0 typescript-eslint@8.72.0 eslint-plugin-vue@10.11.1 \
  @vue/eslint-config-typescript@14.9.0 prettier@3.9.10 eslint-config-prettier@10.1.8 globals@17.13.0
```

CLI package dependencies:

```bash
pnpm add commander@14.0.3 @clack/prompts@1.8.1 \
  package-manager-detector@1.9.0 tinyexec@1.3.1 magicast@0.5.5
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Separate Vue app in ShadowRoot | Vanilla DOM + store | Only if a Vue peer cannot be assumed. That is not this project; the overlay's state/UI complexity makes the component framework pay for itself. |
| Separate Vue app in ShadowRoot | Solid / Preact | If porting upstream's JSX components verbatim and accepting a second framework. No capability gain here. |
| Separate Vue app in ShadowRoot | iframe | If the host page is hostile (aggressive capture listeners, CSS that pierces shadow DOM) and coordinate/clipboard complexity is acceptable. |
| Vite 8 lib mode | tsup 9.0.0 | Pure TS packages without `.vue`; esbuild cannot compile SFCs without a third-party plugin. Fine for the CLI in isolation, but not the runtime. |
| Vite 8 lib mode | unbuild 3.6.1 | Projects pinned to TypeScript 5.9. Its peer is `typescript ^5.9.2`, which blocks TypeScript 6. |
| Vite 8 lib mode | tsdown 0.23.1 | Dropping SFCs or wanting a single rolldown-based config. It is still 0.x and would add a second bundler/config surface. |
| `vite-plugin-dts` 5.1.2 | `vue-tsc --emitDeclarationOnly` | If the d.ts plugin conflicts with a future Vite/Rolldown release. `vue-tsc` is already present and is the fallback. |
| Subpath `vue-grab/vite` | Separate `@vue-grab/vite` package | Separate release cadence/team ownership, or a plugin that must work without the runtime installed. Not worth the version-skew risk now. |
| Raw-source pre-transform | `@vitejs/plugin-vue` `api.options` node transform | Only if you can require plugin-vue >=6, control plugin order, and accept `api` coupling. |
| Raw-source pre-transform | Full `@vue/compiler-sfc` recompile in `transform` | Never for a dev plugin that must preserve HMR/scoped styles. |
| `@clack/prompts` | `prompts` + `ora` + `picocolors` | Existing team convention or a need for a specific prompt type. Otherwise one dependency is better. |
| commander | citty | An unjs-native only CLI; commander has broader familiarity and subcommand ergonomics. |
| magicast | recast / jscodeshift / string templates | Multi-file codemods or non-config edits. Magicast's Vite/Nuxt helpers are purpose-built for this CLI. |
| tinyexec | execa | Advanced stream/pipe/process-management needs. `tinyexec` is enough for installs and editor commands. |
| Vitest 5 | `node:test` | Zero-dependency Node-only tests; you lose the Vite transform pipeline and Vue SFC support. |
| Playwright | Cypress | An existing Cypress suite. Playwright's Shadow DOM piercing and multi-webServer support fit this repo. |
| jsdom | happy-dom | Speed in unit tests where layout is irrelevant; keep Playwright for Shadow DOM/layout. jsdom is the safer Vue Test Utils baseline. |
| ESLint + typescript-eslint | oxlint | A fast pre-commit pass, not the only linter; oxlint lacks the type-aware rule set. |
| Prettier | oxfmt / Biome | A single all-in-one toolchain. oxfmt is still 0.x; Prettier + `eslint-config-prettier` is the boring choice. |
| pnpm workspaces | npm/yarn workspaces or Turborepo/Nx | Org constraints or a much larger build graph. Three packages do not need a task orchestrator; `pnpm -r` suffices. |
| Changesets | release-it / manual tags | Single-package releases. Changesets handles linked versioning cleanly. |
| ESM-only + IIFE | Dual ESM/CJS | Legacy webpack 4 or Node <20.19 consumers. Not supported. Node 20.19+ can `require(esm)`. |
| IIFE bundles Vue | IIFE externalizes Vue to `window.Vue` | If install size matters more than zero-config manual usage. The IIFE is a dev-only convenience; bundling Vue makes it standalone. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vue 2 / Vue < 3.5 | No `EffectScope.pause()/resume()`; Vue 2 is EOL. Freezing would need fragile monkey-patching. | Vue `^3.5.0` (`3.5.44` tested). |
| React Grab's `bippy` / React fiber resolver | React-specific internals; no Vue equivalent. | `__vueParentComponent`, `type.__name`/`__file`, and the compile-time loc attributes. |
| Rendering the overlay into the host app tree | Host freeze pauses the overlay; host CSS bleeds in; extra app root pollutes the host. | Separate `createApp` in an open ShadowRoot. |
| iframe overlay | Coordinate translation, clipboard permissions, focus, and event bridging are all harder than Shadow DOM. | Shadow DOM + `composedPath()` hit testing. |
| `<style scoped>` in overlay SFCs | Vite extracts SFC styles into a CSS asset; the shadow root never sees them. | One `styles.css?inline` string injected into the shadow root. |
| Tailwind + Preflight for the overlay | Build pipeline and global-reset assumptions for a UI that is isolated anyway. | Hand-written CSS in the shadow root. |
| Mutating `vite:vue`'s `api.options` | Ordering/`api` coupling; different resolved options across Vite/plugin-vue versions. | `enforce: 'pre'` raw-source transform with `@vue/compiler-dom` + MagicString. |
| Recompiling SFCs with `@vue/compiler-sfc` in a Vite transform | Duplicates plugin-vue, breaks HMR/scoped styles, and shifts source-map ownership. | Pre-transform attributes only; let plugin-vue compile. |
| `vite-plugin-vue-inspector` as a dependency | Its attribute/client/editor behavior is not the copy grammar; it also adds UI and coupling. | Reuse its pre-transform pattern; ship our own `data-vue-grab-loc`. |
| Vite 8 object-form hook filters (`transform: { filter, handler }`) in this plugin | Ties the plugin to Rolldown's hook shape; classic function hooks are the common denominator across Vite 5–8 and simpler to debug. | Classic `transform(code, id)` function hook. |
| `build.rollupOptions` in new Vite 8 configs | Deprecated in Vite 8 in favor of `build.rolldownOptions`. | `build.rolldownOptions` for the Vite 8 build. |
| `import.meta.env.DEV` / `process.env.NODE_ENV` inside the published runtime | Vite lib builds bake env values; webpack does not replace `import.meta.env`; a dev-only package should not self-gate. | Guard the import in app code, or let the dev-only Vite plugin inject `/auto` only in `serve`. |
| TypeScript 7.0.x (native) | `typescript-eslint@8.72` supports `<6.1.0`; vue-tsc/language tooling is not ready. | TypeScript `6.0.3`; fallback `5.9.3` if a dependency regresses. |
| oxfmt / oxlint as the only formatter/linter | oxfmt is 0.x; oxlint does not yet cover the full type-aware typescript-eslint rule set. | Prettier + ESLint + typescript-eslint. |
| happy-dom for layout/Shadow DOM assertions | Incomplete layout fidelity; can pass tests a real browser fails. | jsdom for unit logic; Playwright for real browser behavior. |
| tsup for the runtime | esbuild has no built-in `.vue` SFC loader; you would add a third-party plugin and lose Vite's CSS/`?inline` handling. | Vite lib mode + `@vitejs/plugin-vue`. |
| unbuild 3.6 for this repo | Peer `typescript ^5.9.2` blocks TypeScript 6. | Vite lib mode. |
| tsdown 0.23 for this repo | 0.x version and a second bundler; only compelling if you drop SFCs. | Vite lib mode. |
| CJS dual build | Dual-package hazard for a singleton overlay, extra `.d.cts` maintenance, no real consumer. | ESM + standalone IIFE; `require(esm)` on Node 20.19+. |
| Bundling Vue into the ESM runtime | Duplicates Vue and breaks the peer contract. | `external: ['vue']`; bundle Vue only in the IIFE. |
| `vue-demi` / `@vue/compat` | Vue 3.5+ only; no Vue 2 support is in scope. | Direct Vue 3.5 APIs. |
| `child_process.exec` / `shell: true` in the CLI | Shell interpolation with user paths/options is an injection risk. | `tinyexec`/`spawn` with argv arrays; validate editor paths against `root`. |
| `prompts` + `ora` + `picocolors` + `boxen` | Four dependencies for what `@clack/prompts` covers. | `@clack/prompts`. |
| Shipping a `styles.css` export | The overlay is shadow-scoped; a global stylesheet can leak or be imported incorrectly. | Inline CSS string inside the shadow root; assert no `.css` asset. |

## Stack Patterns by Variant

**If Vite SPA (the primary path):**
- `pnpm add -D vue-grab`; add `vueGrab()` after `vue()` in `plugins`.
- The plugin instruments SFCs in `serve`, injects the config global + `vue-grab/auto`, and exposes `POST /__vue-grab/open`.
- Because `auto` is injected at `head-prepend`, the overlay is ready before the app mounts; component resolution happens per event, so no mount ordering is required.
- The CLI uses `magicast/helpers.addVitePlugin` to add the import and call, and `updateVitePluginConfig` to persist options.
- Reason: zero app-entry edits; one plugin owns both compile-time and runtime wiring.

**If Nuxt 3/4:**
- `pnpm add -D vue-grab`; add `modules: ['vue-grab/nuxt']` (or let the CLI call `addNuxtModule`).
- The module returns early unless `nuxt.options.dev`; it adds the Vite plugin with `addVitePlugin` and a client-only bootstrap with `addPluginTemplate({ mode: 'client' })`.
- Do not import `vue-grab/auto` in a universal plugin or server middleware. The runtime entry is DOM-free at import, but the bootstrap is client-only.
- Add a Nitro dev handler only if the Vite `configureServer` middleware is not reachable for `/__vue-grab/open`; keep the same path validation.
- Reason: Nuxt generates HTML at runtime, so `transformIndexHtml` is not the wiring path; the module is.

**If plain webpack / Vue CLI / manual install:**
- `pnpm add -D vue-grab`; in the entry, guard the import: `if (process.env.NODE_ENV !== 'production') import('vue-grab/auto')`, or call `init()` after mount.
- The runtime is ESM-only; webpack 5 consumes it. Webpack 4 is out of scope.
- No exported CSS: overlay styles are inlined into the shadow root, so no `css-loader`/`style-loader` rule is needed for Vue Grab.
- Exact line/column requires the compiler transform: add `vueGrabNodeTransform()` from `vue-grab/compiler` to `vue-loader`'s `compilerOptions.nodeTransforms` via `chainWebpack`. Without it, the runtime degrades to `__file` (file only, `strategy: 'file'`).
- Reason: manual installs cannot assume Vite; the attribute contract and runtime fallback keep the copy flow working.

**If no-build / IIFE:**
- Load `dist/index.global.js` after the app (or from `unpkg`); the IIFE is self-contained (Vue bundled) and auto-initializes.
- Set options before the script or via `window.__VUE_GRAB_CONFIG__`; expose `VueGrab.init/destroy` for teardown.
- No compiler transform exists in this path, so source locations are file-only unless the app is also built with the Vite/compiler plugin.
- Reason: demo/quick-try path; not the recommended delivery for a real project.

**If Vite 5 legacy (constraint: Vite 5+):**
- Use the same `vue-grab/vite` plugin; only classic hooks are used.
- Unit tests cannot run under Vite 5 because Vitest 5 requires Vite `^6.4 || ^7 || ^8`; cover Vite 5 with a Playwright fixture (`apps/fixtures/vite5`) that boots the real dev server.
- Reason: keeps the peer range honest without pretending the test runner supports it.

**If Vite SSR (non-Nuxt):**
- The plugin instruments both client and server transforms for hydration consistency; attributes are dev-only and harmless in SSR HTML.
- Guard `vue-grab/auto` to the client (`typeof window !== 'undefined'` or a client-only entry) and call `init()` from `onMounted` if the framework does not provide a client-only hook.
- Reason: SSR imports must not touch `window`/`document`, and hydration must see the same attributes on both sides.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `vue-grab@0.x` | `vue ^3.5.0` | Tested with `vue@3.5.44`. `EffectScope.pause/resume` and dev DOM metadata verified in `vuejs/core` v3.5.34 source. |
| `vue-grab@0.x` | Node `>=20.19.0` | ESM-only; Node 20.19+ enables `require(esm)`. Repo tooling needs `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`. |
| `vue-grab/vite@0.x` | `vite ^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0` | Tested against 5.4.21, 6.4.4, 7.3.7, 8.3.4. Vite 8 is Rolldown-based and deprecates `build.rollupOptions`; the plugin uses classic hooks only. |
| `vue-grab/vite@0.x` | `@vitejs/plugin-vue` 5.x or 6.x | Tested with 6.0.10 (peer Vite 5–8, Vue `^3.2.25 \|\| ^3.6.0-rc.10`). The plugin transforms raw `.vue` source before plugin-vue, so it does not call plugin-vue internals. |
| `vue-grab/nuxt@0.x` | `nuxt ^3.13.0 \|\| ^4.0.0`; `@nuxt/kit ^3.13.0 \|\| ^4.0.0` | Tested with Nuxt 3.21.11 and 4.6.2. Nuxt 4.6 requires Node `^22.22.3 \|\| ^24.15.0 \|\| >=26`. |
| `vitest@5.0.5` | `vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`; Node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | Cannot run against Vite 5; Vite 5 compatibility is an e2e fixture. |
| `@vue/test-utils@2.5.1` | `vue 3.x`, `@vue/compiler-dom 3.x`, `@vue/server-renderer 3.x` | Vue 3.5.44 supplies the compiler/server-renderer peers. |
| `typescript@6.0.3` | `typescript-eslint@8.72.0` (<6.1), `vue-tsc@3.3.13` (>=5), `@vue/language-core@3.3.13` | Do not upgrade to TypeScript 7 until typescript-eslint and vue-tsc declare support. Fallback: `typescript@5.9.3`. |
| `eslint@10.13.0` | `typescript-eslint@8.72.0`, `eslint-plugin-vue@10.11.1`, `@vue/eslint-config-typescript@14.9.0` | Flat config only; use `withVueTs(...)`. |
| `@clack/prompts@1.8.1` | Node `>=20.12.0` | CLI engines `>=20.19.0` covers it. |
| `commander@14.0.3` | Node `>=20` | Commander 15 raises the floor to Node 22.12; not needed. |
| `@changesets/cli@3.0.3` | Node `^22.11 \|\| ^24 \|\| >=26`, pnpm `>=10` | Repo Node 22.22.3/24.15 satisfies it. |
| `magic-string@1.4.3` | ESM-only | If a transitive dependency pins `0.30.x`, pnpm installs both; they do not share state. |
| `vite-plugin-dts@5.1.2` | Vite `>=3`, Rolldown via `unplugin-dts@1.1.2`, `@vue/language-core ^3.1.5` | `.vue` declaration support verified in the unplugin README/chunks. Fallback is `vue-tsc --emitDeclarationOnly`. |
| `launch-editor@2.14.2` | Node (CJS) | Import default in ESM with `esModuleInterop: true`; used only by the Vite dev middleware. |
| `pnpm@11.28.6` | Node `>=18.12` | Catalogs and `onlyBuiltDependencies` in `pnpm-workspace.yaml`. |
| `vite@8.3.4` | Node `^20.19.0 \|\| >=22.12.0` | Vite 8 uses Rolldown `~1.2.12` and Lightning CSS. |

## Top 3 Risks

1. **Compiler instrumentation correctness and source-map/HMR drift.** Parsing a whole SFC with `@vue/compiler-dom`, injecting attributes, and returning a hires map can subtly break HMR or misplace locations for `<template src>`, pug/jade, nested templates, or multiple root nodes. Mitigation: instrument only the main `.vue` request, skip non-HTML templates and `node_modules`, assert no double injection, test map line/column against known fixtures, run an HMR edit in Playwright, and fall back to `__file` when no attribute is present.
2. **Freeze/restore completeness.** Component scopes are detached, so the root scope is not enough; missing instances (Teleport, Suspense, KeepAlive, async components, multiple apps, shadow-hosted apps) or animations created during inspection can leave the page visually stuck. Mitigation: walk the full instance graph with a `WeakSet`, pause every `instance.scope`, snapshot/restore animations in `try/finally`, filter `document.getAnimations()` to exclude overlay targets, and run freeze torture e2e tests (nested layers, HMR during freeze, unmount while active, multiple apps).
3. **Cross-version/package-matrix breakage.** Supporting Vite 5–8, Nuxt 3/4, Node 20/22/24, ESM-only exports, `.vue` declaration output, and a dev-only injection path creates several independent failure surfaces. Mitigation: keep the plugin to classic hooks, test Vite 5 via a Playwright fixture (Vitest 5 cannot run on Vite 5), run `publint` + `attw --pack . --profile esm-only` on every publish, keep `sideEffects` limited to `dist/auto.js`, and make `init()` idempotent with a `window` guard so double injection or SSR imports cannot break.

## Sources

- npm registry, queried 2026-10-20 (`npm view <pkg> version/peerDependencies/engines`): versions for Vue, Vite, `@vitejs/plugin-vue`, TypeScript, Vitest, Playwright, ESLint, pnpm, Nuxt, and all libraries in the tables. Version and peer ranges are from the registry, not training data.
- https://vite.dev/guide/build.html#library-mode — library mode, `build.lib` entries/formats, CSS extraction, `rolldownOptions`.
- https://vite.dev/config/build-options.html#build-lib — `build.lib` type, `formats` (`es`/`cjs`/`umd`/`iife`), `cssFileName`, Vite 8 `build.rolldownOptions` (and `rollupOptions` deprecation).
- https://vite.dev/guide/api-plugin.html — plugin conventions, classic hooks vs object-form hooks, `configResolved`, `configureServer`, `transformIndexHtml`, virtual modules.
- https://github.com/vuejs/core/blob/v3.5.34/packages/runtime-core/src/renderer.ts#L723 — `__vueParentComponent`/`__vnode` are set only under `__DEV__`/prod-devtools.
- https://github.com/vuejs/core/blob/v3.5.34/packages/runtime-core/src/component.ts#L636 — every component scope is `new EffectScope(true /* detached */)`.
- https://github.com/vuejs/core/blob/v3.5.34/packages/reactivity/src/effectScope.ts#L68 — `pause()`/`resume()` recursively pause/resume child scopes and effects.
- https://github.com/vuejs/core/blob/v3.5.34/packages/runtime-dom/src/index.ts#L146 — `data-v-app` is set on the mount container.
- https://github.com/vitejs/vite-plugin-vue/blob/main/packages/plugin-vue/src/index.ts — `__file` is attached in dev (`devToolsEnabled || devServer && !isProduction`).
- https://github.com/webfansplz/vite-plugin-vue-inspector — proven `enforce: 'pre'` + `@vue/compiler-dom` `parse`/`transform` + MagicString pre-transform pattern.
- https://vuejs.org/api/reactivity-advanced.html#effectscope — EffectScope API context (the docs page does not yet list `pause`/`resume`; the 3.5.34 source does).
- https://nuxt.com/docs/guide/going-further/modules — Nuxt module authoring, `defineNuxtModule`.
- https://nuxt.com/docs/api/utils/add-vite-plugin — `addVitePlugin` API.
- https://github.com/unjs/magicast — `magicast/helpers` `addVitePlugin`, `findVitePluginCall`, `updateVitePluginConfig`, `addNuxtModule`.
- https://github.com/antfu-collective/package-manager-detector — `detect()` and `resolveCommand()`.
- https://github.com/tinylibs/tinyexec — `x(command, args, { nodeOptions, throwOnError })`; no shell by default.
- https://github.com/qmhc/unplugin-dts — Vite/Rolldown support and `.vue` declaration generation (peer `@vue/language-core`).
- https://vitest.dev/guide/projects — `test.projects` (the `workspace` config is deprecated).
- https://playwright.dev/docs/clipboard — clipboard read/write permissions for copy-flow e2e.
- https://pnpm.io/workspaces and https://pnpm.io/catalogs — workspace globs, catalogs, `onlyBuiltDependencies`.
- https://typescript-eslint.io/users/dependency-versions/ — supported TypeScript range (`<6.1.0` for typescript-eslint 8.72).
- https://nodejs.org/en/blog/release/v20.19.0 — `require(esm)` enabled by default in Node 20.19 (and 22.x).
- https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow — open shadow root semantics used by the overlay.
- Upstream reference: `/tmp/react-grab` (`packages/react-grab/package.json`, `packages/cli/package.json`, `vite.config.ts`) — build split, CLI deps, and IIFE/module packaging patterns; Vue-specific internals replaced as described above.

---
*Stack research for: Vue Grab*
*Researched: 2026-10-20*
