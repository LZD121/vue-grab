export const VERSION = "0.1.0";

export const HOST_ATTRIBUTE = "data-vue-grab-host";
export const IGNORE_ATTRIBUTE = "data-vue-grab-ignore";
export const LOC_ATTRIBUTE = "data-vue-grab-loc";
export const INPUT_ATTRIBUTE = "data-vue-grab-input";
export const FROZEN_ATTRIBUTE = "data-vue-grab-frozen";
export const FREEZE_STYLE_ATTRIBUTE = "data-vue-grab-freeze-style";
export const TOOLBAR_ATTRIBUTE = "data-vue-grab-toolbar";

export const EVENT_INIT = "vue-grab:init";
export const EVENT_SELECTED = "vue-grab:element-selected";

export const DEFAULT_KEY_HOLD_DURATION_MS = 100;
export const DEFAULT_MAX_CONTEXT_LINES = 3;
export const MAX_CONTEXT_LINES = 50;
export const FEEDBACK_DURATION_MS = 1500;
export const FADE_DURATION_MS = 125;
export const INPUT_FOCUS_ACTIVATION_DELAY_MS = 400;
export const INPUT_TEXT_SELECTION_ACTIVATION_DELAY_MS = 600;
export const DRAG_THRESHOLD_PX = 4;
export const ELEMENT_DETECTION_THROTTLE_MS = 16;
export const BOUNDS_RECALC_INTERVAL_MS = 100;
export const Z_INDEX_OVERLAY = 2147483647;
export const MAX_PREVIEW_TEXT_LENGTH = 100;
export const MAX_PREVIEW_ATTR_LENGTH = 120;
export const MAX_PREVIEW_ATTR_COUNT = 8;
export const MAX_SELECTOR_DEPTH = 12;

export const MIME_TYPE = "application/x-vue-grab";

export const OVERLAY_APP_FLAG = "__VUE_GRAB_OVERLAY__";

export const BUILTIN_COMPONENT_NAMES: Record<string, true> = {
  Fragment: true,
  Teleport: true,
  Suspense: true,
  KeepAlive: true,
  BaseTransition: true,
  Transition: true,
  TransitionGroup: true,
  NuxtPage: true,
  NuxtLayout: true,
  NuxtRoot: true,
  RouterView: true,
  RouterLink: true,
  NuxtLink: true,
};
export const PINNED_STYLE_PROPERTIES = [
  "background-color",
  "background-image",
  "color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "box-shadow",
  "text-shadow",
  "opacity",
  "transform",
  "display",
  "visibility",
  "text-decoration-color",
  "text-decoration-line",
  "outline-color",
  "outline-width",
  "outline-style",
] as const;
