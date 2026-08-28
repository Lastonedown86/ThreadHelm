import type { ThreadHelmApi } from './api.js';

declare global {
  interface Window {
    threadhelm: ThreadHelmApi;
  }
}

export {};
