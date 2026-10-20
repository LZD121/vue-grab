# Phase 5: Install Path, Frameworks, and Release - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A publishable `@vue-grab/cli` that wires Vite and Nuxt projects, typed runtime subpaths, documentation, npm packaging checks, and the supported-version verification matrix.

</domain>

<decisions>
### CLI
- `init` detects Vue, Vite/Nuxt, package manager, entry file, and existing wiring.
- It creates a managed `src/vue-grab.ts` (or `plugins/vue-grab.client.ts` for Nuxt) with marked start/end comments.
- It adds one entry import without an extension and inserts `vueGrab()` into the framework config.
- `configure` rewrites only the managed block.
- No telemetry or version pings.

### Nuxt
- Use a client-only plugin guarded by `import.meta.dev`.
- Add `vueGrab()` to `vite.plugins` so both server and client dev compilation inject the same attributes.

### Packaging
- `vue-grab` is ESM with typed `./vite`, `./compiler`, and `./constants` subpaths.
- `@vue-grab/cli` has a `vue-grab` bin and ESM build.
- Preserve the upstream MIT notice.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/cli/src/transform.ts` owns managed block and config edits.
- `packages/vue-grab/vite.config.ts` builds the browser and Node subpaths.
- Demo and Playwright configs cover the install path at runtime.

### Established Patterns
- pnpm workspace; Vite builds; Vitest tests.

### Integration Points
- CLI writes into user Vite/Nuxt config but never imports the browser runtime.
- npm `files` includes `dist`, `LICENSE`, and `README.md`.

</code_context>

<specifics>
## Specific Ideas

- Fixture projects for Vite and Nuxt validate idempotent writes and managed block updates.

</specifics>

<deferred>
## Deferred Ideas

- `add/remove/pull/watch/stop/upgrade` CLI commands, a standalone Nuxt module package, and an IIFE/CDN build are v2/v1.x.
