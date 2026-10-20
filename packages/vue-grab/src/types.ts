export type ActivationMode = "toggle" | "hold";

export type ActivationKey = string | ((event: KeyboardEvent) => boolean);

export interface Options {
  enabled?: boolean;
  /** Confine hit-testing and the overlay to this element. */
  container?: HTMLElement;
  activationKey?: ActivationKey;
  activationMode?: ActivationMode;
  keyHoldDuration?: number;
  allowActivationInsideInput?: boolean;
  maxContextLines?: number;
  freezeUpdates?: boolean;
  getContent?: (elements: Element[]) => string | Promise<string>;
}

export type SettableOptions = Omit<Options, "enabled" | "container">;

export interface SourceInfo {
  filePath: string;
  lineNumber: number | null;
  columnNumber: number | null;
  componentName: string | null;
}

export interface SourceLocation extends SourceInfo {
  origin: "app" | "package" | "unknown";
}

export interface ElementContext {
  element: Element;
  snippet: string;
  componentName: string | null;
  filePath: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  selector: string | null;
}

export interface OverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: string;
}

export interface SelectionLabel {
  visible: boolean;
  x: number;
  y: number;
  tagName: string;
  componentName?: string;
  filePath?: string;
  lineNumber?: number;
  status: "idle" | "copying" | "copied" | "error";
  statusText?: string;
  count?: number;
}

export interface ToolbarState {
  edge: "top" | "bottom" | "left" | "right";
  ratio: number;
  collapsed: boolean;
  enabled: boolean;
  defaultAction: "copy" | "comment";
}

export interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  hasSource: boolean;
}

export interface PromptState {
  visible: boolean;
  x: number;
  y: number;
}

export interface VueGrabState {
  isActive: boolean;
  isDragging: boolean;
  isCopying: boolean;
  isPromptMode: boolean;
  isSelectionBoxVisible: boolean;
  isDragBoxVisible: boolean;
  targetElement: Element | null;
  selectionCount: number;
  dragBounds: OverlayBounds | null;
  grabbedBoxes: Array<{ id: string; bounds: OverlayBounds; createdAt: number }>;
  labelInstances: Array<{ id: string; status: string; tagName: string; componentName?: string; createdAt: number }>;
  selectionFilePath: string | null;
  toolbarState: ToolbarState | null;
}

export interface SelectedElementPayload {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  componentName?: string;
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface ElementSelectedEventDetail {
  elements: SelectedElementPayload[];
}

export interface HierarchyItem {
  element: Element;
  depth: number;
  label: string;
}

export interface VueGrabAPI {
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  comment: () => void;
  isActive: () => boolean;
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  getToolbarState: () => ToolbarState | null;
  setToolbarState: (state: Partial<ToolbarState>) => void;
  onToolbarStateChange: (callback: (state: ToolbarState) => void) => () => void;
  reset: () => void;
  dispose: () => void;
  copyElement: (elements: Element | Element[]) => Promise<boolean>;
  getSource: (element: Element) => Promise<SourceInfo | null>;
  getStackContext: (element: Element) => Promise<string>;
  getState: () => VueGrabState;
  setOptions: (options: SettableOptions) => void;
  registerPlugin: (plugin: unknown) => void;
  unregisterPlugin: (name: string) => void;
  getPlugins: () => string[];
  getDisplayName: (element: Element) => string | null;
}

export interface VueParentComponent {
  uid?: number;
  parent?: VueParentComponent | null;
  type?: {
    name?: string;
    __name?: string;
    __file?: string;
    displayName?: string;
    __vueGrabOverlay?: boolean;
  };
  vnode?: {
    el?: Element | Text | null;
    key?: string | number | null;
    type?: unknown;
  };
  subTree?: {
    el?: Element | Text | null;
    component?: VueParentComponent | null;
    children?: unknown;
    dynamicChildren?: unknown;
  } | null;
  scope?: {
    pause?: () => void;
    resume?: () => void;
  };
}

export interface VueAppLike {
  _instance?: VueParentComponent | null;
  _container?: Element | null;
  config?: {
    globalProperties?: Record<string, unknown>;
  };
}

declare global {
  interface Element {
    __vueParentComponent?: VueParentComponent;
    __vnode?: {
      key?: string | number | null;
      el?: Element | Text | null;
    };
    __vue_app__?: VueAppLike;
  }

  interface Window {
    __VUE_GRAB__?: VueGrabAPI;
    __VUE_GRAB_DISABLED__?: boolean;
  }

  interface WindowEventMap {
    "vue-grab:init": CustomEvent<VueGrabAPI>;
    "vue-grab:element-selected": CustomEvent<ElementSelectedEventDetail>;
  }
}
