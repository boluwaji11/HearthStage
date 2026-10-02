/**
 * Puts a better-sqlite3 binding Electron can load next to the application.
 *
 * Electron and Node use different module ABIs, and one install of
 * better-sqlite3 has room for one binding. The workspace keeps the Node one,
 * because the store's tests run under Node. So this sets the Node binding
 * aside, fetches the Electron one, copies it to `native/better_sqlite3.node`,
 * puts the Node one back, and main loads the copy by path.
 *
 *   pnpm --filter @hearth/stage native
 *
 * Run once after an install, and again after the Electron version changes.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const require = createRequire(join(app, "package.json"));

const modulePath = dirname(require.resolve("better-sqlite3/package.json"));
const built = join(modulePath, "build/Release/better_sqlite3.node");
const electronVersion = require("electron/package.json").version;

function fetchFor(runtime, target) {
  const result = spawnSync(
    "npx",
    [
      "--no-install",
      "prebuild-install",
      "--runtime",
      runtime,
      "--target",
      target,
      "--arch",
      process.arch,
      "--platform",
      process.platform,
    ],
    { cwd: modulePath, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`Could not fetch the ${runtime} ${target} binding for better-sqlite3.`);
  }
}

// Set aside rather than fetched again afterwards, because the Node binding was
// compiled from source at install time and there may be no prebuild of it to
// download back.
const kept = join(tmpdir(), `better_sqlite3.node.${process.pid}`);
if (!existsSync(built)) {
  throw new Error("better-sqlite3 has no built binding. Run an install first.");
}
copyFileSync(built, kept);

try {
  fetchFor("electron", electronVersion);
  const destination = join(app, "native");
  mkdirSync(destination, { recursive: true });
  copyFileSync(built, join(destination, "better_sqlite3.node"));
} finally {
  copyFileSync(kept, built);
  rmSync(kept, { force: true });
}

console.log(`better_sqlite3.node for Electron ${electronVersion} is in apps/stage/native.`);
