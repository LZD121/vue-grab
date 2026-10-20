import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2022",
    sourcemap: true,
    minify: false,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        vite: resolve(import.meta.dirname, "src/vite.ts"),
        compiler: resolve(import.meta.dirname, "src/compiler.ts"),
        constants: resolve(import.meta.dirname, "src/constants.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["vue", "@vue/compiler-sfc", "magic-string", /^node:/],
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
