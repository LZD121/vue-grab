import { DRAG_THRESHOLD_PX, HOST_ATTRIBUTE, IGNORE_ATTRIBUTE } from "../constants.js";
import type { HierarchyItem, OverlayBounds } from "../types.js";
import { getComponentName, getComponentRootElement } from "./source.js";

export interface HitTestOptions {
  container?: HTMLElement;
}

const getComposedParent = (element: Element): Element | null => {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
};

const isInsideOverlay = (element: Element): boolean => {
  let current: Element | null = element;
  while (current) {
    if (current.hasAttribute(HOST_ATTRIBUTE)) return true;
    current = getComposedParent(current);
  }
  return false;
};

const isIgnored = (element: Element): boolean => {
  let current: Element | null = element;
  while (current) {
    if (current.hasAttribute(IGNORE_ATTRIBUTE)) return true;
    current = getComposedParent(current);
  }
  return false;
};

export const isGrabbable = (element: Element, options: HitTestOptions = {}): boolean => {
  if (element === document.documentElement || element === document.body) return false;
  if (isInsideOverlay(element) || isIgnored(element)) return false;
  if (options.container && !options.container.contains(element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;
  if (style.pointerEvents === "none" && element !== document.body) {
    const hasContent = Boolean(element.textContent?.trim() || element.children.length);
    if (!hasContent) return false;
  }
  return true;
};

export const getElementAtPoint = (
  clientX: number,
  clientY: number,
  options: HitTestOptions = {},
): Element | null => {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const element of elements) {
    if (isGrabbable(element, options)) return element;
  }
  return null;
};

export const getElementsInDrag = (
  bounds: { x: number; y: number; width: number; height: number },
  options: HitTestOptions = {},
): Element[] => {
  const samples = 5;
  const found = new Set<Element>();
  for (let row = 0; row < samples; row += 1) {
    for (let column = 0; column < samples; column += 1) {
      const x = bounds.x + (bounds.width * (column + 1)) / (samples + 1);
      const y = bounds.y + (bounds.height * (row + 1)) / (samples + 1);
      const element = getElementAtPoint(x, y, options);
      if (element) found.add(element);
    }
  }
  const sorted = Array.from(found).sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
  return sorted.filter(
    (element) =>
      !sorted.some((other) => other !== element && other.contains(element)),
  );
};

export const createBounds = (element: Element): OverlayBounds => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    borderRadius: style.borderRadius || "0px",
  };
};

export const createDragBounds = (
  start: { x: number; y: number },
  end: { x: number; y: number },
): OverlayBounds => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
  borderRadius: "0px",
});

export const isDragBeyondThreshold = (
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean =>
  Math.abs(start.x - end.x) > DRAG_THRESHOLD_PX ||
  Math.abs(start.y - end.y) > DRAG_THRESHOLD_PX;

export const getHierarchy = (element: Element): HierarchyItem[] => {
  const items: HierarchyItem[] = [];
  const ancestors: Element[] = [];
  let current = getComposedParent(element);
  while (current && current !== document.body && ancestors.length < 6) {
    if (isGrabbable(current)) ancestors.push(current);
    current = getComposedParent(current);
  }
  ancestors.reverse().forEach((ancestor, depth) => {
    items.push({
      element: ancestor,
      depth,
      label: getHierarchyLabel(ancestor),
    });
  });
  const selectedDepth = ancestors.length;
  items.push({
    element,
    depth: selectedDepth,
    label: getHierarchyLabel(element),
  });
  for (const child of Array.from(element.children).slice(0, 6)) {
    if (isGrabbable(child)) {
      items.push({
        element: child,
        depth: selectedDepth + 1,
        label: getHierarchyLabel(child),
      });
    }
  }
  return items;
};

export const getHierarchyLabel = (element: Element): string => {
  const componentName = getComponentName(element.__vueParentComponent ?? null);
  const tagName = element.tagName.toLowerCase();
  return componentName ? `${tagName} · ${componentName}` : tagName;
};

export const navigateElement = (
  element: Element,
  direction: "up" | "down" | "left" | "right",
  options: HitTestOptions = {},
): Element | null => {
  if (direction === "up") {
    let current = getComposedParent(element);
    while (current && current !== document.body) {
      if (isGrabbable(current, options)) return current;
      current = getComposedParent(current);
    }
    return null;
  }

  if (direction === "down") {
    for (const child of Array.from(element.children)) {
      if (isGrabbable(child, options)) return child;
    }
    return null;
  }

  const siblings = Array.from(element.parentElement?.children ?? []).filter(
    (sibling) => sibling !== element && isGrabbable(sibling, options),
  );
  if (siblings.length === 0) return null;
  const currentIndex = Array.from(element.parentElement?.children ?? []).indexOf(element);
  const candidates =
    direction === "right"
      ? siblings.filter((sibling) => Array.from(sibling.parentElement?.children ?? []).indexOf(sibling) > currentIndex)
      : siblings
          .filter((sibling) => Array.from(sibling.parentElement?.children ?? []).indexOf(sibling) < currentIndex)
          .reverse();
  return candidates[0] ?? null;
};
