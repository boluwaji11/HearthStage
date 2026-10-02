/**
 * Launches the built application and reports whether it stays up.
 *
 * Not a unit test. It is the one check that catches a main process that throws
 * on startup, which typecheck and the session tests cannot see.
 *
 *   pnpm --filter @hearth/stage smoke
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const electron = createRequire(import.meta.url)("electron");

// The app directory. Handed a .js path, Electron runs as plain
// Node, require("electron") resolves to the npm shim rather than the API, and
// the first line of main throws on an undefined app.
// ELECTRON_RUN_AS_NODE is removed rather than merely unset in the parent: an
// editor that is itself an Electron application sets it for its child
// processes, and inheriting it makes Electron run as plain Node, where
// require("electron") resolves to the npm shim and the first line of main
// throws on an undefined app.
const env = { ...process.env, ELECTRON_ENABLE_LOGGING: "1" };
delete env["ELECTRON_RUN_AS_NODE"];

const child = spawn(electron, ["."], {
  stdio: ["ignore", "pipe", "pipe"],
  env,
});

let output = "";
child.stdout.on("data", (chunk) => (output += chunk));
child.stderr.on("data", (chunk) => (output += chunk));

let exited = null;
child.on("exit", (code, signal) => (exited = { code, signal }));

await new Promise((resolve) => setTimeout(resolve, 9000));

const noise = output
  .split("\n")
  .filter((line) => /error|fail|denied|refused|Uncaught/i.test(line))
  .filter((line) => !/^\s*$/.test(line));

if (exited !== null) {
  console.log(`FAILED: exited early, code=${exited.code} signal=${exited.signal}`);
  console.log(output.slice(-3000));
  process.exit(1);
}

child.kill("SIGTERM");

if (noise.length > 0) {
  console.log("FAILED: errors on the console");
  console.log(noise.slice(0, 20).join("\n"));
  process.exit(1);
}

console.log("Stayed up for 9 seconds with a clean console.");
