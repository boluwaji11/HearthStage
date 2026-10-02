import { defineConfig } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve("src/main/index.ts") } },
    },
  },
  preload: {
    build: {
      rollupOptions: { input: { index: resolve("src/preload/index.ts") } },
    },
  },
  renderer: {
    root: "src",
    build: {
      rollupOptions: {
        input: {
          control: resolve("src/control/index.html"),
          output: resolve("src/output/index.html"),
        },
      },
    },
  },
});
