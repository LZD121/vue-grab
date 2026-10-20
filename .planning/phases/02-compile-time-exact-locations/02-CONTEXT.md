# Phase 2: Compile-Time Exact Locations - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A Vite plugin and raw SFC compiler transform that inject `data-vue-grab-loc="file:line:column"` on native template elements during development. The runtime consumes the attribute and keeps a `__file` fallback.

</domain>

<decisions>
## Implementation Decisions

### Transform
- Parse the SFC descriptor with `@vue/compiler-sfc` and walk the descriptor template AST, so line/column values are SFC-absolute and 1-based.
- Inject attributes into the original source with MagicString rather than recompiling the template; this preserves `@vitejs/plugin-vue` compilation and source maps.
- Inject on native elements only. Never inject on `<template>`, `<slot>`, `<component>`, or component tags; fallthrough attributes are unreliable.
- Skip `lang="pug"` and external `src` templates.
- Use a project-relative POSIX path in the attribute.

### Runtime
- Parse the location with a greedy `file:line:column` regex so Windows drive letters and nested paths work.
- Use `data-vue-grab-loc` first, then `instance.type.__file`, then component name only.
- Normalize `?query`, `file://`, `/@fs/`, Windows separators, and duplicate slashes.

### Plugin
- `vue-grab/vite` exports `vueGrab()`, `apply: 'serve'`, `enforce: 'pre'`.
- Transform the main `.vue` request only; ignore sub-requests.
- Return the MagicString high-resolution source map.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/vue-grab/src/core/source.ts` already owns normalization and the fallback chain.
- `packages/vue-grab/src/core/context.ts` builds the copy grammar.

### Established Patterns
- Vite library mode, subpath exports, strict TypeScript.

### Integration Points
- `vue-grab/vite` is imported in `apps/demo/vite.config.ts`.
- `data-vue-grab-loc` is stripped from previews by `preview.ts`.

</code_context>

<specifics>
## Specific Ideas

- Golden tests must assert nested, same-line, and `v-for` positions.
- The attribute contract is shared by the runtime, compiler, CLI, and tests.

</specifics>

<deferred>
## Deferred Ideas

- Source-map symbolication, Vapor support, and cross-version AST drift hardening beyond the tested Vue 3.5 line.
