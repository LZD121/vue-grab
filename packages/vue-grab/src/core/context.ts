import { DEFAULT_MAX_CONTEXT_LINES, LOC_ATTRIBUTE } from "../constants.js";
import {
  createElementSelector,
  getElementPreview,
  getInlineElementPreview,
  getElementText,
} from "./preview.js";
import {
  formatSourceLocation,
  getComponentChain,
  getElementLocation,
  getVNodeKey,
  normalizeFilePath,
  resolveSource,
} from "./source.js";
import type {
  ElementContext,
  SelectedElementPayload,
  SourceInfo,
  VueParentComponent,
} from "../types.js";

export interface BuildContextOptions {
  maxContextLines?: number;
  inline?: boolean;
}

const formatFrame = (
  componentName: string,
  filePath: string | null,
  lineNumber: number | null,
  columnNumber: number | null,
): string => {
  if (!filePath) return `\n  in ${componentName}`;
  const normalized = normalizeFilePath(filePath);
  const location =
    lineNumber === null
      ? normalized
      : `${normalized}:${lineNumber}${columnNumber ? `:${columnNumber}` : ""}`;
  return `\n  in ${componentName} (at ${location})`;
};

export const buildElementContext = (
  element: Element,
  options: BuildContextOptions = {},
): ElementContext => {
  const source = resolveSource(element);
  const chain = getComponentChain(element);
  const preview = options.inline
    ? getInlineElementPreview(element)
    : getElementPreview(element);
  const selector = createElementSelector(element);
  const key = getVNodeKey(element);
  const maxLines = Math.max(0, options.maxContextLines ?? DEFAULT_MAX_CONTEXT_LINES);

  const leadingSource =
    formatSourceLocation(source) ??
    (chain[0] ? formatFrame(chain[0].componentName, chain[0].filePath, chain[0].lineNumber, chain[0].columnNumber).trim() : null);
  const firstLine = leadingSource
    ? `[${preview} ${leadingSource}]`
    : `[${preview}]`;

  const lines = [firstLine];
  const extraFrames = chain.slice(1, 1 + maxLines);
  for (const frame of extraFrames) {
    lines.push(
      formatFrame(
        frame.componentName,
        frame.filePath,
        frame.lineNumber,
        frame.columnNumber,
      ),
    );
  }

  if (key !== null) lines.push(`\n  key: ${key}`);
  if (!source && selector) lines.push(`\n  selector: ${selector}`);

  return {
    element,
    snippet: lines.join(""),
    componentName: source?.componentName ?? chain[0]?.componentName ?? null,
    filePath: source?.filePath || null,
    lineNumber: source?.lineNumber ?? null,
    columnNumber: source?.columnNumber ?? null,
    selector,
  };
};

export const buildCopyText = (
  elements: Element[],
  options: BuildContextOptions = {},
  prompt?: string,
): string => {
  const uniqueElements = Array.from(new Set(elements));
  const contexts = uniqueElements.map(
    (element) => buildElementContext(element, { ...options, inline: true }).snippet,
  );
  const body = contexts.join("\n");
  return prompt ? `${prompt}\n${body}` : body;
};

export const buildPayload = (elements: Element[]): SelectedElementPayload[] =>
  elements.map((element) => {
    const source = resolveSource(element);
    const location = getElementLocation(element);
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className ? String(element.className) : undefined,
      textContent: getElementText(element),
      componentName: source?.componentName ?? undefined,
      filePath: source?.filePath || undefined,
      lineNumber: location?.lineNumber ?? source?.lineNumber ?? undefined,
      columnNumber: location?.columnNumber ?? source?.columnNumber ?? undefined,
    };
  });

export const getStackContext = (
  element: Element,
  options: BuildContextOptions = {},
): string => {
  const chain = getComponentChain(element);
  const maxLines = Math.max(0, options.maxContextLines ?? DEFAULT_MAX_CONTEXT_LINES);
  return chain
    .slice(0, maxLines)
    .map((frame) =>
      formatFrame(
        frame.componentName,
        frame.filePath,
        frame.lineNumber,
        frame.columnNumber,
      ).trim(),
    )
    .join("\n");
};

export const getSourceInfo = (element: Element): SourceInfo | null => {
  const source = resolveSource(element);
  if (!source) return null;
  return {
    filePath: source.filePath,
    lineNumber: source.lineNumber,
    columnNumber: source.columnNumber,
    componentName: source.componentName,
  };
};

export const getElementLocAttribute = (element: Element): string | null =>
  element.getAttribute(LOC_ATTRIBUTE);

export const readVueInstance = (element: Element): VueParentComponent | null => {
  let current: Element | null = element;
  while (current) {
    if (current.__vueParentComponent) return current.__vueParentComponent;
    const root = current.getRootNode();
    current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return null;
};
