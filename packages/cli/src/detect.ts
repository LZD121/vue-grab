import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detect } from "package-manager-detector/detect";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type Framework = "vite" | "nuxt" | "unknown";

export interface ProjectInfo {
  root: string;
  framework: Framework;
  packageManager: PackageManager;
  packageJsonPath: string;
  entryFile: string | null;
  viteConfig: string | null;
  nuxtConfig: string | null;
  hasVueGrab: boolean;
  hasVue: boolean;
}

const CONFIG_EXTENSIONS = ["ts", "js", "mts", "mjs", "cts", "cjs"];

const findConfig = (root: string, baseName: string): string | null => {
  for (const extension of CONFIG_EXTENSIONS) {
    const path = join(root, `${baseName}.${extension}`);
    if (existsSync(path)) return path;
  }
  return null;
};

const findEntry = (root: string): string | null => {
  const candidates = [
    "src/main.ts",
    "src/main.js",
    "src/index.ts",
    "src/index.js",
    "main.ts",
    "main.js",
  ];
  for (const candidate of candidates) {
    const path = join(root, candidate);
    if (existsSync(path)) return path;
  }
  return null;
};

const readDependencies = (packageJsonPath: string): Record<string, string> => {
  if (!existsSync(packageJsonPath)) return {};
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return { ...packageJson.dependencies, ...packageJson.devDependencies };
  } catch {
    return {};
  }
};

export const detectProject = async (root: string): Promise<ProjectInfo> => {
  const packageJsonPath = join(root, "package.json");
  const dependencies = readDependencies(packageJsonPath);
  const viteConfig = findConfig(root, "vite.config");
  const nuxtConfig = findConfig(root, "nuxt.config");
  const framework: Framework = dependencies.nuxt || nuxtConfig
    ? "nuxt"
    : dependencies.vite || viteConfig
      ? "vite"
      : "unknown";

  let packageManager: PackageManager = "npm";
  try {
    const detected = await detect({ cwd: root });
    const name = detected?.agent?.split("@")[0];
    if (name === "npm" || name === "pnpm" || name === "yarn" || name === "bun") {
      packageManager = name;
    }
  } catch {
    // Keep npm as the safe fallback.
  }

  return {
    root,
    framework,
    packageManager,
    packageJsonPath,
    entryFile: findEntry(root),
    viteConfig,
    nuxtConfig,
    hasVueGrab: Boolean(dependencies["vue-grab"]),
    hasVue: Boolean(dependencies.vue),
  };
};
