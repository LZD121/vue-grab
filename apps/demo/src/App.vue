<script setup lang="ts">
import { ref } from "vue";
import CounterCard from "./components/CounterCard.vue";
import TaskList from "./components/TaskList.vue";
import ProfileCard from "./components/ProfileCard.vue";

const name = ref("Ada Lovelace");
const theme = ref<"light" | "dark">("light");
</script>

<template>
  <main class="page">
    <header class="hero">
      <div>
        <h1>Vue Grab</h1>
        <p>Hover, click, and copy the exact Vue source behind any element.</p>
      </div>
      <button class="button" @click="theme = theme === 'light' ? 'dark' : 'light'">
        Toggle mood
      </button>
    </header>

    <section class="grid">
      <CounterCard />
      <ProfileCard v-model:name="name" />
      <TaskList />
      <article class="card is-wide">
        <h2>Hover reveal</h2>
        <p>The hidden panel appears on hover; freeze should keep it open.</p>
        <div class="hover-card">
          Hover this card
          <div class="hover-content">Now visible</div>
        </div>
      </article>
      <article class="card is-wide">
        <h2>Ignored surface</h2>
        <p>This subtree is excluded from selection with <code>data-vue-grab-ignore</code>.</p>
        <div class="ignored" data-vue-grab-ignore>
          <strong>Not selectable.</strong> Use this for third-party widgets.
        </div>
      </article>
    </section>
  </main>
</template>
