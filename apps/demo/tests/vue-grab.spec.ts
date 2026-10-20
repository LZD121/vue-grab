import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__VUE_GRAB__));
});

test("activates, hovers, and copies exact source context", async ({ page }) => {
  const button = page.locator("button.button").first();
  await page.evaluate(() => window.__VUE_GRAB__?.activate());
  await button.hover();
  await expect(page.locator("[data-vue-grab-host]").locator(".vg-label")).toContainText("button");
  await page.keyboard.press("c");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("in App (at /src/App.vue:");
  expect(clipboard).toContain('<button class="button">');
});

test("shift-click selects multiple elements", async ({ page }) => {
  await page.evaluate(() => window.__VUE_GRAB__?.activate());
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll(".counter .button")).slice(0, 2);
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const options = {
        bubbles: true,
        cancelable: true,
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        button: 0,
        buttons: 1,
        shiftKey: true,
        pointerId: 1,
        pointerType: "mouse",
      };
      window.dispatchEvent(new PointerEvent("pointerdown", options));
      window.dispatchEvent(new PointerEvent("pointerup", { ...options, buttons: 0 }));
    }
  });
  expect(await page.evaluate(() => window.__VUE_GRAB__?.getState().selectionCount)).toBe(2);
  await page.keyboard.press("c");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.match(/in CounterCard/g)?.length).toBeGreaterThanOrEqual(2);
});

test("freezes reactive updates until deactivation", async ({ page }) => {
  const counter = page.locator(".counter-value");
  await page.waitForTimeout(900);
  const before = await counter.textContent();
  await page.evaluate(() => window.__VUE_GRAB__?.activate());
  await page.waitForTimeout(1600);
  expect(await counter.textContent()).toBe(before);
  await page.evaluate(() => window.__VUE_GRAB__?.deactivate());
  await page.waitForTimeout(900);
  expect(await counter.textContent()).not.toBe(before);
});
