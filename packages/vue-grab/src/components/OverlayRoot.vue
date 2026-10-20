<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { GrabController } from "../core/controller.js";
import type { HierarchyItem } from "../types.js";

const props = defineProps<{ controller: GrabController }>();
const state = props.controller.state;

const isComposing = ref(false);
const toolbarRef = ref<HTMLElement | null>(null);
const toolbarDragging = ref(false);
let toolbarDragStart = { x: 0, y: 0 };

const toolbarStyle = computed(() => {
  const { edge, ratio } = state.toolbar;
  if (edge === "left") return { left: "12px", top: `${ratio * 100}%`, transform: "translateY(-50%)" };
  if (edge === "right") return { right: "12px", top: `${ratio * 100}%`, transform: "translateY(-50%)" };
  if (edge === "top") return { top: "12px", left: `${ratio * 100}%`, transform: "translateX(-50%)" };
  return { bottom: "12px", left: `${ratio * 100}%`, transform: "translateX(-50%)" };
});

const boxes = computed(() =>
  state.selectionElements.length > 0
    ? state.selectionElements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: getComputedStyle(element).borderRadius,
        };
      })
    : state.boxes,
);

const statusText = computed(
  () => state.label.statusText || state.statusMessage || state.errorMessage,
);

const selectHierarchyItem = (item: HierarchyItem) => {
  props.controller.selectElement(item.element);
};

const submitPrompt = () => {
  if (isComposing.value) return;
  void props.controller.submitPrompt();
};

const handlePromptKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.preventDefault();
    props.controller.closePrompt();
    return;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitPrompt();
  }
};

const startToolbarDrag = (event: PointerEvent) => {
  if (!(event.target instanceof Element) || event.target.closest("button")) return;
  toolbarDragging.value = true;
  toolbarDragStart = { x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
};

const moveToolbar = (event: PointerEvent) => {
  if (!toolbarDragging.value) return;
  const distanceLeft = event.clientX;
  const distanceRight = window.innerWidth - event.clientX;
  const distanceTop = event.clientY;
  const distanceBottom = window.innerHeight - event.clientY;
  const nearest = Math.min(distanceLeft, distanceRight, distanceTop, distanceBottom);
  if (nearest === distanceLeft) {
    props.controller.setToolbarState({
      edge: "left",
      ratio: event.clientY / window.innerHeight,
    });
  } else if (nearest === distanceRight) {
    props.controller.setToolbarState({
      edge: "right",
      ratio: event.clientY / window.innerHeight,
    });
  } else if (nearest === distanceTop) {
    props.controller.setToolbarState({
      edge: "top",
      ratio: event.clientX / window.innerWidth,
    });
  } else {
    props.controller.setToolbarState({
      edge: "bottom",
      ratio: event.clientX / window.innerWidth,
    });
  }
};

const endToolbarDrag = (event: PointerEvent) => {
  toolbarDragging.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
};

const toggleCollapsed = () => {
  props.controller.setToolbarState({ collapsed: !state.toolbar.collapsed });
};

const setDefaultAction = (action: "copy" | "comment") => {
  props.controller.setToolbarState({ defaultAction: action });
};

onBeforeUnmount(() => {
  toolbarDragging.value = false;
});
</script>

<template>
  <div class="vg-root" :data-theme="state.theme">
    <div
      v-for="(box, index) in boxes"
      :key="`box-${index}`"
      class="vg-selection"
      :style="{
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        borderRadius: box.borderRadius,
      }"
    />

    <div
      v-if="state.dragBounds"
      class="vg-drag"
      :style="{
        left: `${state.dragBounds.x}px`,
        top: `${state.dragBounds.y}px`,
        width: `${state.dragBounds.width}px`,
        height: `${state.dragBounds.height}px`,
      }"
    />

    <div
      v-if="state.label.visible"
      class="vg-label"
      :style="{ left: `${state.label.x}px`, top: `${state.label.y}px` }"
    >
      <span class="vg-label-tag">{{ state.label.tagName }}</span>
      <span v-if="state.label.componentName" class="vg-label-component">
        {{ state.label.componentName }}
      </span>
      <span v-if="state.label.filePath" class="vg-label-file">
        {{ state.label.filePath }}<template v-if="state.label.lineNumber">:{{ state.label.lineNumber }}</template>
      </span>
      <span v-if="state.label.count" class="vg-label-count">+{{ state.label.count - 1 }}</span>
      <span v-if="statusText" class="vg-label-status" :data-status="state.label.status">
        {{ statusText }}
      </span>
    </div>

    <div
      v-if="state.hierarchy.visible"
      class="vg-hierarchy"
      :style="{ left: `${state.label.x}px`, top: `${state.label.y + 30}px` }"
    >
      <div
        v-for="(item, index) in state.hierarchy.items"
        :key="`hierarchy-${index}`"
        class="vg-hierarchy-item"
        :class="{ 'is-active': index === state.hierarchy.activeIndex }"
        :style="{ paddingLeft: `${8 + item.depth * 12}px` }"
        @pointerdown.prevent="selectHierarchyItem(item)"
      >
        {{ item.label }}
      </div>
    </div>

    <div
      v-if="state.menu.visible"
      class="vg-menu"
      :style="{ left: `${state.menu.x}px`, top: `${state.menu.y}px` }"
    >
      <button type="button" @click="controller.copySelection()">Copy</button>
      <button type="button" @click="controller.openPrompt()">Comment</button>
      <button type="button" :disabled="!state.menu.hasSource" @click="controller.openSelectedEditor()">
        Open
      </button>
    </div>

    <div
      v-if="state.prompt.visible"
      class="vg-prompt"
      :style="{ left: `${state.prompt.x}px`, top: `${state.prompt.y}px` }"
    >
      <textarea
        :value="state.prompt.text"
        placeholder="Tell the agent what to change…"
        rows="3"
        @input="controller.updatePromptText(($event.target as HTMLTextAreaElement).value)"
        @keydown="handlePromptKeydown"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
      />
      <div class="vg-prompt-actions">
        <button type="button" @click="submitPrompt">Copy</button>
        <button type="button" class="is-secondary" @click="controller.closePrompt()">Cancel</button>
      </div>
    </div>

    <div
      v-if="state.toolbar.enabled"
      ref="toolbarRef"
      class="vg-toolbar"
      :class="`is-${state.toolbar.edge}`"
      :style="toolbarStyle"
      @pointerdown="startToolbarDrag"
      @pointermove="moveToolbar"
      @pointerup="endToolbarDrag"
      @pointercancel="endToolbarDrag"
    >
      <button type="button" class="vg-toolbar-grab" @click="controller.toggle()">
        {{ state.active ? "◉" : "◎" }}
      </button>
      <template v-if="!state.toolbar.collapsed">
        <button type="button" @click="setDefaultAction('copy'); controller.copySelection()">
          Copy
        </button>
        <button type="button" @click="setDefaultAction('comment'); controller.openPrompt()">
          Comment
        </button>
        <button type="button" class="vg-toolbar-collapse" @click="toggleCollapsed">–</button>
      </template>
      <button v-else type="button" class="vg-toolbar-collapse" @click="toggleCollapsed">+</button>
    </div>
  </div>
</template>
