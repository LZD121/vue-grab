import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addEntryImport,
  addVitePlugin,
  createManagedModule,
  updateManagedModule,
  DEFAULT_OPTIONS,
} from "../src/transform.js";

const roots: string[] = [];

const createFixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), "vue-grab-cli-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("CLI transforms", () => {
  it("creates and updates a managed options module", () => {
    const first = createManagedModule(DEFAULT_OPTIONS);
    expect(first).toContain("// vue-grab:start");
    expect(first).toContain('activationKey: "Meta+C"');
    expect(first).toContain("maxContextLines: 3");

    const updated = updateManagedModule(first, {
      ...DEFAULT_OPTIONS,
      activationKey: "Meta+K",
      activationMode: "hold",
      maxContextLines: 6,
    });
    expect(updated).toContain('activationKey: "Meta+K"');
    expect(updated).toContain('activationMode: "hold"');
    expect(updated).toContain("maxContextLines: 6");
    expect(updated.match(/vue-grab:start/g)).toHaveLength(1);
  });

  it("adds one entry import without an extension", () => {
    const root = createFixture();
    mkdirSync(join(root, "src"), { recursive: true });
    const entry = join(root, "src", "main.ts");
    const modulePath = join(root, "src", "vue-grab.ts");
    writeFileSync(entry, 'import { createApp } from "vue";\n');
    const change = addEntryImport(entry, modulePath);
    expect(change.after).toContain('import "./vue-grab";');
    expect(change.after.match(/vue-grab/g)).toHaveLength(1);
    expect(readFileSync(entry, "utf8")).toBe(change.before);
  });

  it("inserts the Vite plugin once", () => {
    const root = createFixture();
    const config = join(root, "vite.config.ts");
    writeFileSync(
      config,
      'import { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [],\n});\n',
    );
    const first = addVitePlugin(config);
    expect(first.after).toContain('import { vueGrab } from "vue-grab/vite";');
    expect(first.after).toContain("plugins: [vueGrab(), ");
    expect(first.after.match(/vueGrab\(\)/g)).toHaveLength(1);
  });
});
