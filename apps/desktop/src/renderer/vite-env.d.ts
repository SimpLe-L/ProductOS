import type { DesktopApi } from "../shared";

declare global {
  interface Window {
    openFounder?: DesktopApi;
  }
}

export {};

