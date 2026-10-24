import { MIME_TYPE, VERSION } from "../constants.js";
import { escapeHtmlText } from "./preview.js";
import type { SelectedElementPayload } from "../types.js";

interface ClipboardMetadata {
  content: string;
  elements: SelectedElementPayload[];
  prompt?: string;
}

const writeSynchronously = (content: string, metadata: ClipboardMetadata): boolean => {
  if (typeof document.execCommand !== "function") return false;

  const handler = (event: ClipboardEvent) => {
    event.preventDefault();
    event.clipboardData?.setData("text/plain", content);
    event.clipboardData?.setData(
      "text/html",
      `<meta charset="utf-8"><pre><code>${escapeHtmlText(content)}</code></pre>`,
    );
    event.clipboardData?.setData(
      MIME_TYPE,
      JSON.stringify({
        version: VERSION,
        content,
        elements: metadata.elements,
        prompt: metadata.prompt,
        timestamp: Date.now(),
      }),
    );
  };

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.setAttribute("aria-hidden", "true");
  document.addEventListener("copy", handler);
  try {
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand("copy");
  } finally {
    document.removeEventListener("copy", handler);
    textarea.remove();
  }
};

export const writeImageClipboard = async (blob: Blob): Promise<boolean> => {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
};

export const writeClipboard = async (
  content: string,
  metadata: ClipboardMetadata,
): Promise<boolean> => {
  try {
    if (writeSynchronously(content, metadata)) return true;
  } catch {
    // Fall through to the async Clipboard API.
  }

  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
};
