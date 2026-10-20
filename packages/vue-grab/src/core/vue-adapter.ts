import { HOST_ATTRIBUTE, OVERLAY_APP_FLAG } from "../constants.js";
import type { VueAppLike, VueParentComponent } from "../types.js";

const isOverlayContainer = (container: Element | null | undefined): boolean =>
  Boolean(container?.closest?.(`[${HOST_ATTRIBUTE}]`));

export const isOverlayApp = (app: VueAppLike): boolean => {
  if (app.config?.globalProperties?.[OVERLAY_APP_FLAG]) return true;
  return isOverlayContainer(app._container);
};

const collectAppFromElement = (element: Element, apps: VueAppLike[], seen: Set<VueAppLike>) => {
  if (element.__vue_app__ && !seen.has(element.__vue_app__) && !isOverlayApp(element.__vue_app__)) {
    seen.add(element.__vue_app__);
    apps.push(element.__vue_app__);
  }
  if (element.shadowRoot) collectApps(element.shadowRoot, apps, seen);
};

const collectApps = (root: Document | ShadowRoot, apps: VueAppLike[], seen: Set<VueAppLike>) => {
  for (const element of root.querySelectorAll("*")) {
    collectAppFromElement(element, apps, seen);
  }
};

export const getMountedApps = (root: Document | ShadowRoot = document): VueAppLike[] => {
  const apps: VueAppLike[] = [];
  const seen = new Set<VueAppLike>();
  collectApps(root, apps, seen);
  const body = document.body;
  if (body?.__vue_app__ && !seen.has(body.__vue_app__) && !isOverlayApp(body.__vue_app__)) {
    apps.push(body.__vue_app__);
  }
  const documentElement = document.documentElement;
  if (
    documentElement.__vue_app__ &&
    !seen.has(documentElement.__vue_app__) &&
    !isOverlayApp(documentElement.__vue_app__)
  ) {
    apps.push(documentElement.__vue_app__);
  }
  return apps;
};

const collectVNodeInstances = (
  vnode: unknown,
  instances: VueParentComponent[],
  seen: Set<VueParentComponent>,
  depth = 0,
) => {
  if (!vnode || typeof vnode !== "object" || depth > 200) return;
  const record = vnode as {
    component?: VueParentComponent | null;
    children?: unknown;
    dynamicChildren?: unknown;
    suspense?: { activeBranch?: unknown; pendingBranch?: unknown };
    ssContent?: unknown;
    shapeFlag?: number;
  };

  if (record.component && !seen.has(record.component)) {
    seen.add(record.component);
    instances.push(record.component);
    collectVNodeInstances(record.component.subTree, instances, seen, depth + 1);
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      collectVNodeInstances(child, instances, seen, depth + 1);
    }
  }
  if (Array.isArray(record.dynamicChildren)) {
    for (const child of record.dynamicChildren) {
      collectVNodeInstances(child, instances, seen, depth + 1);
    }
  }
  if (record.suspense) {
    collectVNodeInstances(record.suspense.activeBranch, instances, seen, depth + 1);
    collectVNodeInstances(record.suspense.pendingBranch, instances, seen, depth + 1);
  }
};

export const collectAppInstances = (app: VueAppLike): VueParentComponent[] => {
  const instances: VueParentComponent[] = [];
  const seen = new Set<VueParentComponent>();
  const rootInstance = app._instance;
  if (!rootInstance) return instances;
  instances.push(rootInstance);
  seen.add(rootInstance);
  collectVNodeInstances(rootInstance.subTree, instances, seen);
  return instances;
};

export const getAllMountedInstances = (): VueParentComponent[] => {
  const instances: VueParentComponent[] = [];
  const seen = new Set<VueParentComponent>();
  for (const app of getMountedApps()) {
    for (const instance of collectAppInstances(app)) {
      if (!seen.has(instance)) {
        seen.add(instance);
        instances.push(instance);
      }
    }
  }
  return instances;
};
