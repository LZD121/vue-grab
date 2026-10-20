# Vue Grab

## What This Is

Vue Grab is a dev-only, in-page inspection overlay that ports [React Grab](https://github.com/aidenybai/react-grab) to Vue 3.5+. Developers hover, click, or drag-select UI in a running Vue app, then copy agent-ready context that names the rendered element, its Vue component ancestry, and the exact `.vue` source location.

It ships as a pnpm monorepo: the browser runtime (`vue-grab`), a Vite plugin that injects compile-time source locations, and a `vue-grab` CLI that wires the runtime into Vite and Nuxt projects.

## Core Value

One keyboard shortcut copies the exact Vue component and source location behind any element on screen, so a coding agent edits the real file instead of guessing from a screenshot or DOM dump.

## Requirements

### Validated

- ✓ Developer can activate the overlay with a configurable key (toggle or hold) without breaking the host app's keyboard handling — v1.0
- ✓ Developer can hover any rendered element and see its tag, component name, and source file highlighted — v1.0
- ✓ Developer can click, shift-click, or drag-select one or many elements and copy agent-ready reference context — v1.0
- ✓ Copied context includes Vue component ancestry and exact `file:line:column` locations — v1.0
- ✓ Overlay freezes Vue reactivity, CSS/WAAPI animations, and pseudo-states while inspecting, then restores cleanly — v1.0
- ✓ Developer can comment on a selection and copy a prompt with the reference context — v1.0
- ✓ Developer can open the selected source file in their editor from the overlay — v1.0
- ✓ Overlay is fully keyboard-navigable (hierarchy, toolbar, context menu, prompt mode) — v1.0
- ✓ Vite plugin injects development-only source locations into Vue SFC templates — v1.0
- ✓ CLI can detect a Vue 3 Vite/Nuxt project, install the package, wire the runtime, and persist activation options — v1.0
- ✓ A demo Vue app and automated tests prove the copy flow end-to-end — v1.0

### Active

(None — v1.0 milestone complete)

### Out of Scope

- Vue 2 and Vue < 3.5 — Vue 2 is EOL; `EffectScope.pause()` (3.5+) is the clean freeze primitive
- React, Solid, Svelte, and framework-agnostic adapters — this project ports the Vue runtime only
- Three.js/WebGL object selection — upstream's Three path is framework-independent but a separate subsystem
- Browser extension — upstream's extension is an extra distribution channel, not core value
- Next.js/RSC server-frame symbolication — no Vue equivalent in scope
- Production builds and hosted telemetry — the runtime is development-only and sends nothing
- Automatic code edits or agent integration beyond clipboard text — Vue Grab supplies context, not an agent client

## Context

**Upstream reference.** `aidenybai/react-grab` (MIT, v0.2.0) is a SolidJS-rendered overlay with a React fiber/source resolver, a plugin registry (copy, comment, open), animation and pseudo-state freezing, canvas highlights, and a CLI that detects React frameworks. The port keeps the interaction model and copy grammar while replacing React-specific internals.

**Vue internals verified in `vuejs/core` v3.5.34.**
- In dev builds, every mounted DOM node is given `__vueParentComponent` and `__vnode` (`renderer.ts`), so element → component instance needs no devtools hook.
- `instance.type.__file`, `type.__name`, `type.name`, and `type.displayName` supply the component file and name.
- Mounted apps expose `container.__vue_app__`; `app._instance` is the root component.
- Vue 3.5 exposes `EffectScope.pause()` / `resume()`, and component render effects live in per-instance scopes, so traversing mounted instances and pausing their scopes freezes reactive updates.
- Vue's template AST retains `loc.start.line/column`; a compiler node transform can add a `data-vue-grab-loc` attribute during dev builds for exact template locations.

**Empty repository.** `/mnt/c/Home/Repos/vue-grab` starts with no code, no package manifest, and no prior decisions. The upstream repository is cloned at `/tmp/react-grab` for reference during planning only.

## Constraints

- **Framework**: Vue 3.5+ — required for `EffectScope.pause()`; no Vue 2 compatibility layer.
- **Language**: TypeScript, strict mode — the runtime and compiler plugin are both typed.
- **Build**: pnpm workspace monorepo, Vite library builds — mirrors upstream and keeps the CLI Node-only.
- **Delivery**: development-only code paths — no production bundle changes beyond an inert import guard.
- **Compatibility**: Vite 5+ and Nuxt 3+ for the plugin/CLI; plain Vue CLI/Webpack can use manual installation.
- **License**: MIT, with upstream copyright and attribution preserved.
- **Privacy**: no telemetry, no network calls at runtime except the developer's own dev server.
- **Source accuracy**: compile-time locations are the primary path; runtime `__file` fallback must degrade without breaking copy.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Target Vue 3.5+ only | `EffectScope.pause()` gives a safe, framework-level freeze; older Vue needs fragile monkey-patching | ✓ Good |
| Ship runtime + Vite plugin + CLI | A library alone still leaves manual wiring; the CLI is the upstream install experience | ✓ Good |
| Full core UX parity | The value is the complete inspect → select → copy loop, not a single hover-copy helper | ✓ Good |
| Compile-time locations with runtime fallback | `__file` alone lacks line/column; template injection matches React Grab's precision without source-map fetches | ✓ Good |
| pnpm monorepo | Keeps browser runtime, Node CLI, compiler plugin, demo, and tests independently buildable | ✓ Good |
| Vertical MVP phases | Each phase must produce a runnable end-to-end slice, not a layer that cannot be exercised | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-20 after v1.0 milestone*
