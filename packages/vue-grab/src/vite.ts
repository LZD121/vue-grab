import type { Plugin } from "vite";
import { transformVueGrabSFC, type VueGrabCompilerOptions } from "./compiler.js";

export interface VueGrabViteOptions extends VueGrabCompilerOptions {
  /** Disable the plugin without removing it from the Vite config. */
  enabled?: boolean;
}

export const vueGrab = (options: VueGrabViteOptions = {}): Plugin => {
  let root = options.root ?? process.cwd();

  return {
    name: "vue-grab",
    apply: "serve",
    enforce: "pre",
    configResolved(config) {
      root = options.root ?? config.root;
    },
    transform(code, id) {
      if (options.enabled === false) return null;
      if (!id.endsWith(".vue")) return null;
      if (id.includes("?") && !id.includes("?vue&type=template")) return null;
      const filename = id.split("?")[0] ?? id;
      const result = transformVueGrabSFC(code, filename, { ...options, root });
      if (!result) return null;
      return { code: result.code, map: result.map };
    },
  };
};

export default vueGrab;
