import { describe, expect, it } from "vitest";
import { transformVueGrabSFC } from "../src/compiler.js";

const SFC = `<script setup lang="ts">
const items = [1, 2]
</script>

<template>
  <div class="app">
    <button v-for="item in items" :key="item" class="btn">Item {{ item }}</button>
    <MyWidget />
  </div>
</template>
`;

describe("transformVueGrabSFC", () => {
  it("injects exact 1-based template positions on native elements only", () => {
    const result = transformVueGrabSFC(SFC, "/project/src/App.vue", { root: "/project" });
    expect(result).not.toBeNull();
    expect(result?.code).toContain('data-vue-grab-loc="/src/App.vue:6:3"');
    expect(result?.code).toContain('data-vue-grab-loc="/src/App.vue:7:5"');
    expect(result?.code).not.toContain("MyWidget data-vue-grab-loc");
  });

  it("does not inject twice", () => {
    const first = transformVueGrabSFC(SFC, "/project/src/App.vue", { root: "/project" });
    expect(first).not.toBeNull();
    const second = transformVueGrabSFC(first?.code ?? "", "/project/src/App.vue", {
      root: "/project",
    });
    expect(second).toBeNull();
  });

  it("skips pug templates", () => {
    const pug = `<template lang="pug">\ndiv hello\n</template>\n`;
    expect(transformVueGrabSFC(pug, "/project/src/App.vue", { root: "/project" })).toBeNull();
  });

  it("skips files that are not Vue SFCs", () => {
    expect(transformVueGrabSFC("export default {}", "/project/src/app.ts")).toBeNull();
  });
});
