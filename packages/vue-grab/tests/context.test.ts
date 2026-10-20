// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { buildCopyText } from "../src/core/context.js";
import { normalizeFilePath, parseLocation } from "../src/core/source.js";
import type { VueParentComponent } from "../src/types.js";

const createInstance = (
  name: string,
  file: string,
  parent: VueParentComponent | null = null,
): VueParentComponent => ({
  type: { name, __file: file },
  parent,
  subTree: null,
});

describe("source normalization", () => {
  it("normalizes query strings, Windows separators, and Vite /@fs paths", () => {
    expect(normalizeFilePath("/@fs/project/src/App.vue?vue&type=template")).toBe(
      "/project/src/App.vue",
    );
    expect(normalizeFilePath("C:\\project\\src\\App.vue")).toBe("C:/project/src/App.vue");
  });

  it("parses greedy file paths with line and column", () => {
    expect(parseLocation("/src/App.vue:12:5")).toEqual({
      filePath: "/src/App.vue",
      lineNumber: 12,
      columnNumber: 5,
    });
  });
});

describe("buildCopyText", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("uses the upstream grammar with component ancestry and exact location", () => {
    const root = document.createElement("div");
    root.setAttribute("data-vue-grab-loc", "/src/App.vue:3:1");
    const button = document.createElement("button");
    button.setAttribute("data-vue-grab-loc", "/src/components/SaveButton.vue:12:5");
    button.className = "btn";
    button.textContent = "Save";
    const appInstance = createInstance("App", "/src/App.vue");
    appInstance.subTree = { el: root };
    const saveInstance = createInstance("SaveButton", "/src/components/SaveButton.vue", appInstance);
    Object.defineProperty(button, "__vueParentComponent", {
      configurable: true,
      value: saveInstance,
    });

    const text = buildCopyText([button]);
    expect(text).toBe(
      '[<button class="btn">Save</button> in SaveButton (at /src/components/SaveButton.vue:12:5)]\n  in App (at /src/App.vue:3:1)',
    );
  });

  it("degrades to a selector when no Vue source is available", () => {
    const button = document.createElement("button");
    button.id = "save";
    button.textContent = "Save";
    document.body.appendChild(button);
    const text = buildCopyText([button]);
    expect(text).toContain('<button id="save">Save</button>');
    expect(text).toContain("selector: #save");
  });

  it("strips internal attributes from the preview", () => {
    const button = document.createElement("button");
    button.setAttribute("data-v-abc123", "");
    button.setAttribute("data-vue-grab-loc", "/src/App.vue:1:1");
    button.textContent = "Save";
    document.body.appendChild(button);
    const text = buildCopyText([button]);
    expect(text).not.toContain("data-v-abc123");
    expect(text).not.toContain("data-vue-grab-loc");
  });
});
