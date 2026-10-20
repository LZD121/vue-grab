import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/demo/tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5175",
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "pnpm --filter @vue-grab/demo dev",
    url: "http://localhost:5175",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
