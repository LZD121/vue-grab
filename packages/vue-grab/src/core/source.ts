import { BUILTIN_COMPONENT_NAMES, LOC_ATTRIBUTE } from "../constants.js";
import type { SourceInfo, VueParentComponent } from "../types.js";

export interface ParsedLocation {
  filePath: string;
  lineNumber: number;
  columnNumber: number;
}

const basename = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
};

const stripQuery = (filePath: string): string => filePath.replace(/[?#].*$/, "");

export const normalizeFilePath = (filePath: string): string => {
  let normalized = stripQuery(filePath.trim());
  if (normalized.startsWith("file://")) normalized = normalized.slice("file://".length);
  normalized = normalized.replace(/\\/g, "/");
  normalized = normalized.replace(/^\/@fs\//, "/");
  normalized = normalized.replace(/\/{2,}/g, "/");
  normalized = normalized.replace(/\/\.\//g, "/");
  if (normalized.startsWith("./")) normalized = normalized.slice(1);
  return normalized;
};

export const relativeDisplayPath = (filePath: string): string => {
  const normalized = normalizeFilePath(filePath);
  const marker = normalized.indexOf("/src/");
  if (marker > 0) return normalized.slice(marker);
  const appMarker = normalized.indexOf("/app/");
  if (appMarker > 0) return normalized.slice(appMarker);
  const pagesMarker = normalized.indexOf("/pages/");
  if (pagesMarker > 0) return normalized.slice(pagesMarker);
  return normalized;
};

export const parseLocation = (value: string | null | undefined): ParsedLocation | null => {
  if (!value) return null;
  const match = value.match(/^(.*):(\d+):(\d+)$/);
  if (!match) return null;
  const [, filePath, line, column] = match;
  if (!filePath || !line || !column) return null;
  return {
    filePath: normalizeFilePath(filePath),
    lineNumber: Number(line),
    columnNumber: Number(column),
  };
};

export const getElementLocation = (element: Element | null): ParsedLocation | null => {
  let current: Element | null = element;
  while (current) {
    const parsed = parseLocation(current.getAttribute(LOC_ATTRIBUTE));
    if (parsed) return parsed;
    const root = current.getRootNode();
    current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return null;
};

export const getComponentName = (instance: VueParentComponent | null | undefined): string | null => {
  const type = instance?.type;
  if (!type) return null;
  const candidate =
    type.displayName ?? type.name ?? type.__name ?? (type.__file ? basename(type.__file) : null);
  if (!candidate) return null;
  if (BUILTIN_COMPONENT_NAMES[candidate] === true) return null;
  return candidate;
};

export const getComponentFile = (
  instance: VueParentComponent | null | undefined,
): string | null => {
  const file = instance?.type?.__file;
  return file ? normalizeFilePath(file) : null;
};

export const isOverlayInstance = (instance: VueParentComponent | null | undefined): boolean =>
  Boolean(instance?.type?.__vueGrabOverlay);

export const getComponentRootElement = (
  instance: VueParentComponent | null | undefined,
): Element | null => {
  const vnode = instance?.subTree ?? instance?.vnode;
  if (!vnode) return null;
  if (vnode.el instanceof Element) return vnode.el;
  if ("children" in vnode && Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      const element = getVNodeElement(child);
      if (element) return element;
    }
  }
  return null;
};

export const getVNodeElement = (vnode: unknown): Element | null => {
  if (!vnode || typeof vnode !== "object") return null;
  const record = vnode as { el?: Element | Text | null; children?: unknown };
  if (record.el instanceof Element) return record.el;
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      const element = getVNodeElement(child);
      if (element) return element;
    }
  }
  return null;
};

export interface ComponentFrame {
  componentName: string;
  filePath: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

export const getComponentChain = (element: Element): ComponentFrame[] => {
  let current: Element | null = element;
  let instance: VueParentComponent | null = null;
  while (current) {
    if (current.__vueParentComponent) {
      instance = current.__vueParentComponent;
      break;
    }
    const root = current.getRootNode();
    current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }

  const frames: ComponentFrame[] = [];
  const seen = new Set<string>();
  let cursor = instance;
  while (cursor) {
    const componentName = getComponentName(cursor);
    if (componentName && !isOverlayInstance(cursor)) {
      const rootElement = getComponentRootElement(cursor);
      const location = parseLocation(rootElement?.getAttribute(LOC_ATTRIBUTE) ?? null);
      const filePath = location?.filePath ?? getComponentFile(cursor);
      const key = `${componentName}:${filePath ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        frames.push({
          componentName,
          filePath,
          lineNumber: location?.lineNumber ?? null,
          columnNumber: location?.columnNumber ?? null,
        });
      }
    }
    cursor = cursor.parent ?? null;
  }
  return frames;
};

export const resolveSource = (element: Element): SourceInfo | null => {
  const location = getElementLocation(element);
  const chain = getComponentChain(element);
  const nearest = chain[0] ?? null;
  const componentName = nearest?.componentName ?? null;
  if (location) {
    return {
      filePath: location.filePath,
      lineNumber: location.lineNumber,
      columnNumber: location.columnNumber,
      componentName,
    };
  }
  if (nearest?.filePath) {
    return {
      filePath: nearest.filePath,
      lineNumber: null,
      columnNumber: null,
      componentName,
    };
  }
  return componentName
    ? { filePath: "", lineNumber: null, columnNumber: null, componentName }
    : null;
};

export const formatSourceLocation = (source: SourceInfo | null): string | null => {
  if (!source) return null;
  if (!source.filePath) return source.componentName ? `in ${source.componentName}` : null;
  const displayPath = relativeDisplayPath(source.filePath);
  const location =
    source.lineNumber === null
      ? displayPath
      : `${displayPath}:${source.lineNumber}${source.columnNumber ? `:${source.columnNumber}` : ""}`;
  return source.componentName
    ? `in ${source.componentName} (at ${location})`
    : `in ${location}`;
};

export const getVNodeKey = (element: Element): string | null => {
  const key = element.__vnode?.key;
  if (typeof key === "string" || typeof key === "number") return String(key);
  return null;
};
