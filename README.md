# Vue Grab

Copy the Vue component and exact source location behind any UI element.

Vue Grab is a development-only overlay for Vue 3.5+. Hover, click, or drag-select elements in a running app, then copy a reference an agent can act on:

```txt
[<button class="button">Save</button> in SaveButton (at src/components/SaveButton.vue:12:5)]
  in ProfileCard (at src/components/ProfileCard.vue:8:3)
```

It is a port of [React Grab](https://github.com/aidenybai/react-grab) that replaces React fibers and dispatcher patching with Vue's own instance graph and `EffectScope.pause()`.

## Quick Start

```bash
pnpm dlx @vue-grab/cli init
```

Or install manually:

```bash
pnpm add -D vue-grab
```

```ts
// src/main.ts
if (import.meta.env.DEV) {
  void import("vue-grab");
}
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vueGrab } from "vue-grab/vite";

export default defineConfig({
  plugins: [vueGrab()],
});
```

Press `Meta+C` (macOS) or `Ctrl+C` (elsewhere) to activate. Click an element to copy its context. `Shift` reveals the hierarchy, `Shift`-click selects multiple elements, and dragging a rectangle selects a region.

## Packages

| Package | Purpose |
|---------|---------|
| `vue-grab` | Browser runtime, Vue adapter, Vite/compiler subpaths, and public API |
| `@vue-grab/cli` | `vue-grab init` and `vue-grab configure` for Vite and Nuxt |
| `apps/demo` | Vite playground used by the automated tests |

## Development

```bash
pnpm install
pnpm dev          # demo at http://localhost:5175
pnpm test
pnpm typecheck
pnpm build
```

## License

MIT. Vue Grab is based on React Grab by Aiden Bai; the upstream copyright notice is preserved in [LICENSE](./LICENSE).
