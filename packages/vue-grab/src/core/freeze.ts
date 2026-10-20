import {
  FREEZE_STYLE_ATTRIBUTE,
  HOST_ATTRIBUTE,
  PINNED_STYLE_PROPERTIES,
} from "../constants.js";
import type { VueParentComponent } from "../types.js";
import { getAllMountedInstances } from "./vue-adapter.js";

interface PausedScope {
  scope: NonNullable<VueParentComponent["scope"]>;
  wasPaused: boolean;
}

interface PinnedStyle {
  element: HTMLElement | SVGElement;
  property: string;
  value: string;
  priority: string;
}

interface FreezeSession {
  scopes: PausedScope[];
  animations: Animation[];
  svgElements: SVGSVGElement[];
  pinnedStyles: PinnedStyle[];
  styleElement: HTMLStyleElement | null;
  restoreRaf: (() => void) | null;
  isFrozen: boolean;
}

let session: FreezeSession | null = null;

const isInsideOverlay = (element: Element): boolean => {
  let current: Element | null = element;
  while (current) {
    if (current.hasAttribute(HOST_ATTRIBUTE)) return true;
    const root = current.getRootNode();
    current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return false;
};

const isScopePaused = (scope: NonNullable<VueParentComponent["scope"]>): boolean => {
  if (!("_isPaused" in scope)) return false;
  return scope._isPaused === true;
};

const freezeScopes = (): PausedScope[] => {
  const paused: PausedScope[] = [];
  for (const instance of getAllMountedInstances()) {
    const scope = instance.scope;
    if (!scope?.pause) continue;
    const wasPaused = isScopePaused(scope);
    if (!wasPaused) {
      scope.pause();
      paused.push({ scope, wasPaused });
    }
  }
  return paused;
};

const freezeAnimations = (): Animation[] => {
  if (typeof document.getAnimations !== "function") return [];
  const paused: Animation[] = [];
  for (const animation of document.getAnimations()) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    if (target instanceof Element && isInsideOverlay(target)) continue;
    try {
      animation.pause();
      paused.push(animation);
    } catch {
      // Ignore animations the browser cannot pause.
    }
  }
  return paused;
};

const freezeSvg = (): SVGSVGElement[] => {
  const elements = Array.from(document.querySelectorAll("svg")) as SVGSVGElement[];
  for (const svg of elements) {
    if (isInsideOverlay(svg)) continue;
    try {
      svg.pauseAnimations();
    } catch {
      // Older engines may not implement SMIL controls.
    }
  }
  return elements;
};

const pinPseudoStyles = (elements: Element[]): PinnedStyle[] => {
  const pinned: PinnedStyle[] = [];
  const seen = new Set<Element>();

  const pinElement = (element: Element | null) => {
    if (!element || seen.has(element) || element === document.documentElement) return;
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) return;
    seen.add(element);
    const computed = getComputedStyle(element);
    for (const property of PINNED_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (!value) continue;
      const existingPriority = element.style.getPropertyPriority(property);
      const existingValue = element.style.getPropertyValue(property);
      pinned.push({
        element,
        property,
        value: existingValue,
        priority: existingPriority,
      });
      element.style.setProperty(property, value, "important");
    }
  };

  for (const element of elements) {
    let current: Element | null = element;
    while (current) {
      pinElement(current);
      current = current.parentElement;
    }
    for (const descendant of Array.from(element.querySelectorAll("*")).slice(0, 200)) {
      pinElement(descendant);
    }
  }
  return pinned;
};

const freezeAnimationFrames = (): (() => void) => {
  const nativeRequest = window.requestAnimationFrame.bind(window);
  const pending: FrameRequestCallback[] = [];
  const frozenRequest = (callback: FrameRequestCallback): number => {
    pending.push(callback);
    return 0;
  };
  window.requestAnimationFrame = frozenRequest;

  return () => {
    window.requestAnimationFrame = nativeRequest;
    for (const callback of pending) nativeRequest(callback);
  };
};

const createStyleElement = (): HTMLStyleElement => {
  const style = document.createElement("style");
  style.setAttribute(FREEZE_STYLE_ATTRIBUTE, "");
  const nonce =
    document.querySelector<HTMLStyleElement>("style[nonce]")?.nonce ||
    document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
  if (nonce) style.nonce = nonce;
  style.textContent = `
    html, body, body * {
      animation-play-state: paused !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  `;
  document.head.appendChild(style);
  return style;
};

export const freezePage = (elements: Element[] = []): void => {
  if (session?.isFrozen) return;
  const scopes = freezeScopes();
  const animations = freezeAnimations();
  const svgElements = freezeSvg();
  const pinnedStyles = pinPseudoStyles(elements);
  const styleElement = createStyleElement();
  const restoreRaf = freezeAnimationFrames();
  session = {
    scopes,
    animations,
    svgElements,
    pinnedStyles,
    styleElement,
    restoreRaf,
    isFrozen: true,
  };
};

export const unfreezePage = (): void => {
  if (!session) return;
  const current = session;
  session = null;

  for (const { scope, wasPaused } of current.scopes) {
    if (!wasPaused) {
      try {
        scope.resume?.();
      } catch {
        // Continue restoring the remaining scopes.
      }
    }
  }
  for (const animation of current.animations) {
    try {
      animation.finish();
    } catch {
      // Ignore animations that cannot finish.
    }
  }
  for (const svg of current.svgElements) {
    try {
      svg.unpauseAnimations();
    } catch {
      // Ignore unsupported SMIL controls.
    }
  }
  for (const { element, property, value, priority } of current.pinnedStyles.reverse()) {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  }
  current.styleElement?.remove();
  current.restoreRaf?.();
};

export const isPageFrozen = (): boolean => Boolean(session?.isFrozen);
