import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { confirm, intro, isCancel, outro } from "@clack/prompts";
import { Command } from "commander";
import pc from "picocolors";
import { detectProject, type PackageManager, type ProjectInfo } from "./detect.js";
import {
  addEntryImport,
  addNuxtPlugin,
  addVitePlugin,
  createManagedModule,
  createNuxtPlugin,
  DEFAULT_OPTIONS,
  getModulePath,
  getNuxtPluginPath,
  updateManagedModule,
  type FileChange,
  type VueGrabOptions,
} from "./transform.js";

const VERSION = "0.1.1";

interface InitOptions {
  cwd: string;
  yes?: boolean;
  force?: boolean;
  allowInput?: boolean;
  mode?: "toggle" | "hold";
  hold?: string;
  contextLines?: string;
  skipInstall?: boolean;
  dryRun?: boolean;
}

interface ConfigureOptions {
  cwd: string;
  key?: string;
  mode?: "toggle" | "hold";
  hold?: string;
  contextLines?: string;
  allowInput?: boolean;
  dryRun?: boolean;
}

const toOptions = (flags: {
  key?: string;
  mode?: "toggle" | "hold";
  hold?: string;
  contextLines?: string;
  allowInput?: boolean;
}): VueGrabOptions => ({
  ...DEFAULT_OPTIONS,
  activationKey: flags.key ?? DEFAULT_OPTIONS.activationKey,
  activationMode: flags.mode ?? DEFAULT_OPTIONS.activationMode,
  keyHoldDuration: flags.hold ? Number(flags.hold) : DEFAULT_OPTIONS.keyHoldDuration,
  allowActivationInsideInput: flags.allowInput ?? DEFAULT_OPTIONS.allowActivationInsideInput,
  maxContextLines: flags.contextLines
    ? Number(flags.contextLines)
    : DEFAULT_OPTIONS.maxContextLines,
});

const installCommand = (packageManager: PackageManager): [string, string[]] => {
  if (packageManager === "pnpm") return ["pnpm", ["add", "-D", "vue-grab"]];
  if (packageManager === "yarn") return ["yarn", ["add", "-D", "vue-grab"]];
  if (packageManager === "bun") return ["bun", ["add", "-d", "vue-grab"]];
  return ["npm", ["install", "-D", "vue-grab"]];
};

const installPackage = (packageManager: PackageManager, cwd: string): void => {
  const [command, args] = installCommand(packageManager);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    throw new Error(`Package installation failed (${command} ${args.join(" ")}).`);
  }
};

const printDiff = (change: FileChange): void => {
  if (change.before === change.after) {
    console.log(pc.dim(`  unchanged ${relative(process.cwd(), change.path)}`));
    return;
  }
  console.log(pc.cyan(`  update ${relative(process.cwd(), change.path)}`));
};

const writeChanges = (changes: FileChange[]): void => {
  for (const change of changes) {
    if (change.before === change.after) continue;
    mkdirSync(dirname(change.path), { recursive: true });
    writeFileSync(change.path, change.after);
  }
};

const planVite = (project: ProjectInfo, options: VueGrabOptions): FileChange[] => {
  const changes: FileChange[] = [];
  if (!project.entryFile) throw new Error("Could not find a Vite entry file (src/main.ts).");
  if (!project.viteConfig) throw new Error("Could not find vite.config.ts.");
  const modulePath = getModulePath(project.root);
  const moduleBefore = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";
  changes.push({
    path: modulePath,
    before: moduleBefore,
    after: moduleBefore
      ? updateManagedModule(moduleBefore, options)
      : createManagedModule(options),
  });
  changes.push(addEntryImport(project.entryFile, modulePath));
  changes.push(addVitePlugin(project.viteConfig));
  return changes;
};

const planNuxt = (project: ProjectInfo, options: VueGrabOptions): FileChange[] => {
  if (!project.nuxtConfig) throw new Error("Could not find nuxt.config.ts.");
  const pluginPath = getNuxtPluginPath(project.root);
  const before = existsSync(pluginPath) ? readFileSync(pluginPath, "utf8") : "";
  return [
    {
      path: pluginPath,
      before,
      after: before ? updateManagedModule(before, options) : createNuxtPlugin(options),
    },
    addNuxtPlugin(project.nuxtConfig),
  ];
};

const confirmWrite = async (options: InitOptions, changes: FileChange[]): Promise<boolean> => {
  if (options.dryRun) return false;
  if (options.yes || !process.stdin.isTTY) return true;
  for (const change of changes) printDiff(change);
  const answer = await confirm({
    message: "Apply these Vue Grab changes?",
    initialValue: true,
  });
  if (isCancel(answer)) return false;
  return Boolean(answer);
};

