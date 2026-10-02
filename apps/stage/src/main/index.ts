/**
 * STG-11. The main process.
 *
 * It owns the windows, the session, and every piece of state. Renderers receive
 * state and send intents, and that is the whole conversation.
 *
 * What it presents at this point is a service compiled from the public-domain
 * fixtures in `@hearth/songs`. Opening a service out of the library on disk
 * arrives with the entry stories, and the deck compiler does not care which it
 * came from.
 */

import { app, BrowserWindow, ipcMain } from "electron";
import {
  CHANNELS,
  isIntent,
  type ControlState,
  type OutputState,
  type OutputView,
} from "@hearth/stage-protocol";
import { compileDeck, lookupFrom } from "@hearth/songs";
import { sampleLibrary, sampleService } from "@hearth/songs/fixtures";
import { Session } from "./session";
import { createControlWindow, createOutputWindow, displays, type DisplayChoice } from "./windows";

const session = new Session(compileDeck(sampleService, lookupFrom(sampleLibrary)), sampleService);

let control: BrowserWindow | null = null;
const outputs = new Map<string, { window: BrowserWindow; choice: DisplayChoice }>();

function outputViews(): OutputView[] {
  return [...outputs.entries()].map(([outputId, entry]) => ({
    outputId,
    name: entry.choice.primary ? "Preview" : "Main",
    display: entry.choice.name,
    live: !entry.window.isDestroyed(),
  }));
}

/**
 * Pushes current state to every window.
 *
 * One function, called after anything changes, so there is one place where a
 * repaint can be reasoned about and no window can be left showing something
 * stale.
 */
function broadcast(): void {
  for (const [outputId, entry] of outputs) {
    if (entry.window.isDestroyed()) continue;
    const state: OutputState = session.outputState(outputId);
    entry.window.webContents.send(CHANNELS.outputState, state);
  }
  if (control !== null && !control.isDestroyed()) {
    const state: ControlState = session.controlState(outputViews());
    control.webContents.send(CHANNELS.controlState, state);
  }
}

function openOutput(choice: DisplayChoice): void {
  const outputId = `display:${choice.id}`;
  const window = createOutputWindow(choice);
  outputs.set(outputId, { window, choice });

  // A renderer crashing takes out one screen. Main brings it back and the
  // others keep running (ST19.3).
  window.webContents.on("render-process-gone", () => {
    if (app.isReady() && !window.isDestroyed()) window.reload();
  });
  window.on("closed", () => {
    outputs.delete(outputId);
    broadcast();
  });
}

app.whenReady().then(() => {
  ipcMain.on(CHANNELS.intent, (unused, payload: unknown) => {
    // Validated on arrival rather than trusted. The boundary is where a
    // sandbox is worth anything.
    if (!isIntent(payload)) return;
    if (session.apply(payload)) broadcast();
  });

  ipcMain.handle(CHANNELS.hello, (event) => {
    const entry = [...outputs.entries()].find(
      ([, candidate]) => candidate.window.webContents.id === event.sender.id,
    );
    return {
      output: entry === undefined ? null : session.outputState(entry[0]),
      control: entry === undefined ? session.controlState(outputViews()) : null,
    };
  });

  control = createControlWindow();

  const found = displays();
  const secondary = found.filter((display) => !display.primary);
  if (secondary.length > 0) {
    // The real case: a projector or a second screen.
    for (const choice of secondary) openOutput(choice);
  } else {
    // One screen, which is a developer's machine. The output opens as a window
    // so there is something to look at.
    const primary = found.find((display) => display.primary);
    if (primary !== undefined) openOutput(primary);
  }

  broadcast();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) control = createControlWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Nothing in this application loads a remote origin, so a renderer asking for
// one is a defect rather than a feature to allow.
app.on("web-contents-created", (unused, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
