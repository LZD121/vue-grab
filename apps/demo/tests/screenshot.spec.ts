import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const readClipboardImage = (page: Page) =>
  page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (!item.types.includes("image/png")) continue;
      const blob = await item.getType("image/png");
      const bitmap = await createImageBitmap(blob);
      return { width: bitmap.width, height: bitmap.height, size: blob.size };
    }
    return null;
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__VUE_GRAB__));
});

test("toolbar copies a screenshot of the hovered element", async ({ page }) => {
  await page.evaluate(() => window.__VUE_GRAB__?.activate());
  const target = page.locator(".counter");
  await target.hover();
  const bounds = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  await page
    .locator(
      "[data-vue-grab-host] .vg-toolbar-action[aria-label='Copy screenshot to clipboard']",
    )
    .click();
  await expect(page.locator("[data-vue-grab-host] .vg-label-status")).toHaveText(
    "Screenshot copied",
  );

  const image = await readClipboardImage(page);
  expect(image).not.toBeNull();
  expect(Math.abs((image?.width ?? 0) - bounds.width)).toBeLessThanOrEqual(2);
  expect(Math.abs((image?.height ?? 0) - bounds.height)).toBeLessThanOrEqual(2);
});

test("toolbar copies the viewport when nothing is hovered", async ({ page }) => {
  const viewport = page.viewportSize();
  await page.evaluate(() => window.__VUE_GRAB__?.activate());
  await page.locator(".counter").hover();
  await page.evaluate(() => window.__VUE_GRAB__?.deactivate());
  await page
    .locator(
      "[data-vue-grab-host] .vg-toolbar-action[aria-label='Copy screenshot to clipboard']",
    )
    .click();
  await expect(page.locator("[data-vue-grab-host] .vg-toast")).toHaveText(
    "Screenshot copied",
  );

  const image = await readClipboardImage(page);
  expect(image?.width).toBe(viewport?.width);
  expect(image?.height).toBe(viewport?.height);
});
