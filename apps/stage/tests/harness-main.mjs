/**
 * STG-28, ST6.4, ST20.4. The Electron side of the render harness.
 *
 * Loads the harness page in a window nobody sees, runs every case, and prints
 * the report as one line of JSON. The asserting is in `render.mjs`, which reads
 * that line, because a process that both measures and judges is a process that
 * can pass itself.
 */
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const page = resolve(here, "..", "out", "renderer", "harness", "index.html");
const limit = Number(process.argv[process.argv.length - 1]) || undefined;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });

  try {
    await window.loadFile(page);
    const report = await window.webContents.executeJavaScript(
      `JSON.stringify(window.harness.run(${limit === undefined ? "" : limit}))`,
    );
    process.stdout.write(`\n__REPORT__${report}\n`);
    app.exit(0);
  } catch (reason) {
    process.stdout.write(`\n__REPORT__${JSON.stringify({ cases: 0, failures: [], error: String(reason) })}\n`);
    app.exit(1);
  }
});
