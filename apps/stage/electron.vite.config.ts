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
          // Not a screen a church sees. It is the output renderer at a size a
          // test names, so the geometry can be asserted (STG-28, ST6.4).
          harness: resolve("src/harness/index.html"),
        },
      },
    },
  },
});
