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
import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from "electron";
import {
  CHANNELS,
  isIntent,
  type ControlState,
  type EditorState,
  type OutputState,
  type OutputView,
} from "@hearth/stage-protocol";
import {
  compileDeck,
  lookupFrom,
  nextUp,
  presentationPlan,
  setListPlan,
  withItem,
  songPlan,
  type ServicePlan,
} from "@hearth/songs";
import { sampleLibrary, sampleService } from "@hearth/songs/fixtures";
import { openLibrary } from "@hearth/stage-store";
import { Presentations } from "./presentations";
import { restoredOrders } from "./repair";
import { APP_NAME, OLD_FOLDER, relocation } from "./userdata";
import { Session } from "./session";
import { hostname } from "node:os";
import { openDevice, renameDevice } from "./device";
import { readLogo, removeLogo, setLogo } from "./branding";
import {
  createControlWindow,
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
 * STG-10, ST1.2. Nothing is written into a church's library on the way up.
 *
 * Stage carries the hymns and offers them, in Slides, where a church with an
 * empty library is looking for something to put on a screen. The sample service
 * brings its own two songs when somebody opens it. Landing a church in a library
 * they did not ask for is a product deciding what a church owns.
 */

/**
 * The orders an older build wiped, put back (STG-9).
 *
 * See `repair.ts` for what it will and will not touch. It goes when the sample
 * set stops being seeded, with STG-10.
 */
function repair(): void {
  for (const sample of sampleLibrary) {
    const stored = store.library.get(sample.song.id);
    if (stored === null) continue;
    const fixed = restoredOrders(stored, sample);
    if (fixed !== null) store.library.save(fixed);
  }
}

repair();

const presentations = new Presentations(store.library);

/**
 * This laptop (STG-14, ST1.1, ST1.9).
 *
 * Nothing is signed in to. Stage names itself after the machine, and the name
 * is a thing a church with three laptops changes.
 */
let device = openDevice(app.getPath("userData"), {
  hostname: hostname(),
  platform: process.platform,
});
presentations.device({ name: device.name, platform: device.platform });

/**
 * The church's logo, for the key that clears the room (STG-22, ST6.6).
 *
 * Read once and held, rather than carried on the state, because it is a picture
 * that changes once in a year and the state goes down behind every keypress.
 */
let logo: string | null = readLogo(app.getPath("userData"));
presentations.branding(logo !== null);

function sendLogo(): void {
  for (const [, entry] of outputs) {
    if (!entry.window.isDestroyed()) entry.window.webContents.send(CHANNELS.logo, logo);
  }
  if (control !== null && !control.isDestroyed()) control.webContents.send(CHANNELS.logo, logo);
}

/** A church choosing their mark. Nothing ships one, because it is theirs. */
async function chooseLogo(): Promise<void> {
  const parent = control;
  const options: OpenDialogOptions = {
    properties: ["openFile"],
    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }],
  };
  const chosen =
    parent === null || parent.isDestroyed()
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(parent, options);
  const file = chosen.filePaths[0];
  if (chosen.canceled || file === undefined) return;

  const refused = setLogo(app.getPath("userData"), file);
  if (refused !== null) return;
  logo = readLogo(app.getPath("userData"));
  presentations.branding(logo !== null);
  sendLogo();
  broadcast();
}

// Compiled from the library on disk rather than from the fixtures, so what the
// list shows and what the service presents are the same records.
/**
 * The songs, read when a service is compiled.
 *
 * Read fresh rather than once on the way up, because a song typed in during this
 * session has to present without restarting the application. Compiling happens
 * when a service is opened and when a plan changes, so this is nowhere near a
 * cue advance (ST5.11, ST21.1).
 */
function songs() {
  return lookupFrom(store.library.all());
}

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
const session = new Session(compileDeck(NOTHING_OPEN, songs()), null);

/** Which presentation is on the wall, where one is. */
let presenting: string | null = null;

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
/**
 * The plan to open on (STG-48, ST12.5).
 *
 * Read fresh on every broadcast, so typing a plan for next week puts it on the
 * landing page without a restart.
 */
function comingUp(): ControlState["nextUp"] {
  const found = nextUp(presentations.state().setLists, today());
  return found === null ? null : { id: found.id, title: found.title, date: found.date };
}

