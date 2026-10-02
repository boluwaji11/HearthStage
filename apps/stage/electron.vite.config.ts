import { defineConfig } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve("src/main/index.ts") },
        // A native module cannot be bundled. Named one at a time rather than
        // externalising every dependency, because the workspace packages are
        // TypeScript source and have to be compiled in.
        external: ["better-sqlite3"],
      },
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
          editor: resolve("src/editor/index.html"),
          output: resolve("src/output/index.html"),
        },
      },
    },
  },
});
