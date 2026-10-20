# Milestones

## ✅ v1.0 MVP — Vue Grab port (2026-10-20)

Shipped the Vue 3.5+ runtime, compile-time Vite location plugin, `vue-grab` CLI, Vite/Nuxt wiring, demo app, unit tests, Playwright coverage, and publishable packages.

- Runtime: `packages/vue-grab`
- CLI: `packages/cli`
- Demo: `apps/demo`
- Audit: `.planning/v1.0-MILESTONE-AUDIT.md`
- Archived roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Archived requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`

### Accepted debt

Nuxt hydration was fixture-verified rather than booted; the Playwright matrix covers copy/multi-select/freeze but not CSP/focus-trap/HMR; no formal performance budget was recorded; the Vite 5/Nuxt 3–4 CI matrix is defined but not yet executed.
