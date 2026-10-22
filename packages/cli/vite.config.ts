import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node20",
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/cli.ts"),
      formats: ["es"],
      fileName: "cli",
    },
    rollupOptions: {
      external: [
        /^node:/,
        /^commander(\/.*)?$/,
        /^@clack\/prompts(\/.*)?$/,
        /^picocolors(\/.*)?$/,
        /^package-manager-detector(\/.*)?$/,
      ],
      output: {
        banner: "#!/usr/bin/env node",
      },
    },
  },
});
