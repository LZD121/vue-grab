# vue-grab

Development-only Vue 3.5+ overlay that copies agent-ready source context.

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
import { vueGrab } from "vue-grab/vite";

export default defineConfig({
  plugins: [vueGrab()],
});
```

## API

```ts
import { init } from "vue-grab";

const api = init({
  activationMode: "toggle",
  activationKey: "Meta+C",
  maxContextLines: 3,
});

api.activate();
api.copyElement(document.querySelector(".button")!);
await api.getSource(document.querySelector(".button")!);
api.dispose();
```

`window.__VUE_GRAB__` is populated automatically in a browser, and `vue-grab:init` is dispatched. Importing the package on the server returns a no-op API.

## Subpaths

- `vue-grab` — runtime and public API
- `vue-grab/vite` — Vite plugin that injects exact template locations
- `vue-grab/compiler` — raw SFC transform used by the plugin
- `vue-grab/constants` — shared attribute and default constants

The runtime is dev-only. Guard the import with `import.meta.env.DEV` or `import.meta.dev`.