/** Today where this church is, which is the only clock a service runs on. */
function today(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Counts the items called from the floor, so each one gets its own id. */
let added = 0;

function broadcast(): void {
  for (const [outputId, entry] of outputs) {
    if (entry.window.isDestroyed()) continue;
    const state: OutputState = session.outputState(outputId);
    entry.window.webContents.send(CHANNELS.outputState, state);
  }
  if (control !== null && !control.isDestroyed()) {
    const state: ControlState = session.controlState(outputViews(), comingUp());
    control.webContents.send(CHANNELS.controlState, state);
  }
  if (control !== null && !control.isDestroyed()) {
    const state: EditorState = presentations.state(
      presenting,
      session.controlState([]).service?.title ?? null,
    );
    control.webContents.send(CHANNELS.editorState, state);
  }
}

/**
 * Brings the window forward (STG-149).
 *
 * The workbench is a page of this window rather than a second one (STG-170), so
 * leaving it is a page change. Focus is still taken, because a church reaching
 * the service from the dock expects the window in front.
 */
function showControl(): void {
  if (control === null || control.isDestroyed()) {
    control = createControlWindow();
    return;
  }
  if (control.isMinimized()) control.restore();
  control.focus();
}

/**
 * Puts one thing on the wall (STG-145, STG-7).
 *
 * A song and a set of typed slides are both a one item service rather than a
 * second path into the renderer, because everything downstream of the deck
 * compiler already works and a second path would be a second set of bugs.
 */
function presentNow(itemId: string): boolean {
  const lookup = presentations.lookup();
  const plan = planFor(itemId, lookup);
  if (plan === null) return false;

  session.open(compileDeck(plan, songs(), { presentations: lookup }), plan);
  presenting = itemId;
  return true;
}

/**
 * Putting one thing on the screen while a service is running (STG-25, ST12.3).
 *
 * Present is in the editor and it replaces what the room is looking at, so a
 * church running a service should not lose it to a button somebody pressed in
 * another window. The asking is in that window, in the application's own
 * dialog, because a confirmation that looks like the operating system is a
 * confirmation from somewhere else.
 */
function planFor(
  itemId: string,
  lookup: ReturnType<typeof presentations.lookup>,
): ServicePlan | null {
  const presentation = lookup(itemId);
  if (presentation !== undefined) return presentationPlan(presentation);

  const song = store.library.get(itemId);
  if (song !== null) return songPlan(song);

  return null;
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
        showControl();
        presentations.apply({ type: "showPlans" });
        broadcast();
        return;
      case "showControl":
        showControl();
        presentations.apply(payload);
        broadcast();
        return;
      case "makeSlide":
        presentations.apply({ type: "newPresentation" });
        broadcast();
        return;
      case "openLibrary":
        presentations.apply({ type: "showLibrary" });
        broadcast();
        return;
      case "openSample":
        // The service is made of two songs, so pressing it is what puts them
        // in the library. Nothing arrives before somebody asks for something.
        for (const whole of sampleLibrary) {
          if (store.library.get(whole.song.id) === null) store.library.save(whole);
        }
        session.open(
          compileDeck(sampleService, songs(), { presentations: presentations.lookup() }),
          sampleService,
        );
        presenting = null;
        broadcast();
        return;
      case "closeService":
        session.open(compileDeck(NOTHING_OPEN, songs()), null);
        presenting = null;
        broadcast();
        return;
      case "renameDevice": {
        const renamed = renameDevice(app.getPath("userData"), device, payload.name);
        if (renamed === null) return;
        device = renamed;
        presentations.device({ name: device.name, platform: device.platform });
        broadcast();
        return;
      }
      case "chooseLogo":
        void chooseLogo();
        return;
      case "removeLogo": {
        if (!removeLogo(app.getPath("userData"))) return;
        logo = null;
        presentations.branding(false);
        sendLogo();
        broadcast();
        return;
      }
      case "presentSetList": {
        const list = store.library.getSetList(payload.setListId);
        if (list === null) return;
        const plan = setListPlan(list, (itemId) => store.library.kindOf(itemId));
        session.open(
          compileDeck(plan, songs(), { presentations: presentations.lookup() }),
          plan,
        );
        presenting = null;
        showControl();
        broadcast();
        return;
      }
      /**
       * The leader calls a song that is not in the set (STG-49, ST5.8).
       *
       * Compiled into the service that is running rather than written to the
       * set list, because what a church planned is still what they planned and
       * a change made in a hurry at 10:40 is not a plan.
       */
      case "addToDeck": {
        const running = session.plannedNow();
        if (running === null) return;
        const lookup = presentations.lookup();
        const one = planFor(payload.itemId, lookup);
        const item = one?.items[0];
        if (item === undefined) return;

        // Its own id, so calling the same song twice puts it on twice rather
        // than colliding with the copy already there.
        const itemId = `added:${payload.itemId}:${added += 1}`;
        const after = session.showingItemId();
        const plan = withItem(running, { ...item, id: itemId }, after);
        const deck = compileDeck(plan, songs(), { presentations: lookup });
        const group = deck.groups.find((one) => one.itemId === itemId);
        if (group === undefined) return;
        if (session.insert(deck, plan, group.id, after)) broadcast();
        return;
      }

      case "presentNow":
        if (presentNow(payload.presentationId)) broadcast();
        return;
      case "showPlans":
      case "showLibrary":
      case "showSettings":
      case "showLibraryKind":
      case "newSetList":
      case "newPlanSlide":
      case "saveToLibrary":
      case "newPresentation":
      case "openItem":
      case "closeItem":
      case "addSamples":
      case "openSetList":
      case "duplicateSetList":
      case "closeSetList":
      case "saveSetList":
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
    // Every window asks once on the way up, which is the moment to hand it the
    // picture it cannot ask for.
    event.sender.send(CHANNELS.logo, logo);
    const entry = [...outputs.entries()].find(
      ([, candidate]) => candidate.window.webContents.id === event.sender.id,
    );
    if (entry !== undefined) {
      return { output: session.outputState(entry[0]), control: null, editor: null };
    }
    // One window, so it is handed both halves of what it paints (STG-170).
    return {
      output: null,
      control: session.controlState(outputViews(), comingUp()),
      editor: presentations.state(presenting, session.controlState([]).service?.title ?? null),
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
