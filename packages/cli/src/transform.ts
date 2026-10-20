import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export interface VueGrabOptions {
  activationKey: string;
  activationMode: "toggle" | "hold";
  keyHoldDuration: number;
  allowActivationInsideInput: boolean;
  maxContextLines: number;
}

export const DEFAULT_OPTIONS: VueGrabOptions = {
  activationKey: "Meta+C",
  activationMode: "toggle",
  keyHoldDuration: 100,
  allowActivationInsideInput: true,
  maxContextLines: 3,
};

export interface FileChange {
  path: string;
  before: string;
  after: string;
}

const MODULE_START = "// vue-grab:start";
const MODULE_END = "// vue-grab:end";

const formatOptions = (options: VueGrabOptions): string =>
  [
    `  activationKey: ${JSON.stringify(options.activationKey)},`,
    `  activationMode: ${JSON.stringify(options.activationMode)},`,
    `  keyHoldDuration: ${options.keyHoldDuration},`,
    `  allowActivationInsideInput: ${options.allowActivationInsideInput},`,
    `  maxContextLines: ${options.maxContextLines},`,
  ].join("\n");

export const createManagedModule = (options: VueGrabOptions): string =>
  [
    MODULE_START,
    "if (import.meta.env.DEV) {",
    '  void import("vue-grab").then(({ init }) => {',
    "    init({",
    formatOptions(options),
    "    });",
    "  });",
    "}",
    MODULE_END,
    "",
  ].join("\n");

export const createNuxtPlugin = (options: VueGrabOptions): string =>
  [
    MODULE_START,
    "export default defineNuxtPlugin(() => {",
    "  if (import.meta.dev) {",
    '    void import("vue-grab").then(({ init }) => {',
    "      init({",
    formatOptions(options),
    "      });",
    "    });",
    "  }",
    "});",
    MODULE_END,
    "",
  ].join("\n");

export const updateManagedModule = (source: string, options: VueGrabOptions): string => {
  const start = source.indexOf(MODULE_START);
  const end = source.indexOf(MODULE_END);
  if (start === -1 || end === -1) return createManagedModule(options);
  const trailing = source.slice(end + MODULE_END.length).replace(/^\n/, "");
  return `${source.slice(0, start)}${createManagedModule(options)}${trailing}`;
};

const insertImport = (source: string, importLine: string, marker: string): string => {
  if (source.includes(marker)) return source;
  const lines = source.split("\n");
  const lastImport = lines.reduce(
    (last, line, index) => (line.startsWith("import ") ? index : last),
    -1,
  );
  lines.splice(lastImport + 1, 0, importLine);
  return lines.join("\n");
};

export const addEntryImport = (entryFile: string, modulePath: string): FileChange => {
  const before = readFileSync(entryFile, "utf8");
  const relativePath = relative(dirname(entryFile), modulePath)
    .replace(/\\/g, "/")
    .replace(/\.(?:ts|js|mts|mjs|cts|cjs)$/, "");
  const specifier = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  const after = insertImport(before, `import "${specifier}";`, `"${specifier}"`);
  return { path: entryFile, before, after };
};

export const addVitePlugin = (configPath: string): FileChange => {
  const before = readFileSync(configPath, "utf8");
  if (before.includes("vue-grab/vite")) return { path: configPath, before, after: before };
  let after = insertImport(before, 'import { vueGrab } from "vue-grab/vite";', "vue-grab/vite");
  if (/plugins\s*:\s*\[/.test(after)) {
    after = after.replace(/plugins\s*:\s*\[/, "plugins: [vueGrab(), ");
  } else if (/defineConfig\s*\(\s*\{/.test(after)) {
    after = after.replace(/defineConfig\s*\(\s*\{/, "defineConfig({\n  plugins: [vueGrab()],");
  }
  return { path: configPath, before, after };
};

export const addNuxtPlugin = (configPath: string): FileChange => {
  const before = readFileSync(configPath, "utf8");
  if (before.includes("vue-grab/vite")) return { path: configPath, before, after: before };
  let after = insertImport(before, 'import { vueGrab } from "vue-grab/vite";', "vue-grab/vite");
  if (/vite\s*:\s*\{/.test(after)) {
    after = after.replace(/vite\s*:\s*\{/, "vite: {\n    plugins: [vueGrab()],");
  } else if (/defineNuxtConfig\s*\(\s*\{/.test(after)) {
    after = after.replace(
      /defineNuxtConfig\s*\(\s*\{/,
      "defineNuxtConfig({\n  vite: { plugins: [vueGrab()] },",
    );
  }
  return { path: configPath, before, after };
};

export const getModulePath = (root: string): string => join(root, "src", "vue-grab.ts");

export const getNuxtPluginPath = (root: string): string =>
  join(root, "plugins", "vue-grab.client.ts");

export const exists = (path: string): boolean => existsSync(path);
