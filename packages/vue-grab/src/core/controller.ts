import { createApp, markRaw, reactive, type App } from "vue";
import overlayStyles from "../styles.css?inline";
import OverlayRoot from "../components/OverlayRoot.vue";
import {
  DEFAULT_KEY_HOLD_DURATION_MS,
  DEFAULT_MAX_CONTEXT_LINES,
  EVENT_INIT,
  EVENT_SELECTED,
  FEEDBACK_DURATION_MS,
  HOST_ATTRIBUTE,
  IGNORE_ATTRIBUTE,
  INPUT_FOCUS_ACTIVATION_DELAY_MS,
  OVERLAY_APP_FLAG,
  Z_INDEX_OVERLAY,
} from "../constants.js";
import type {
  HierarchyItem,
  MenuState,
  Options,
  OverlayBounds,
  PromptState,
  SelectionLabel,
  SettableOptions,
  SourceInfo,
  ToolbarState,
  VueGrabAPI,
  VueGrabState,
} from "../types.js";
import {
  DEFAULT_ACTIVATION_KEY,
  hasTextSelection,
  isEditableTarget,
  parseActivationKey,
} from "./activation.js";
import { writeClipboard } from "./clipboard.js";
import {
  buildCopyText,
  buildPayload,
  getSourceInfo,
  getStackContext as readStackContext,
} from "./context.js";
import { freezePage, isPageFrozen, unfreezePage } from "./freeze.js";
import {
  createBounds,
  createDragBounds,
  getElementAtPoint,
  getElementsInDrag,
  getHierarchy,
  isDragBeyondThreshold,
  isGrabbable,
  navigateElement,
} from "./selection.js";
import { detectAppTheme, watchAppTheme, type AppTheme } from "./theme.js";
import { relativeDisplayPath, resolveSource } from "./source.js";

export interface ControllerState {
  enabled: boolean;
  active: boolean;
  hoveredElement: Element | null;
  selectionElements: Element[];
  label: SelectionLabel;
  boxes: OverlayBounds[];
  dragBounds: OverlayBounds | null;
  dragging: boolean;
  copying: boolean;
  prompt: PromptState & { text: string };
  menu: MenuState;
  hierarchy: { visible: boolean; items: HierarchyItem[]; activeIndex: number };
  toolbar: ToolbarState;
  theme: AppTheme;
  statusMessage: string;
  errorMessage: string;
}

interface ToolbarPersistence {
  edge: ToolbarState["edge"];
  ratio: number;
  collapsed: boolean;
  enabled: boolean;
  defaultAction: ToolbarState["defaultAction"];
}

const TOOLBAR_STORAGE_KEY = "vue-grab:toolbar";

const loadToolbarState = (): ToolbarState => {
  const fallback: ToolbarState = {
    edge: "bottom",
    ratio: 0.5,
    collapsed: false,
    enabled: true,
    defaultAction: "copy",
  };
  try {
    const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ToolbarPersistence>;
    return {
      edge: parsed.edge ?? fallback.edge,
      ratio: typeof parsed.ratio === "number" ? parsed.ratio : fallback.ratio,
      collapsed: parsed.collapsed ?? fallback.collapsed,
      enabled: parsed.enabled ?? fallback.enabled,
      defaultAction: parsed.defaultAction === "comment" ? "comment" : "copy",
    };
  } catch {
    return fallback;
  }
};

const saveToolbarState = (state: ToolbarState): void => {
  try {
    localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private or sandboxed contexts.
  }
};

