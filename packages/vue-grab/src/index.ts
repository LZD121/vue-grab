import { EVENT_INIT } from "./constants.js";
import { GrabController } from "./core/controller.js";
import { detectAppTheme } from "./core/theme.js";
import type { Options, VueGrabAPI } from "./types.js";

let controller: GrabController | null = null;

const createNoopApi = (): VueGrabAPI => ({
  activate: () => undefined,
  deactivate: () => undefined,
  toggle: () => undefined,
  comment: () => undefined,
  isActive: () => false,
  isEnabled: () => false,
  setEnabled: () => undefined,
  getToolbarState: () => null,
  setToolbarState: () => undefined,
  onToolbarStateChange: () => () => undefined,
  reset: () => undefined,
  dispose: () => undefined,
  copyElement: async () => false,
  getSource: async () => null,
  getStackContext: async () => "",
  getState: () => ({
    isActive: false,
    isDragging: false,
    isCopying: false,
    isPromptMode: false,
    isSelectionBoxVisible: false,
    isDragBoxVisible: false,
    targetElement: null,
    selectionCount: 0,
    dragBounds: null,
    grabbedBoxes: [],
    labelInstances: [],
    selectionFilePath: null,
    toolbarState: null,
  }),
  setOptions: () => undefined,
  registerPlugin: () => undefined,
  unregisterPlugin: () => undefined,
  getPlugins: () => [],
  getDisplayName: () => null,
});

export const init = (options: Options = {}): VueGrabAPI => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return createNoopApi();
  }
  if (window.__VUE_GRAB_DISABLED__) return createNoopApi();
  if (window.__VUE_GRAB__) return window.__VUE_GRAB__;
  if (controller) return controller.api;

  controller = new GrabController(options);
  controller.mount();
  return controller.api;
};

export const getGlobalApi = (): VueGrabAPI | null => {
  if (typeof window !== "undefined" && window.__VUE_GRAB__) return window.__VUE_GRAB__;
  return controller?.api ?? null;
};

export const getAppTheme = (): "light" | "dark" => detectAppTheme();

export { GrabController } from "./core/controller.js";
export {
  buildCopyText,
  buildElementContext,
  buildPayload,
  getSourceInfo,
  getStackContext,
} from "./core/context.js";
export { createElementSelector, getElementPreview, getInlineElementPreview } from "./core/preview.js";
export { resolveSource, normalizeFilePath, relativeDisplayPath, parseLocation } from "./core/source.js";
export { getElementAtPoint, getElementsInDrag, isGrabbable } from "./core/selection.js";
export { freezePage, unfreezePage, isPageFrozen } from "./core/freeze.js";
export { writeClipboard } from "./core/clipboard.js";
export {
  DEFAULT_ACTIVATION_KEY,
  isEditableTarget,
  parseActivationKey,
} from "./core/activation.js";
export * from "./constants.js";
export type * from "./types.js";

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  !window.__VUE_GRAB_DISABLED__ &&
  !window.__VUE_GRAB__
) {
  const api = init();
  window.dispatchEvent(new CustomEvent(EVENT_INIT, { detail: api }));
}
