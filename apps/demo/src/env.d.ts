import type { VueGrabAPI } from "../../../packages/vue-grab/src/types";

declare global {
  interface Window {
    __VUE_GRAB__?: VueGrabAPI;
  }
}

export {};
