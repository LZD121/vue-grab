// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { freezePage, isPageFrozen, unfreezePage } from "../src/core/freeze.js";
import type { VueAppLike, VueParentComponent } from "../src/types.js";

const createScope = () => ({
  paused: false,
  _isPaused: false,
  resumes: 0,
  pause() {
    this.paused = true;
    this._isPaused = true;
  },
  resume() {
    this.paused = false;
    this._isPaused = false;
    this.resumes += 1;
  },
});

const createInstance = (scope: ReturnType<typeof createScope>): VueParentComponent => ({
  scope,
  type: { name: "CounterCard", __file: "/src/CounterCard.vue" },
  subTree: null,
  parent: null,
});

describe("freeze session", () => {
  afterEach(() => {
    unfreezePage();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("pauses and resumes every mounted component scope", () => {
    const scope = createScope();
    const instance = createInstance(scope);
    const appScope = createScope();
    const appInstance = createInstance(appScope);
    appInstance.subTree = { component: instance };
    const app: VueAppLike = { _instance: appInstance };
    const container = document.createElement("div");
    Object.defineProperty(container, "__vue_app__", { configurable: true, value: app });
    container.appendChild(document.createElement("span"));
    document.body.appendChild(container);

    freezePage();
    expect(scope.paused).toBe(true);
    expect(appScope.paused).toBe(true);
    expect(isPageFrozen()).toBe(true);

    unfreezePage();
    expect(scope.paused).toBe(false);
    expect(scope.resumes).toBe(1);
    expect(isPageFrozen()).toBe(false);
  });

  it("does not resume a scope that was already paused", () => {
    const scope = createScope();
    scope.paused = true;
    scope._isPaused = true;
    const instance = createInstance(scope);
    const app: VueAppLike = { _instance: instance };
    const container = document.createElement("div");
    Object.defineProperty(container, "__vue_app__", { configurable: true, value: app });
    container.appendChild(document.createElement("span"));
    document.body.appendChild(container);

    freezePage();
    unfreezePage();
    expect(scope.paused).toBe(true);
    expect(scope.resumes).toBe(0);
  });
});
