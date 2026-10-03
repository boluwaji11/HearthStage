/**
 * STG-28, ST6.4, ST20.4. The render harness.
 *
 * Rasterises every slide of the bundled library in every theme at three output
 * resolutions, and fails the build where a glyph crosses the safe area, where a
 * slide overflows the screen, or where a capital is under 4% of the output's
 * height.
 *
 *   pnpm --filter @hearth/stage render
 *   pnpm --filter @hearth/stage render 40     # the first forty slides
 *
 * Not a unit test. It needs a real engine doing real layout with real fonts,
 * which is the whole point: the numbers in ST6.4 and ST20.4 are about what a
 * room can see, and nothing short of a browser can answer that.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const electron = require("electron");
const here = dirname(fileURLToPath(import.meta.url));

// Removed rather than unset: an editor that is itself an Electron application
// sets it for its children, and Electron would then run as plain Node.
const env = { ...process.env };
delete env["ELECTRON_RUN_AS_NODE"];

const limit = process.argv[2];
const child = spawn(
  electron,
  [resolve(here, "harness-main.mjs"), ...(limit === undefined ? [] : [limit])],
  { stdio: ["ignore", "pipe", "pipe"], env },
);

let output = "";
child.stdout.on("data", (chunk) => (output += chunk));
child.stderr.on("data", (chunk) => (output += chunk));

const code = await new Promise((settle) => child.on("exit", settle));

const line = output.split("\n").find((entry) => entry.startsWith("__REPORT__"));
if (line === undefined) {
  console.error("The harness printed no report.");
  console.error(output.trim().slice(0, 2000));
  process.exit(1);
}

const report = JSON.parse(line.slice("__REPORT__".length));
if (report.error !== undefined) {
  console.error(`The harness could not run: ${report.error}`);
  process.exit(1);
}

const { cases, failures } = report;
if (failures.length === 0) {
  console.log(`${cases} slides measured. Every glyph inside the safe area, every capital above the floor.`);
  process.exit(code === 0 ? 0 : 1);
}

// Grouped by what is wrong, with a handful of examples, because a floor that is
// wrong fails thousands of slides and the list is not the useful part.
const byWhat = new Map();
for (const failure of failures) {
  const held = byWhat.get(failure.what) ?? [];
  held.push(failure);
  byWhat.set(failure.what, held);
}

console.error(`${failures.length} of ${cases} slides failed.`);
for (const [what, held] of byWhat) {
  console.error(`\n${what}: ${held.length}`);
  for (const one of held.slice(0, 4)) {
    console.error(`  ${one.item} / ${one.theme} / ${one.resolution}: ${one.detail}`);
  }
}
process.exit(1);
