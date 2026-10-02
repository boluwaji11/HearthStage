/**
 * STG-11. The main process.
 *
 * It owns the windows, the session, and every piece of state. Renderers receive
 * state and send intents, and that is the whole conversation.
 *
 * What it presents on launch is a service compiled from the public-domain
 * fixtures in `@hearth/songs`. Slides a person types are real and live in
 * `library.db` beside it (STG-145), and presenting one replaces what is open.
 * Set lists, where the two sit in one order, arrive with the entry stories, and
 * the deck compiler does not care which a service came from.
 */

import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  CHANNELS,
  isIntent,
  type ControlState,
  type EditorState,
  type OutputState,
  type OutputView,
} from "@hearth/stage-protocol";
import { compileDeck, lookupFrom, presentationPlan, type ServicePlan } from "@hearth/songs";
import { sampleLibrary, sampleService } from "@hearth/songs/fixtures";
import { openLibrary } from "@hearth/stage-store";
import { Presentations } from "./presentations";
import { APP_NAME, OLD_FOLDER, relocation } from "./userdata";
import { Session } from "./session";
import {
  createControlWindow,
  createEditorWindow,
  createOutputWindow,
  displays,
  type DisplayChoice,
} from "./windows";

/**
 * The product's name, before anything asks where its data goes (STG-168).
 *
 * `app.getPath("userData")` is built from the application name, so this has to
 * run before the first call to it. It also names the menu bar on macOS and the
 * window the operating system shows in its task switcher.
 */
app.setName(APP_NAME);

/**
 * The library a church typed, moved out of the folder named after the package.
 *
 * Done once, on the way up, before anything opens the database. The decision is
 * in `relocation` with no filesystem in it, so the cases that would lose a
 * church's only copy are the ones with tests on them.
 */
function moveOldLibrary(): void {
  const from = join(app.getPath("appData"), OLD_FOLDER);
  const to = app.getPath("userData");
  const what = relocation({
    from,
    to,
    has: (directory, name) => existsSync(join(directory, name)),
  });
  if (what.action === "none") return;

  mkdirSync(to, { recursive: true });
  for (const name of what.entries) {
    try {
      renameSync(join(from, name), join(to, name));
    } catch (cause) {
      // A failed move leaves the old file where it is, so the church still has
      // its library. Worth saying out loud rather than swallowing.
      console.error(`Could not move ${name} from ${from} to ${to}.`, cause);
    }
  }
}

moveOldLibrary();

/**
 * The better-sqlite3 binding built for Electron.
 *
 * Beside the application when it is packaged, and in `apps/stage/native` in
 * development, put there by `pnpm --filter @hearth/stage native`. Undefined
 * falls back to the installed binding, which is the Node one and will refuse
 * to load here, so the absence is worth failing on loudly rather than working
 * by accident.
 */
function sqliteBinding(): string | undefined {
  const candidates = [
    join(process.resourcesPath ?? "", "native/better_sqlite3.node"),
    join(__dirname, "../../native/better_sqlite3.node"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

/**
 * The church's own library, on disk.
 *
 * In `userData`, which is where an operating system expects an application to
 * keep data a person cannot afford to lose, and where an uninstall leaves it
 * alone. For a church that never pairs with Hearth this file is the only copy,
 * which is why it opens with FULL synchronous and backs itself up on every
 * write (packages/stage-store).
 */
const store = openLibrary(join(app.getPath("userData"), "library.db"), {
  nativeBinding: sqliteBinding(),
});

/**
 * The bundled hymns, for a library that does not have them (STG-146).
 *
 * Checked one song at a time rather than by asking whether the library is
 * empty. A church that has typed a set of slides and no songs has a library
 * that is not empty and still has nothing to present from, which is how the
 * sample service came up with three missing songs during testing.
 *
 * An archived song still exists, so a church that puts one away keeps it away.
 * They are public domain. Offering the fuller sample set with a choice on first
 * run is STG-10, and this goes when that arrives.
 */
function seed(): void {
  for (const whole of sampleLibrary) {
    if (store.library.get(whole.song.id) !== null) continue;
    store.library.save(whole);
  }
}

seed();

const presentations = new Presentations(store.library);

// Compiled from the library on disk rather than from the fixtures, so what the
// list shows and what the service presents are the same records.
const songs = lookupFrom(store.library.all());

/** A service with nothing in it, which is what the application starts on. */
const NOTHING_OPEN: ServicePlan = {
  id: "nothing",
  source: "set_list",
  title: "",
  date: "",
  startsAt: null,
  items: [],
};

/**
 * A service opens when somebody opens one (STG-149, ST1.2).
 *
 * Landing a new church in a demo service they did not build is a product
 * explaining itself before it has been asked. The control surface shows the
 * three ways in while no service is open, and the sample is one of them.
 */
const session = new Session(compileDeck(NOTHING_OPEN, songs), null);

/** Which presentation is on the wall, where one is. */
let presenting: string | null = null;

let control: BrowserWindow | null = null;
let editor: BrowserWindow | null = null;
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
  if (editor !== null && !editor.isDestroyed()) {
    const state: EditorState = presentations.state(presenting);
    editor.webContents.send(CHANNELS.editorState, state);
  }
}

/** Opens the editor, or brings it forward if it is already open. */
function openEditor(): void {
  if (editor !== null && !editor.isDestroyed()) {
    editor.focus();
    return;
  }
  editor = createEditorWindow();
  editor.on("closed", () => {
    editor = null;
  });
}

/**
 * Puts one presentation on the wall (STG-145).
 *
 * It becomes a one item service rather than a second path into the renderer,
 * because everything downstream of the deck compiler already works and a second
 * path would be a second set of bugs.
 */
function presentNow(presentationId: string): boolean {
  const lookup = presentations.lookup();
  const one = lookup(presentationId);
  if (one === undefined) return false;

  const plan = presentationPlan(one);
  session.open(compileDeck(plan, songs, { presentations: lookup }), plan);
  presenting = presentationId;
  return true;
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

    switch (payload.type) {
      case "openEditor":
        openEditor();
        broadcast();
        return;
      case "makeSlide":
        openEditor();
        presentations.apply({ type: "newPresentation" });
        broadcast();
        return;
      case "openLibrary":
        openEditor();
        broadcast();
        return;
      case "openSample":
        session.open(
          compileDeck(sampleService, songs, { presentations: presentations.lookup() }),
          sampleService,
        );
        presenting = null;
        broadcast();
        return;
      case "presentNow":
        if (presentNow(payload.presentationId)) broadcast();
        return;
      case "newPresentation":
      case "openItem":
      case "closeItem":
      case "savePresentation":
      case "saveSong":
        if (presentations.apply(payload)) broadcast();
        return;
      default:
        if (session.apply(payload)) broadcast();
        return;
    }
  });

  ipcMain.handle(CHANNELS.hello, (event) => {
    const entry = [...outputs.entries()].find(
      ([, candidate]) => candidate.window.webContents.id === event.sender.id,
    );
    if (entry !== undefined) {
      return { output: session.outputState(entry[0]), control: null, editor: null };
    }
    const fromEditor = editor !== null && !editor.isDestroyed() && editor.webContents.id === event.sender.id;
    return {
      output: null,
      control: fromEditor ? null : session.controlState(outputViews()),
      editor: fromEditor ? presentations.state(presenting) : null,
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

// The library is closed on the way out, so WAL is checkpointed rather than
// left for the next launch to recover.
app.on("will-quit", () => {
  store.close();
});

// Nothing in this application loads a remote origin, so a renderer asking for
// one is a defect rather than a feature to allow.
app.on("web-contents-created", (unused, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
