export type AppTheme = "light" | "dark";

const parseColor = (value: string): [number, number, number, number] | null => {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match?.[1]) return null;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
};

const relativeLuminance = ([red, green, blue]: [number, number, number, number]): number => {
  const convert = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * convert(red) + 0.7152 * convert(green) + 0.0722 * convert(blue);
};

export const detectAppTheme = (): AppTheme => {
  if (typeof window === "undefined") return "light";
  const body = document.body;
  if (!body) return "light";
  const bodyColor = parseColor(getComputedStyle(body).backgroundColor);
  if (bodyColor && bodyColor[3] > 0.1) {
    return relativeLuminance(bodyColor) < 0.18 ? "dark" : "light";
  }
  const htmlColor = parseColor(getComputedStyle(document.documentElement).backgroundColor);
  if (htmlColor && htmlColor[3] > 0.1) {
    return relativeLuminance(htmlColor) < 0.18 ? "dark" : "light";
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const watchAppTheme = (callback: (theme: AppTheme) => void): (() => void) => {
  callback(detectAppTheme());
  const observer = new MutationObserver(() => callback(detectAppTheme()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
  }
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onChange = () => callback(detectAppTheme());
  media?.addEventListener?.("change", onChange);
  return () => {
    observer.disconnect();
    media?.removeEventListener?.("change", onChange);
  };
};
