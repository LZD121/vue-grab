import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");

if (import.meta.env.DEV) {
  void import("vue-grab");
}
