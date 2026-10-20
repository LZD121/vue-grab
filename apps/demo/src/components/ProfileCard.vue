<script setup lang="ts">
defineProps<{ name: string }>();
const emit = defineEmits<{ "update:name": [value: string] }>();
</script>

<template>
  <article class="card">
    <h2>Profile</h2>
    <p>Text inputs should keep their native copy behavior while Vue Grab is inactive.</p>
    <label class="field">
      <span>Display name</span>
      <input
        :value="name"
        placeholder="Your name"
        @input="emit('update:name', ($event.target as HTMLInputElement).value)"
      />
    </label>
  </article>
</template>
