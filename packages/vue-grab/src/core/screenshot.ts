import { domToCanvas, type Options } from "modern-screenshot";
import {
  HOST_ATTRIBUTE,
  MAX_SCREENSHOT_DIMENSION,
  MAX_SCREENSHOT_SCALE,
} from "../constants.js";

interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const captureOptions = {
  maximumCanvasSize: MAX_SCREENSHOT_DIMENSION,
  backgroundColor: null,
  filter: (node: Node) =>
    !(node instanceof Element && node.hasAttribute(HOST_ATTRIBUTE)),
} satisfies Options;

const getCaptureScale = (): number =>
  Math.min(MAX_SCREENSHOT_SCALE, Math.max(1, window.devicePixelRatio || 1));

const toPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Screenshot encoding failed"));
    }, "image/png");
  });

const getUnionRect = (elements: Element[]): ViewportRect | null => {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { left, top, width: right - left, height: bottom - top };
};

const cropCanvas = (source: HTMLCanvasElement, rect: ViewportRect): HTMLCanvasElement => {
  const cssWidth = Number.parseFloat(source.style.width) || source.width;
  const ratio = source.width / cssWidth;
  const left = Math.max(0, Math.min(source.width - 1, Math.round(rect.left * ratio)));
  const top = Math.max(0, Math.min(source.height - 1, Math.round(rect.top * ratio)));
  const right = Math.max(
    left + 1,
    Math.min(source.width, Math.round((rect.left + rect.width) * ratio)),
  );
  const bottom = Math.max(
    top + 1,
    Math.min(source.height, Math.round((rect.top + rect.height) * ratio)),
  );
  const width = right - left;
  const height = bottom - top;

  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const context = target.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(source, left, top, width, height, 0, 0, width, height);
  return target;
};

/**
 * Captures the visible viewport. The root clone is nudged by the scroll offset
 * instead of restoring scroll positions, so fixed-position elements stay at
 * their on-screen location.
 */
const captureViewport = (scale: number): Promise<HTMLCanvasElement> =>
  domToCanvas(document.documentElement, {
    ...captureOptions,
    scale,
    width: window.innerWidth,
    height: window.innerHeight,
    style: {
      position: "relative",
      top: `${-window.scrollY}px`,
      left: `${-window.scrollX}px`,
    },
    features: { copyScrollbar: false },
  });

const captureElement = async (element: Element, scale: number): Promise<HTMLCanvasElement> => {
  if (element.getClientRects().length === 0) {
    throw new Error("Selected element is not visible");
  }
  return domToCanvas(element, {
    ...captureOptions,
    scale,
    features: { copyScrollbar: false, restoreScrollPosition: true },
  });
};

/**
 * Rasterizes the current grab target as PNG. A single element is captured on
 * its own; multiple elements are cropped out of the viewport; no target falls
 * back to the full viewport.
 */
export const captureScreenshotBlob = async (elements: Element[]): Promise<Blob> => {
  const scale = getCaptureScale();
  const [first, ...rest] = elements;

  if (first && rest.length === 0) {
    return toPngBlob(await captureElement(first, scale));
  }

  const viewport = await captureViewport(scale);
  if (elements.length > 1) {
    const bounds = getUnionRect(elements);
    if (bounds) return toPngBlob(cropCanvas(viewport, bounds));
  }
  return toPngBlob(viewport);
};