const runInit = async (options: InitOptions): Promise<void> => {
  const cwd = options.cwd;
  intro(`${pc.magenta("◆")} ${pc.bold("Vue Grab")} ${pc.dim(VERSION)}`);
  const project = await detectProject(cwd);
  if (!project.hasVue) throw new Error("This project does not depend on Vue.");
  if (project.framework === "unknown") {
    throw new Error("Could not detect Vite or Nuxt. Install Vue Grab manually.");
  }
  if (project.hasVueGrab && !options.force && !options.dryRun) {
    console.log(pc.yellow("Vue Grab is already installed. Re-run with --force to update wiring."));
  }

  const vueGrabOptions = toOptions(options);
  const changes =
    project.framework === "nuxt" ? planNuxt(project, vueGrabOptions) : planVite(project, vueGrabOptions);

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          framework: project.framework,
          packageManager: project.packageManager,
          changes: changes.map((change) => ({
            path: relative(cwd, change.path),
            changed: change.before !== change.after,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const shouldWrite = await confirmWrite(options, changes);
  if (!shouldWrite) {
    outro("No changes made.");
    return;
  }

  if (!project.hasVueGrab && !options.skipInstall) {
    console.log(pc.dim(`Installing vue-grab with ${project.packageManager}…`));
    installPackage(project.packageManager, project.root);
  }

  writeChanges(changes);
  outro(
    project.framework === "nuxt"
      ? "Vue Grab wired into Nuxt. Start your dev server and press Meta+C / Ctrl+C."
      : "Vue Grab wired into Vite. Start your dev server and press Meta+C / Ctrl+C.",
  );
};

const findOptionsFile = (project: ProjectInfo): string | null => {
  const candidates =
    project.framework === "nuxt"
      ? [getNuxtPluginPath(project.root), getModulePath(project.root)]
      : [getModulePath(project.root)];
  return candidates.find((path) => existsSync(path)) ?? null;
};

const runConfigure = async (options: ConfigureOptions): Promise<void> => {
  const project = await detectProject(options.cwd);
  const file = findOptionsFile(project);
  if (!file) throw new Error("Vue Grab is not configured. Run `vue-grab init` first.");
  const before = readFileSync(file, "utf8");
  const after = updateManagedModule(before, toOptions(options));
  if (before === after) {
    console.log(pc.dim("No option changes needed."));
    return;
  }
  if (options.dryRun) {
    console.log(JSON.stringify({ path: relative(options.cwd, file), changed: true }, null, 2));
    return;
  }
  writeFileSync(file, after);
  console.log(pc.green(`Updated ${relative(options.cwd, file)}.`));
};

const program = new Command()
  .name("vue-grab")
  .description("Install and configure Vue Grab")
  .version(VERSION, "-v, --version");

program
  .command("init")
  .description("install Vue Grab and wire it into Vite or Nuxt")
  .option("-c, --cwd <path>", "working directory", process.cwd())
  .option("-y, --yes", "skip confirmation prompts", false)
  .option("-f, --force", "re-apply wiring even when installed", false)
  .option("-k, --key <key>", "activation key, e.g. Meta+K")
  .option("-m, --mode <mode>", "activation mode: toggle or hold")
  .option("--hold <ms>", "hold duration in milliseconds")
  .option("--context-lines <count>", "maximum component context lines")
  .option("--no-allow-input", "disable activation inside inputs")
  .option("--skip-install", "skip package installation", false)
  .option("--dry-run", "print the plan without writing", false)
  .action(async (options: InitOptions) => {
    try {
      await runInit(options);
    } catch (error) {
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  });

program
  .command("configure")
  .description("update Vue Grab options in the managed block")
  .option("-c, --cwd <path>", "working directory", process.cwd())
  .option("-k, --key <key>", "activation key, e.g. Meta+K")
  .option("-m, --mode <mode>", "activation mode: toggle or hold")
  .option("--hold <ms>", "hold duration in milliseconds")
  .option("--context-lines <count>", "maximum component context lines")
  .option("--no-allow-input", "disable activation inside inputs")
  .option("--dry-run", "print the plan without writing", false)
  .action(async (options: ConfigureOptions) => {
    try {
      await runConfigure(options);
    } catch (error) {
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  });

program.parseAsync().catch((error) => {
  console.error(pc.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});

export { runInit, runConfigure };
