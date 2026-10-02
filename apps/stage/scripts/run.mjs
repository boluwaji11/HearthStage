/**
 * Runs electron-vite with an environment Electron can actually start in.
 *
 * `ELECTRON_RUN_AS_NODE` makes Electron behave as a plain Node binary, and an
 * editor that is itself an Electron application (VS Code, Cursor) sets it for
 * every process its terminal spawns. Inheriting it means `require("electron")`
 * resolves to the npm shim instead of the API, and the first line of the main
 * process throws on an undefined `app`.
 *
 * So the variable is removed here rather than explained in a README, because
 * the person who hits it is running one command and reading a stack trace.
 *
 *   node scripts/run.mjs dev
 *   node scripts/run.mjs preview
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const command = process.argv[2] ?? "dev";
const require = createRequire(import.meta.url);

const env = { ...process.env };
delete env["ELECTRON_RUN_AS_NODE"];

// The package blocks its own bin path in `exports`, so the entry is found by
// way of its package.json, which every package exposes.
const root = dirname(require.resolve("electron-vite/package.json"));
const binary = join(root, "bin", "electron-vite.js");

const child = spawn(process.execPath, [binary, command, ...process.argv.slice(3)], {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal !== null) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
