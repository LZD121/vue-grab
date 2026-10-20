import type { ActivationKey } from "../types.js";

const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt"]);

const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export const DEFAULT_ACTIVATION_KEY = (): string => (isMac() ? "Meta+C" : "Ctrl+C");

export const parseActivationKey = (
  key: ActivationKey | undefined,
): ((event: KeyboardEvent) => boolean) => {
  if (typeof key === "function") return key;
  const raw = key ?? DEFAULT_ACTIVATION_KEY();
  const parts = raw
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const expectedKey = parts[parts.length - 1] ?? "c";
  const expectedModifiers = new Set(parts.slice(0, -1));

  return (event: KeyboardEvent) => {
    if (MODIFIER_KEYS.has(event.key)) return false;
    const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const normalizedExpectedKey =
      expectedKey.length === 1 ? expectedKey.toLowerCase() : expectedKey;
    if (eventKey !== normalizedExpectedKey && event.code !== expectedKey) return false;
    if (expectedModifiers.has("Meta") !== event.metaKey) return false;
    if (expectedModifiers.has("Ctrl") !== event.ctrlKey) return false;
    if (expectedModifiers.has("Alt") !== event.altKey) return false;
    if (expectedModifiers.has("Shift") !== event.shiftKey) return false;
    return true;
  };
};

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  const element = target.closest(
    'input, textarea, select, [contenteditable="true"], [contenteditable=""]',
  );
  return Boolean(element);
};

export const hasTextSelection = (): boolean => {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed) return false;
  return Boolean(selection.toString().trim());
};
