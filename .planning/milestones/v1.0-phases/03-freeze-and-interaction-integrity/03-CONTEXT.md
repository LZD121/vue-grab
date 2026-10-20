# Phase 3: Freeze and Interaction Integrity - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A single ref-counted freeze session that pauses Vue component scopes, CSS/WAAPI/SMIL animations, rAF loops, and hover/focus styling while the overlay is active, plus input/IME/focus-trap safety. Everything restores on deactivation, pagehide, HMR, or dispose.

</domain>

<decisions>
## Implementation Decisions

### Vue Freeze
- Discover mounted apps through `__vue_app__` on document elements and open shadow roots, excluding the overlay app by its `__VUE_GRAB_OVERLAY__` flag.
- Walk each app's `_instance` and vnode tree, including Teleport/Suspense/KeepAlive branches, and pause every unique component `EffectScope`.
- Record whether a scope was already paused and resume only scopes this session paused.

### Animation and Pseudo-State Freeze
- Pause `document.getAnimations()` instances outside the overlay, call `pauseAnimations()` on SVG roots, and wrap `requestAnimationFrame` to defer host callbacks.
- Pin the hovered element and its subtree with computed `:hover`/`:focus` styles, then restore exact inline values on unfreeze.
- Inject a scoped freeze stylesheet for CSS animations/transitions; remove it on unfreeze.

### Interaction Safety
- Claim activation keys with capture listeners; ignore `isComposing`, repeated keydowns, and editable targets unless allowed.
- Restore focus on deactivation and release hold mode on blur/pagehide.
- Exclude overlay events from host selection and freeze handling.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vue-adapter.ts` discovers apps and walks instances.
- `freeze.ts` owns the freeze session and restore order.
- `selection.ts` already handles composed parents and overlay exclusion.

### Established Patterns
- Controller owns the activation lifecycle; freeze functions are side-effect modules.

### Integration Points
- `GrabController.activate()` runs `refreshHovered()` before freezing so the hovered subtree is available to pin.
- `deactivate()` calls `unfreezePage()` before clearing state.

</code_context>

<specifics>
## Specific Ideas

- The demo counter increments every 700 ms and must stop while frozen.
- The hover reveal card must stay open after the pointer moves to the overlay.

</specifics>

<deferred>
## Deferred Ideas

- Same-origin iframe traversal and closed shadow roots are v2.