const isOverlayEvent = (event: Event): boolean => {
  const path = event.composedPath?.() ?? [];
  return path.some((node) => node instanceof Element && node.hasAttribute(HOST_ATTRIBUTE));
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const getSelectionLabel = (
  element: Element | null,
  source: SourceInfo | null,
  count: number,
): SelectionLabel => {
  if (!element) {
    return { visible: false, x: 0, y: 0, tagName: "", status: "idle" };
  }
  const rect = element.getBoundingClientRect();
  return {
    visible: true,
    x: clamp(rect.left, 8, window.innerWidth - 320),
    y: clamp(rect.top - 34, 8, window.innerHeight - 64),
    tagName: element.tagName.toLowerCase(),
    componentName: source?.componentName ?? undefined,
    filePath: source?.filePath ? relativeDisplayPath(source.filePath) : undefined,
    lineNumber: source?.lineNumber ?? undefined,
    status: "idle",
    count: count > 1 ? count : undefined,
  };
};

export class GrabController {
  readonly state: ControllerState;
  private options: Options;
  private host: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private overlayApp: App | null = null;
  private abortController: AbortController | null = null;
  private activationMatcher: (event: KeyboardEvent) => boolean;
  private holdTimer: number | null = null;
  private holdActive = false;
  private holdKey = "";
  private pointer = { x: 0, y: 0 };
  private dragStart: { x: number; y: number } | null = null;
  private dragEnd: { x: number; y: number } | null = null;
  private pointerDown = false;
  private lastHoverCheck = 0;
  private statusTimer: number | null = null;
  private relinkTimer: number | null = null;
  private themeCleanup: (() => void) | null = null;
  private toolbarCallbacks = new Set<(state: ToolbarState) => void>();
  private disposed = false;
  private mounted = false;

  readonly api: VueGrabAPI;

  constructor(options: Options = {}) {
    this.options = {
      activationMode: "toggle",
      keyHoldDuration: DEFAULT_KEY_HOLD_DURATION_MS,
      allowActivationInsideInput: true,
      maxContextLines: DEFAULT_MAX_CONTEXT_LINES,
      freezeUpdates: true,
      ...options,
    };
    this.activationMatcher = parseActivationKey(this.options.activationKey);
    const toolbar = loadToolbarState();
    this.state = reactive<ControllerState>({
      enabled: this.options.enabled ?? true,
      active: false,
      hoveredElement: null,
      selectionElements: [],
      label: { visible: false, x: 0, y: 0, tagName: "", status: "idle" },
      boxes: [],
      dragBounds: null,
      dragging: false,
      copying: false,
      prompt: { visible: false, x: 0, y: 0, text: "" },
      menu: { visible: false, x: 0, y: 0, hasSource: false },
      hierarchy: { visible: false, items: [], activeIndex: 0 },
      toolbar: { ...toolbar, enabled: this.options.enabled ?? toolbar.enabled },
      theme: "light",
      statusMessage: "",
      errorMessage: "",
    });

    this.api = {
      activate: () => this.activate(),
      deactivate: () => this.deactivate(),
      toggle: () => (this.state.active ? this.deactivate() : this.activate()),
      comment: () => this.openPrompt(),
      isActive: () => this.state.active,
      isEnabled: () => this.state.enabled,
      setEnabled: (enabled) => this.setEnabled(enabled),
      getToolbarState: () => ({ ...this.state.toolbar }),
      setToolbarState: (state) => this.setToolbarState(state),
      onToolbarStateChange: (callback) => {
        this.toolbarCallbacks.add(callback);
        return () => this.toolbarCallbacks.delete(callback);
      },
      reset: () => this.reset(),
      dispose: () => this.dispose(),
      copyElement: (elements) => this.copyElements(Array.isArray(elements) ? elements : [elements]),
      getSource: async (element) => getSourceInfo(element),
      getStackContext: async (element) =>
        readStackContext(element, { maxContextLines: this.options.maxContextLines }),
      getState: () => this.getState(),
      setOptions: (next) => this.setOptions(next),
      registerPlugin: () => undefined,
      unregisterPlugin: () => undefined,
      getPlugins: () => [],
      getDisplayName: (element) => resolveSource(element)?.componentName ?? null,
    };
  }

  mount(): void {
    if (this.mounted || typeof document === "undefined") return;
    this.mounted = true;
    this.abortController = new AbortController();
    this.mountOverlay();
    this.bindEvents();
    this.relinkTimer = window.setInterval(() => this.relinkLiveElements(), 250);
    this.themeCleanup = watchAppTheme((theme) => {
      this.state.theme = theme;
    });
    if (typeof window !== "undefined") {
      window.__VUE_GRAB__ = this.api;
      window.dispatchEvent(new CustomEvent(EVENT_INIT, { detail: this.api }));
    }
  }

  private mountOverlay(): void {
    const host = document.createElement("div");
    host.setAttribute(HOST_ATTRIBUTE, "");
    host.style.cssText = `position:fixed;inset:0;z-index:${Z_INDEX_OVERLAY};pointer-events:none;`;
    this.host = host;

    const mountPoint = document.createElement("div");
    mountPoint.style.cssText = "position:absolute;inset:0;pointer-events:none;";
    const shadowRoot = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const nonce =
      document.querySelector<HTMLStyleElement>("style[nonce]")?.nonce ||
      document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) style.nonce = nonce;
    style.textContent = overlayStyles;
    shadowRoot.append(style, mountPoint);
    this.shadowRoot = shadowRoot;

    const mount = () => {
      if (!document.body) {
        window.addEventListener("DOMContentLoaded", mount, { once: true });
        return;
      }
      document.body.appendChild(host);
      this.overlayApp = createApp(OverlayRoot, { controller: this });
      this.overlayApp.config.globalProperties[OVERLAY_APP_FLAG] = true;
      this.overlayApp.mount(mountPoint);
    };
    mount();
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;
    if (!signal) return;
    window.addEventListener("keydown", this.handleKeyDown, { capture: true, signal });
    window.addEventListener("keyup", this.handleKeyUp, { capture: true, signal });
    window.addEventListener("pointermove", this.handlePointerMove, { capture: true, signal, passive: true });
    window.addEventListener("pointerdown", this.handlePointerDown, { capture: true, signal });
    window.addEventListener("pointerup", this.handlePointerUp, { capture: true, signal });
    window.addEventListener("contextmenu", this.handleContextMenu, { capture: true, signal });
    window.addEventListener("blur", this.handleWindowBlur, { capture: true, signal });
    window.addEventListener("pagehide", this.handlePageHide, { capture: true, signal });
    window.addEventListener("resize", this.handleViewportChange, { capture: true, signal });
    window.addEventListener("scroll", this.handleViewportChange, { capture: true, signal, passive: true });
    document.addEventListener("visibilitychange", this.handleVisibilityChange, { capture: true, signal });
    if (import.meta.hot) {
      import.meta.hot.dispose(() => this.dispose());
    }
  }

  selectElement(element: Element): void {
    this.setHovered(element);
    this.closeHierarchy();
  }

  private setHovered(element: Element | null): void {
    if (element === this.state.hoveredElement) return;
    this.state.hoveredElement = element;
    const source = element ? resolveSource(element) : null;
    this.state.label = getSelectionLabel(element, source, this.state.selectionElements.length);
    this.state.boxes = element ? [createBounds(element)] : [];
  }

  private refreshHovered(): void {
    if (!this.state.active) return;
    const element = getElementAtPoint(this.pointer.x, this.pointer.y, {
      container: this.options.container,
    });
    this.setHovered(element);
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (isOverlayEvent(event)) return;
    this.pointer = { x: event.clientX, y: event.clientY };
    if (!this.state.active) return;
    if (this.state.prompt.visible || this.state.menu.visible) return;
    if (this.pointerDown) {
      this.dragEnd = { x: event.clientX, y: event.clientY };
      if (this.dragStart && isDragBeyondThreshold(this.dragStart, this.dragEnd)) {
        this.state.dragging = true;
        this.state.dragBounds = createDragBounds(this.dragStart, this.dragEnd);
        const edge = 28;
        if (event.clientX < edge) window.scrollBy(-12, 0);
        else if (event.clientX > window.innerWidth - edge) window.scrollBy(12, 0);
        if (event.clientY < edge) window.scrollBy(0, -12);
        else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
      }
      return;
    }
    const now = performance.now();
    if (now - this.lastHoverCheck < 16) return;
    this.lastHoverCheck = now;
    this.refreshHovered();
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.state.active || isOverlayEvent(event)) return;
    const element = getElementAtPoint(event.clientX, event.clientY, {
      container: this.options.container,
    });
    if (!element) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.setHovered(element);
    this.pointer = { x: event.clientX, y: event.clientY };

    if (event.button === 2) {
      this.openMenu(element, event.clientX, event.clientY);
      return;
    }
    if (event.button !== 0) return;
    this.pointerDown = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.dragEnd = this.dragStart;
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerDown || isOverlayEvent(event)) return;
    this.pointerDown = false;
    const start = this.dragStart;
    const end = this.dragEnd;
    this.dragStart = null;
    this.dragEnd = null;
    this.state.dragging = false;
    if (!start || !end) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (isDragBeyondThreshold(start, end)) {
      const elements = getElementsInDrag(createDragBounds(start, end), {
        container: this.options.container,
      });
      this.state.dragBounds = null;
      if (elements.length > 0) this.selectMany(elements, event.shiftKey);
      return;
    }

    const element = this.state.hoveredElement;
    if (!element) return;
    if (event.shiftKey) {
      this.toggleSelection(element);
      return;
    }
    this.state.selectionElements = [markRaw(element)];
    void this.copySelection();
  };

  private handleContextMenu = (event: MouseEvent): void => {
    if (!this.state.active || isOverlayEvent(event)) return;
    const element = getElementAtPoint(event.clientX, event.clientY, {
      container: this.options.container,
    });
    if (!element) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.setHovered(element);
    this.state.selectionElements = [markRaw(element)];
    this.openMenu(element, event.clientX, event.clientY);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.repeat) return;
    if (this.state.prompt.visible) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.closePrompt();
      }
      return;
    }

    if (this.state.active) {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        const element = this.state.hoveredElement;
        if (element) {
          event.preventDefault();
          const rect = element.getBoundingClientRect();
          this.openMenu(element, rect.left, rect.bottom);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (this.state.hierarchy.visible) this.closeHierarchy();
        else if (this.state.menu.visible) this.closeMenu();
        else this.deactivate();
        return;
      }
      if (this.state.hierarchy.visible) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const items = this.state.hierarchy.items;
          this.state.hierarchy.activeIndex = clamp(
            this.state.hierarchy.activeIndex + delta,
            0,
            Math.max(0, items.length - 1),
          );
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const item = this.state.hierarchy.items[this.state.hierarchy.activeIndex];
          if (item) this.setHovered(item.element);
          this.closeHierarchy();
          return;
        }
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const current = this.state.hoveredElement;
        if (current) {
          event.preventDefault();
          const next = navigateElement(current, event.key === "ArrowUp" ? "up" : event.key === "ArrowDown" ? "down" : event.key === "ArrowLeft" ? "left" : "right", { container: this.options.container });
          if (next) this.setHovered(next);
        }
        return;
      }
      if (event.key === "c" || event.key === "C") {
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          void this.copySelection();
          return;
        }
      }
      if (event.key === "o" || event.key === "O") {
        event.preventDefault();
        void this.openEditor();
        return;
      }
      if (event.key === "Shift") {
        this.openHierarchy();
        return;
      }
      if (event.key === "Enter" || this.activationMatcher(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void this.copySelection();
        return;
      }
    }

    if (!this.activationMatcher(event)) return;
    if (!this.state.enabled) return;
    const editable = isEditableTarget(event.target);
    if (editable && !this.options.allowActivationInsideInput) return;
    if (editable && hasTextSelection()) {
      window.setTimeout(() => this.beginActivation(event), INPUT_FOCUS_ACTIVATION_DELAY_MS);
    } else {
      this.beginActivation(event);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (this.options.activationMode !== "hold" || !this.holdActive) return;
    const isActivationKey =
      event.key === this.holdKey ||
      event.key === "Meta" ||
      event.key === "Control" ||
      event.key === "Alt" ||
      event.key === "Shift";
    if (!isActivationKey) return;
    if (this.holdTimer !== null) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.holdActive = false;
    this.deactivate();
  };

  private beginActivation(event: KeyboardEvent): void {
    if (this.state.active) return;
    if (this.options.activationMode === "hold") {
      this.holdKey = event.key;
      this.holdTimer = window.setTimeout(() => {
        this.holdTimer = null;
        if (this.holdActive) this.activate();
      }, this.options.keyHoldDuration ?? DEFAULT_KEY_HOLD_DURATION_MS);
      return;
    }
    this.activate();
  }


  toggle(): void {
    if (this.state.active) this.deactivate();
    else this.activate();
  }

  activate(): void {
    if (this.state.active || !this.state.enabled) return;
    this.state.active = true;
    this.state.statusMessage = "";
    this.state.errorMessage = "";
    this.refreshHovered();
    if (this.options.freezeUpdates !== false) {
      freezePage(this.state.hoveredElement ? [this.state.hoveredElement] : []);
    }
    this.state.label = getSelectionLabel(
      this.state.hoveredElement,
      this.state.hoveredElement ? resolveSource(this.state.hoveredElement) : null,
      1,
    );
  }

  deactivate(): void {
    if (!this.state.active && !this.state.copying) return;
    if (this.holdTimer !== null) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.holdActive = false;
    if (isPageFrozen()) unfreezePage();
    this.state.active = false;
    this.state.dragging = false;
    this.state.dragBounds = null;
    this.state.selectionElements = [];
    this.state.label.visible = false;
    this.closeMenu();
    this.closePrompt();
    this.closeHierarchy();
    this.state.statusMessage = "";
  }

  private setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    this.state.toolbar.enabled = enabled;
    this.state.toolbar.collapsed = !enabled;
    if (!enabled) this.deactivate();
    saveToolbarState(this.state.toolbar);
  }

  private selectMany(elements: Element[], extend: boolean): void {
    const merged = extend ? [...this.state.selectionElements, ...elements] : elements;
    this.state.selectionElements = Array.from(new Set(merged))
      .map((element) => markRaw(element))
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
    this.state.label = getSelectionLabel(
      this.state.hoveredElement,
      this.state.hoveredElement ? resolveSource(this.state.hoveredElement) : null,
      this.state.selectionElements.length,
    );
  }

  private toggleSelection(element: Element): void {
    const exists = this.state.selectionElements.includes(element);
    this.state.selectionElements = exists
      ? this.state.selectionElements.filter((selected) => selected !== element)
      : [...this.state.selectionElements, markRaw(element)];
    this.state.label = getSelectionLabel(element, resolveSource(element), this.state.selectionElements.length);
  }

  private getTargetElements(): Element[] {
    if (this.state.selectionElements.length > 0) return this.state.selectionElements;
    return this.state.hoveredElement ? [this.state.hoveredElement] : [];
  }

  async copySelection(prompt?: string): Promise<boolean> {
    const elements = this.getTargetElements();
    if (elements.length === 0) return false;
    return this.copyElements(elements, prompt);
  }

  async copyElements(elements: Element[], prompt?: string): Promise<boolean> {
    if (elements.length === 0) return false;
    this.state.copying = true;
    this.state.errorMessage = "";
    this.state.statusMessage = "Copying…";
    this.state.label.status = "copying";
    this.state.label.statusText = "Copying…";

    try {
      const content = this.options.getContent
        ? await this.options.getContent(elements)
        : buildCopyText(elements, { maxContextLines: this.options.maxContextLines }, prompt);
      const copied = await writeClipboard(content, {
        content,
        elements: buildPayload(elements),
        prompt,
      });
      if (!copied) throw new Error("Clipboard write was blocked");
      this.state.statusMessage = "Copied";
      this.state.label.status = "copied";
      this.state.label.statusText = "Copied";
      window.dispatchEvent(
        new CustomEvent(EVENT_SELECTED, { detail: { elements: buildPayload(elements) } }),
      );
      this.scheduleStatusClear();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Copy failed";
      this.state.errorMessage = message;
      this.state.statusMessage = message;
      this.state.label.status = "error";
      this.state.label.statusText = message;
      return false;
    } finally {
      this.state.copying = false;
    }
  }

  private scheduleStatusClear(): void {
    if (this.statusTimer !== null) window.clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      this.statusTimer = null;
      this.state.statusMessage = "";
      this.state.label.status = "idle";
      this.state.label.statusText = undefined;
    }, FEEDBACK_DURATION_MS);
  }

  private openMenu(element: Element, x: number, y: number): void {
    const source = resolveSource(element);
    this.state.menu = {
      visible: true,
      x: clamp(x, 8, window.innerWidth - 180),
      y: clamp(y, 8, window.innerHeight - 140),
      hasSource: Boolean(source?.filePath),
    };
  }

  closeMenu(): void {
    this.state.menu.visible = false;
  }

  openPrompt(): void {
    const element = this.state.hoveredElement ?? this.state.selectionElements[0] ?? null;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    this.state.prompt = {
      visible: true,
      x: clamp(rect.left, 8, window.innerWidth - 360),
      y: clamp(rect.bottom + 8, 8, window.innerHeight - 140),
      text: "",
    };
    this.closeMenu();
  }

  closePrompt(force = false): void {
    if (!force && this.state.prompt.text.trim() && !window.confirm("Discard this prompt?")) return;
    this.state.prompt.visible = false;
    this.state.prompt.text = "";
  }

  updatePromptText(value: string): void {
    this.state.prompt.text = value;
  }

  async submitPrompt(): Promise<void> {
    const text = this.state.prompt.text.trim();
    if (!text) {
      this.closePrompt();
      return;
    }
    await this.copySelection(text);
    this.closePrompt(true);
  }

  openHierarchy(): void {
    const element = this.state.hoveredElement;
    if (!element) return;
    const items = getHierarchy(element);
    this.state.hierarchy = {
      visible: true,
      items: items.map((item) => ({ ...item, element: markRaw(item.element) })),
      activeIndex: Math.max(0, items.findIndex((item) => item.element === element)),
    };
  }

  closeHierarchy(): void {
    this.state.hierarchy.visible = false;
  }

  private openEditorFor(element: Element): void {
    const source = resolveSource(element);
    if (!source?.filePath) return;
    const params = new URLSearchParams({
      file: source.filePath,
      line: String(source.lineNumber ?? 1),
      column: String(source.columnNumber ?? 1),
    });
    void fetch(`/__open-in-editor?${params.toString()}`).catch(() => {
      const fallback = `vscode://file/${source.filePath}:${source.lineNumber ?? 1}:${source.columnNumber ?? 1}`;
      window.open(fallback, "_blank", "noopener,noreferrer");
    });
    this.closeMenu();
  }

  async openEditor(): Promise<void> {
    const element = this.getTargetElements()[0];
    if (element) this.openEditorFor(element);
  }

  openSelectedEditor(): void {
    const element = this.getTargetElements()[0];
    if (element) this.openEditorFor(element);
  }

  private reset(): void {
    this.deactivate();
    this.state.selectionElements = [];
    this.state.label = { visible: false, x: 0, y: 0, tagName: "", status: "idle" };
  }

  setOptions(options: SettableOptions): void {
    this.options = { ...this.options, ...options };
    if (options.activationKey) {
      this.activationMatcher = parseActivationKey(options.activationKey);
    }
  }

  setToolbarState(partial: Partial<ToolbarState>): void {
    this.state.toolbar = {
      ...this.state.toolbar,
      ...partial,
    };
    saveToolbarState(this.state.toolbar);
    for (const callback of this.toolbarCallbacks) callback({ ...this.state.toolbar });
    if (partial.enabled !== undefined) this.setEnabled(partial.enabled);
  }

  getState(): VueGrabState {
    return {
      isActive: this.state.active,
      isDragging: this.state.dragging,
      isCopying: this.state.copying,
      isPromptMode: this.state.prompt.visible,
      isSelectionBoxVisible: this.state.boxes.length > 0,
      isDragBoxVisible: Boolean(this.state.dragBounds),
      targetElement: this.state.hoveredElement,
      selectionCount: this.state.selectionElements.length,
      dragBounds: this.state.dragBounds,
      grabbedBoxes: [],
      labelInstances: [],
      selectionFilePath: this.state.label.filePath ?? null,
      toolbarState: { ...this.state.toolbar },
    };
  }

  private handleWindowBlur = (): void => {
    if (this.options.activationMode === "hold" && this.holdActive) this.deactivate();
  };

  private handlePageHide = (): void => {
    this.dispose();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden" && this.options.activationMode === "hold") {
      this.deactivate();
    }
  };

  private handleViewportChange = (): void => {
    if (!this.state.active) return;
    const element = this.state.hoveredElement;
    if (element) {
      this.state.label = getSelectionLabel(element, resolveSource(element), this.state.selectionElements.length);
      this.state.boxes = this.state.selectionElements.length > 0
        ? this.state.selectionElements.map(createBounds)
        : [createBounds(element)];
    }
  };

  private relinkLiveElements(): void {
    if (!this.state.active) return;
    if (this.state.hoveredElement && !this.state.hoveredElement.isConnected) {
      this.refreshHovered();
    }
    const connected = this.state.selectionElements.filter((element) => element.isConnected);
    if (connected.length !== this.state.selectionElements.length) {
      this.state.selectionElements = connected;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.statusTimer !== null) window.clearTimeout(this.statusTimer);
    if (this.holdTimer !== null) window.clearTimeout(this.holdTimer);
    if (this.relinkTimer !== null) window.clearInterval(this.relinkTimer);
    this.themeCleanup?.();
    this.themeCleanup = null;
    this.abortController?.abort();
    this.abortController = null;
    this.overlayApp?.unmount();
    this.overlayApp = null;
    this.host?.remove();
    this.host = null;
    this.shadowRoot = null;
    if (window.__VUE_GRAB__ === this.api) delete window.__VUE_GRAB__;
  }
}
