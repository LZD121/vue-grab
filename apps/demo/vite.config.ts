import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { vueGrab } from "../../packages/vue-grab/src/vite";

export default defineConfig({
  plugins: [vueGrab(), vue()],
  resolve: {
    alias: {
      "vue-grab": resolve(import.meta.dirname, "../../packages/vue-grab/src/index.ts"),
      "vue-grab/vite": resolve(import.meta.dirname, "../../packages/vue-grab/src/vite.ts"),
      "vue-grab/compiler": resolve(import.meta.dirname, "../../packages/vue-grab/src/compiler.ts"),
    },
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
