import {
  IGNORE_ATTRIBUTE,
  MAX_PREVIEW_ATTR_COUNT,
  MAX_PREVIEW_ATTR_LENGTH,
  MAX_PREVIEW_TEXT_LENGTH,
  MAX_SELECTOR_DEPTH,
} from "../constants.js";

const PRIORITY_ATTRIBUTES = [
  "id",
  "class",
  "aria-label",
  "data-testid",
  "role",
  "name",
  "type",
  "href",
  "src",
  "placeholder",
  "title",
  "disabled",
  "checked",
  "required",
  "readonly",
] as const;

const INTERNAL_ATTRIBUTE_PREFIXES = ["data-vue-grab-", "data-v-", "data-vue-"];

export const escapeHtmlText = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const escapeHtmlAttribute = (value: string): string =>
  escapeHtmlText(value).replace(/"/g, "&quot;");

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value;

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const isInternalAttribute = (name: string): boolean =>
  INTERNAL_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix)) || name === "style";

const formatAttributes = (element: Element): string => {
  const parts: string[] = [];
  for (const name of PRIORITY_ATTRIBUTES) {
    if (parts.length >= MAX_PREVIEW_ATTR_COUNT) break;
    const value = element.getAttribute(name);
    if (value === null) continue;
    if (name === "class") {
      const classes = value
        .split(/\s+/)
        .filter((className) => !className.startsWith("data-v-"))
        .join(" ");
      if (classes) parts.push(`class="${escapeHtmlAttribute(truncate(classes, 80))}"`);
      continue;
    }
    if (value === "") {
      parts.push(name);
      continue;
    }
    parts.push(`${name}="${escapeHtmlAttribute(truncate(value, MAX_PREVIEW_ATTR_LENGTH))}"`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

const getTextPreview = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "script" || tagName === "style" || tagName === "template") return "";
  const text = collapseWhitespace(element.textContent ?? "");
  if (!text) return "";
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    const value = element.getAttribute("value") ?? element.getAttribute("placeholder") ?? "";
    return truncate(value, MAX_PREVIEW_TEXT_LENGTH);
  }
  return truncate(text, MAX_PREVIEW_TEXT_LENGTH);
};

export const getInlineElementPreview = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();
  const attributes = formatAttributes(element);
  const text = getTextPreview(element);
  if (!text) return `<${tagName}${attributes} />`;
  return `<${tagName}${attributes}>${escapeHtmlText(text)}</${tagName}>`;
};

const getChildPlaceholders = (element: Element): string => {
  const children = Array.from(element.children).slice(0, 2);
  if (children.length === 0) return "";
  const placeholders = children.map((child) => {
    const tagName = child.tagName.toLowerCase();
    return `<${tagName} ...>`;
  });
  return `\n  ${placeholders.join("\n  ")}`;
};

export const getElementPreview = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();
  const attributes = formatAttributes(element);
  const text = getTextPreview(element);
  const childPlaceholders = text ? "" : getChildPlaceholders(element);
  if (!text && !childPlaceholders) return `<${tagName}${attributes} />`;
  return `<${tagName}${attributes}>${childPlaceholders}${
    text ? `\n  ${escapeHtmlText(text)}` : ""
  }\n</${tagName}>`;
};

const getStableAttributeSelector = (element: Element): string | null => {
  const id = element.getAttribute("id");
  if (id) return `#${CSS.escape(id)}`;
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`;
  return null;
};

export const createElementSelector = (element: Element): string | null => {
  const stable = getStableAttributeSelector(element);
  if (stable) return stable;

  const segments: string[] = [];
  let current: Element | null = element;
  let depth = 0;
  while (current && current !== document.body && depth < MAX_SELECTOR_DEPTH) {
    if (current.hasAttribute("data-vue-grab-host") || current.hasAttribute(IGNORE_ATTRIBUTE)) {
      return null;
    }
    const tagName = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (!parent) {
      segments.unshift(tagName);
      break;
    }
    const siblings = Array.from(parent.children).filter(
      (sibling) => sibling.tagName === current?.tagName,
    );
    const index = siblings.indexOf(current) + 1;
    segments.unshift(`${tagName}:nth-of-type(${index})`);
    current = parent;
    depth += 1;
  }
  return segments.length > 0 ? segments.join(" > ") : null;
};

export const getElementText = (element: Element): string =>
  collapseWhitespace(element.textContent ?? "").slice(0, 200);
