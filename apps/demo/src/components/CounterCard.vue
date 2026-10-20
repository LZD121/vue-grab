<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const count = ref(0);
let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => {
    count.value += 1;
  }, 700);
});

onUnmounted(() => {
  if (timer !== undefined) window.clearInterval(timer);
});
</script>

<template>
  <article class="card">
    <h2>Reactive counter</h2>
    <p>Freeze mode should stop this counter from moving while the overlay is active.</p>
    <div class="counter">
      <button class="button is-secondary" @click="count -= 1">−</button>
      <span class="counter-value">{{ count }}</span>
      <button class="button" @click="count += 1">+</button>
    </div>
  </article>
</template>
