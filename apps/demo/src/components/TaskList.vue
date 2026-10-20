<script setup lang="ts">
import { ref } from "vue";

const tasks = ref([
  { id: 1, label: "Copy a component reference", done: true },
  { id: 2, label: "Paste it into the agent", done: false },
  { id: 3, label: "Ship the port", done: false },
]);

const toggle = (id: number) => {
  const task = tasks.value.find((item) => item.id === id);
  if (task) task.done = !task.done;
};
</script>

<template>
  <article class="card is-wide">
    <h2>Keyed list</h2>
    <p>Each row is a separate DOM element even though one component renders them all.</p>
    <ul class="list">
      <li v-for="task in tasks" :key="task.id">
        <span>{{ task.label }}</span>
        <button class="button is-secondary" @click="toggle(task.id)">
          {{ task.done ? "Done" : "Todo" }}
        </button>
      </li>
    </ul>
  </article>
</template>
