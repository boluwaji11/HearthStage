/**
 * STG-11, STG-15. Creating windows, with the settings that matter.
 *
 * Every renderer is sandboxed, context isolated, and has no node integration.
 * An output window carries no chrome, hides the cursor, and keeps the display
 * awake (ST10.2).
 *
 * One window per output, rather than one window spanning several displays, so a
 * renderer crashing takes out one screen and main restarts it while the others
 * keep running (ST19.3).
 */

import { join } from "node:path";
import { BrowserWindow, screen, shell } from "electron";

const PRELOAD = join(__dirname, "../preload/index.js");

/** The renderer entry points, as electron-vite lays them out. */
function pageUrl(page: "control" | "output"): { url?: string; file?: string } {
  const dev = process.env["ELECTRON_RENDERER_URL"];
  if (dev !== undefined) return { url: `${dev}/${page}/index.html` };
  return { file: join(__dirname, `../renderer/${page}/index.html`) };
}

function load(window: BrowserWindow, page: "control" | "output"): void {
  const target = pageUrl(page);
  if (target.url !== undefined) void window.loadURL(target.url);
  else void window.loadFile(target.file as string);
}

const COMMON_WEB_PREFERENCES = {
  preload: PRELOAD,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  webviewTag: false,
  // A renderer has no reason to open anything, and this is the setting that
  // stops a stray link turning an output into a browser mid-service.
  allowRunningInsecureContent: false,
} as const;

/** Nothing a renderer does may open a window or navigate the app away. */
function lockDown(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
}

export function createControlWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Hearth Stage",
    backgroundColor: "#16140f",
    webPreferences: COMMON_WEB_PREFERENCES,
  });

  lockDown(window);
  window.once("ready-to-show", () => window.show());
  load(window, "control");
  return window;
}

export interface DisplayChoice {
  id: number;
  /** A name an operator recognises, rather than an index. */
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
}

/**
 * The displays, named.
 *
 * Addressed by identity rather than by index, because an index changes when
 * something is unplugged and the Sunday projector has to land on the same
 * output every week (ST10.4). Identity by display id for now; the stable
 * manufacturer and serial hash arrives with STG-64.
 */
export function displays(): DisplayChoice[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    name:
      display.label !== ""
        ? display.label
        : `${display.size.width} by ${display.size.height}${display.id === primary.id ? ", built in" : ""}`,
    bounds: display.bounds,
    primary: display.id === primary.id,
  }));
}

export function createOutputWindow(choice: DisplayChoice): BrowserWindow {
  const window = new BrowserWindow({
    x: choice.bounds.x,
    y: choice.bounds.y,
    width: choice.bounds.width,
    height: choice.bounds.height,
    show: false,
    frame: false,
    // No chrome, nothing to grab, and nothing an operator can drag out of place
    // in the middle of a service.
    titleBarStyle: "hidden",
    fullscreenable: true,
    backgroundColor: "#000000",
    // An output is never the window that takes focus. The control surface keeps
    // the keyboard.
    focusable: false,
    skipTaskbar: true,
    webPreferences: COMMON_WEB_PREFERENCES,
  });

  lockDown(window);
  window.setMenuBarVisibility(false);
  // The cursor has no business on a wall.
  window.webContents.on("dom-ready", () => {
    void window.webContents.insertCSS("*, *::before, *::after { cursor: none !important; }");
  });

  window.once("ready-to-show", () => {
    window.show();
    // Fullscreen after showing, because setting it before leaves a window that
    // is fullscreen on the wrong display on some window managers.
    if (!choice.primary) window.setFullScreen(true);
  });

  load(window, "output");
  return window;
}
