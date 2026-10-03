/**
 * STG-12. What the main process and its windows say to each other.
 *
 * The traffic is one-directional in meaning, which is the decision the whole
 * application rests on (docs/architecture.md, "IPC"):
 *
 * - **Down: state.** `OutputState` is the complete description of what one
 *   output should show. A renderer diffs it against what it is showing and
 *   paints. There is no "advance" message to an output and no output holds a
 *   position in the deck.
 * - **Up: intent.** A window says `{ type: "advance" }`. Main decides what that
 *   means and broadcasts new state.
 *
 * The payoff is that the control surface, the remote, a Stream Deck, and crash
 * recovery are all the same code path: recovery is state applied to fresh
 * renderers, which is why five seconds is achievable (ST19.1).
 *
 * Shared by the main process and every renderer, so it holds types and
 * validators, and that is all: it imports neither Electron nor the DOM, and it
 * has no dependencies.
 */

/** What covers the output, independent of where the deck is (ST6.6). */
export const BLANKS = ["none", "black", "clear", "logo"] as const;
export type Blank = (typeof BLANKS)[number];

export type OutputContent =
  | {
      kind: "lyric";
      lines: string[];
      /** The second language, where the slide is bilingual (ST17.1). */
      translation: string[] | null;
      /** "V1". For the confidence monitor, kept off the wall (ST6.3). */
      label: string | null;
      /** Which appearance of this label, and of how many. */
      occurrence: number;
      occurrencesTotal: number;
      /** Position within the section. */
      slideIndex: number;
      slideCount: number;
      /**
       * Every slide of this section, so one size can be shared across them
       * (ST6.2). A section split two ways where the first slide is short and
       * the second is long must not jump size between them, and the renderer
       * cannot know that from one slide.
       */
      fitSlides: string[][];
      /** Stable per section, so a measured size is cached rather than redone. */
      fitKey: string;
    }
  | {
      /** Slides a person typed (STG-145, ST2.16). */
      kind: "slide";
      lines: string[];
      /** "Point 2". For the operator, kept off the wall (ST6.3). */
      label: string | null;
      slideIndex: number;
      slideCount: number;
      /** The parts one typed slide was broken into, so they share a size. */
      fitSlides: string[][];
      fitKey: string;
    }
  | { kind: "scripture"; lines: string[]; reference: string }
  | {
      /**
       * A clock counting down to the start of a service (STG-26, ST5.10).
       *
       * The moment it reaches, as epoch milliseconds, rather than the seconds
       * left. The window counts for itself, so a countdown is one message
       * rather than one a second through the render path (ST21.1).
       */
      kind: "countdown";
      endsAt: number;
      /** A line under the clock, where a church wants one. */
      message: string | null;
    }
  | { kind: "message"; lines: string[] }
  | { kind: "nothing" };

/**
 * The bits of a theme a renderer needs to paint a slide.
 *
 * Sizes are a proportion of output height rather than pixels, so one theme is
 * right on a 1080p projector and on a 4K foyer screen (ST8.2).
 */
/**
 * A ground with some depth in it (ST9.1, STG-20).
 *
 * Stops rather than a CSS string, for two reasons. A renderer builds the string
 * it needs, so a theme carries no syntax from a platform it may not be running
 * on. And the legibility floor is checked against every stop, so a gradient
 * cannot sneak a light patch under light words.
 */
export interface Gradient {
  kind: "linear" | "radial";
  /** Degrees, for a linear one. A radial one glows from a point. */
  angle: number;
  /** Two or more colours, in order. */
  stops: string[];
}

export interface ThemeState {
  id: string;
  fontFamily: string;
  fontWeight: number;
  /** Cap height as a fraction of output height. At or above 0.04 (ST20.4). */
  textSize: number;
  lineHeight: number;
  colour: string;
  /** The flat ground, and what a gradient falls back to. */
  background: string;
  /** Depth behind the words. Null leaves the ground flat (ST9.1). */
  gradient: Gradient | null;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  /** Safe area inset as a fraction of the shorter edge. */
  safeArea: number;
  /** Cross-dissolve, in milliseconds (ST6.5). */
  transitionMs: number;
  /** An outline or shadow, for legibility over video. */
  textShadow: string | null;
}

/** Everything one output should show. A renderer needs nothing else. */
export interface OutputState {
  outputId: string;
  /** Monotonic. A renderer ignores anything older than what it has. */
  revision: number;
  blank: Blank;
  content: OutputContent;
  theme: ThemeState;
}

/** The five things an operator does to the running order (STG-24, ST5.7). */
export const RUN_CHANGES = ["skip", "repeat", "up", "down", "drop"] as const;

export type RunChange = (typeof RUN_CHANGES)[number];

/** One cue, as the control surface and the stage display list it. */
export interface CueView {
  id: string;
  /**
   * This appearance of the cue (STG-24).
   *
   * A chorus sung twice is one cue and two entries, and the operator skips or
   * moves one of them without touching the other.
   */
  entryId: string;
  /** Out of this run, still in the list, and put back on a second press. */
  skipped: boolean;
  /** A copy the operator added. Only a copy can be taken away again. */
  repeat: boolean;
  position: number;
  groupId: string;
  kind: "lyric" | "scripture" | "marker" | "slide";
  label: string | null;
  occurrence: number;
  occurrencesTotal: number;
  slideIndex: number;
  slideCount: number;
  /** First line, for a list. The whole slide goes down in `OutputState`. */
  preview: string | null;
  /** A note on this slide, for the operator and the stage display (ST2.19). */
  note: string | null;
}

export interface GroupView {
  id: string;
  title: string;
  kind: "lyric" | "scripture" | "marker" | "slide";
  key: string | null;
  tempoBpm: number | null;
  sequence: string[];
  notes: { position: string | null; body: string }[];
  /** Its cues, by entry, in the order this run will show them (STG-24). */
  entryIds: string[];
}

export interface OutputView {
  outputId: string;
  name: string;
  /** The display it is on, by name, so an operator can tell them apart. */
  display: string;
  live: boolean;
}

/**
 * One slide, as a window paints it (STG-21).
 *
 * The control surface gets these so its live and next panes are the room's
 * slide at a smaller size. An operator deciding whether to advance is deciding
 * about what the room can see, and a first line in the window's own font
 * answers a different question.
 */
export interface SlideView {
  content: OutputContent;
  theme: ThemeState;
}

/** Everything the control surface shows. Also what the remote will show. */
export interface ControlState {
  revision: number;
  /** What is on the screen now, cover and all. Null at the end of the deck. */
  live: SlideView | null;
  /** What the next keypress puts there. Shown without the cover. */
  next: SlideView | null;
  service: { id: string; title: string; date: string; source: "set_list" | "plan" } | null;
  groups: GroupView[];
  cues: CueView[];
  position: number;
  blank: Blank;
  outputs: OutputView[];
  /** Named at compile time, so an operator knows before the service (ST5.2). */
  problems: { code: string; detail: string }[];
  /** Whether the run is still the order the church planned (STG-24). */
  asPlanned: boolean;
  /** When the countdown reaches zero, where one is running (STG-26). */
  countdownEndsAt: number | null;
  /**
   * The plan to open on, offered before anything is running (STG-48, ST12.5).
   *
   * The soonest one that has not happened yet, so a volunteer arriving on the
   * morning of the service starts it with one keypress. Null in a church that
   * has typed no plans.
   */
  nextUp: { id: string; title: string; date: string } | null;
}

/**
 * What the library holds, as one list (STG-146).
 *
 * A song and a set of typed slides are the same kind of thing to the person
 * looking for one: something to put on the screen. The kind says which, so the
 * list can be read at a glance and a search crosses both.
 */
export const LIBRARY_KINDS = ["song", "plain", "reading", "media"] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  title: string;
  /** The author on a song. Null where there is nothing worth a second line. */
  subtitle: string | null;
  /** Sections on a song, slides on a presentation. */
  count: number;
  /** The first slide's words, so a tile can be recognised without reading it. */
  preview: string[];
  /** The look it is presented in. Null takes the service's. */
  themeId: string | null;
  origin: "local" | "hearth";
}

/** One slide as a person has it on screen: a label, and a box of text. */
export interface SlideDraft {
  label: string | null;
  /** The box, as typed. Main splits it into lines, because the model decides. */
  body: string;
  /**
   * What kind of section this is, on a song (STG-7, ST2.1).
   *
   * Absent on a presentation, where a slide is a slide. A song's sections carry
   * a type because an arrangement sequences them and a chord chart prints them.
   */
  sectionType?: string;
  /**
   * A note for whoever is running the service (ST2.19).
   *
   * Absent on almost every slide, so it is optional rather than null
   * everywhere. It reaches the operator and the stage display, and it has no
   * path to the wall.
   */
  note?: string | null;
}

/**
 * One look a presentation can be given (STG-148, ST8.1).
 *
 * The picker needs a name and enough colour to draw a swatch. The whole theme
 * goes to the output in `OutputState`, so this carries no more than the choice
 * needs.
 */
export interface ThemeChoice {
  id: string;
  name: string;
  background: string;
  gradient: Gradient | null;
  colour: string;
  fontFamily: string;
  textAlign: "left" | "center" | "right";
}

/**
 * The fields on a song that are not its words (STG-7, ST2.1).
 *
 * Strings rather than numbers, because an empty box is a thing a person leaves
 * and `0` is a thing they typed. Main turns them into the record.
 */
export interface SongFields {
  author: string;
  composer: string;
  copyrightLine: string;
  ccliNumber: string;
  year: string;
  isPublicDomain: boolean;
  defaultKey: string;
}

/**
 * One order a song can be sung in (STG-9, ST2.3).
 *
 * A church sings the same song two ways: the whole thing at a conference and
 * four sections on a Tuesday evening. The order is the sequence of slide
 * titles, and the default is the one that presents when nobody says otherwise.
 *
 * Named rather than identified, because a name is what an order is to a person
 * and it is the only part of it that survives a trip through a window showing
 * no ids. Main matches a saved order to its record by name.
 */
export interface OrderDraft {
  name: string;
  /** Slide titles, in the order they are sung. A title may repeat. */
  sequence: string[];
  isDefault: boolean;
}

/** One running order, in a list of them (STG-46, ST2.8). */
export interface SetListRow {
  id: string;
  title: string;
  date: string;
  entries: number;
}

/** One line of a running order, as the window holds it. */
export interface SetEntryDraft {
  kind: "item" | "marker";
  /** The library item this stands for. Null on a marker. */
  itemId: string | null;
  title: string;
  notes?: string | null;
}

/**
 * Everything the slide editor shows.
 *
 * The same shape as the control surface: state down, and the window is a
 * function of it. What the person is partway through typing lives in the
 * renderer, because a keystroke is not worth a round trip, and everything that
 * has been stored comes from here.
 */
export interface EditorState {
  revision: number;
  library: LibraryItem[];
  /** The looks on offer. Built in for now, synced from Hearth with ST8.5. */
  themes: ThemeChoice[];
  /** What is open in the editor. Null before anything is chosen. */
  editing: {
    /** Null until the first save, which is when the library gets a row. */
    id: string | null;
    kind: LibraryKind;
    /**
     * Bumped when a different presentation is opened or a new one is started.
     *
     * It is how the window knows to replace what is in its boxes. A save comes
     * back with the serial unchanged, so storing what somebody typed never
     * reaches in and rewrites what they are still typing.
     */
    serial: number;
    title: string;
    slides: SlideDraft[];
    /** Null takes the service's theme (ST8.1). */
    themeId: string | null;
    /** Where a reading is from (STG-26). Null on everything else. */
    reference: string | null;
    /** Present on a song, absent on a presentation (STG-7). */
    song: SongFields | null;
    /** The ways it can be sung (STG-9). Empty on a presentation. */
    orders: OrderDraft[];
    readOnly: boolean;
    /**
     * Whether this sits on the library shelf (STG-169).
     *
     * False on a slide typed inside a service plan, which is what puts **Save
     * to the library** on the screen. True on a song, because a song library
     * is the shelf.
     */
    inLibrary: boolean;
  } | null;
  /**
   * This laptop (STG-14, ST1.9).
   *
   * Stage signs in to nothing, so the machine is the identity. A church with
   * three laptops renames them to tell them apart, and the name is what the
   * church's device list shows once pairing arrives.
   */
  device: { name: string; platform: string };
  /** Whether the church has given Stage a logo (STG-22, ST6.6). */
  hasLogo: boolean;
  /**
   * Hymns Stage can put in the library, that are not in it yet (STG-10).
   *
   * A count rather than the hymns, because the window only offers them. Zero
   * means a church that already has them, and the offer goes.
   */
  samples: number;
  /**
   * Which page the window is on (STG-46, STG-170).
   *
   * "none" is the workbench closed, which is the window showing the service it
   * is running. The rest are the pages inside it.
   *
   * Main's, rather than the window's, because both pages are reached from the
   * window that presents as well as from in here, and a page the renderer
   * remembered for itself would arrive in the wrong state.
   */
  page: "none" | "plans" | "library" | "settings";
  /**
   * Which kind of thing the library is showing, or null for the choice.
   *
   * A library of songs, media and slides shown all at once is a list nobody
   * can read. The kind is chosen first, and the list is of that kind.
   */
  libraryKind: "song" | "media" | "slides" | null;
  /** The running orders a church has typed, newest service first (STG-46). */
  setLists: SetListRow[];
  /** The one open in the window, where one is. */
  editingSet: {
    /** Null until the first save, which is when the list gets a row. */
    id: string | null;
    serial: number;
    title: string;
    date: string;
    entries: SetEntryDraft[];
  } | null;
  /** What is wrong with the last save attempt, by code (STG-145). */
  problems: { code: string; detail: string }[];
  /** Which presentation is live on the output, where one is. */
  presentingId: string | null;
  /**
   * The service running on the other window, by name (STG-25).
   *
   * The editor asks before it takes a church's service off the screen, and a
   * confirmation that cannot name what it is replacing is not one.
   */
  service: string | null;
}

export type Intent =
  | { type: "advance" }
  | { type: "reverse" }
  | { type: "goTo"; position: number }
  | { type: "goToCue"; cueId: string }
  | { type: "setBlank"; blank: Blank }
  | { type: "toggleBlank"; blank: Blank }
  | { type: "reload" }
  | { type: "openEditor" }
  /** From the editor back to the window that presents (STG-149). */
  | { type: "showControl" }
  /** First run, the three ways in (STG-149, ST1.2). */
  | { type: "makeSlide" }
  | { type: "openLibrary" }
  | { type: "openSample" }
  | { type: "newPresentation" }
  | { type: "openItem"; itemId: string }
  | {
      type: "savePresentation";
      /** Null creates one. Main allocates the id, so a renderer cannot. */
      presentationId: string | null;
      title: string;
      /** Every slide, in order. An empty box is dropped rather than stored. */
      slides: SlideDraft[];
      /** The look. Null takes the service's theme, and absent leaves it alone. */
      themeId?: string | null;
      /** Where a reading is from (STG-26). Absent leaves it alone. */
      reference?: string | null;
    }
  | {
      type: "saveSong";
      /** Null creates one. Main allocates the id, so a renderer cannot. */
      songId: string | null;
      title: string;
      fields: SongFields;
      /** The sections, in order. An empty box is dropped rather than stored. */
      sections: SlideDraft[];
      /**
       * The orders (STG-9). Absent leaves the song's alone.
       *
       * Main drops a title the song no longer has, so renaming a slide cannot
       * leave an order pointing at nothing.
       */
      orders?: OrderDraft[];
    }
  /** Back to the library, with nothing open (STG-149). */
  | { type: "closeItem" }
  /** A running order for one service (STG-46, ST2.8). */
  | { type: "showPlans" }
  | { type: "showLibrary" }
  | { type: "showSettings" }
  /**
   * One more item on a service that is running (STG-49, ST5.8).
   *
   * The leader calls a song that is not in the set. It goes on the deck after
   * the item on the screen, and the set list on disk is untouched, so what a
   * church planned is still what they planned.
   */
  | { type: "addToDeck"; itemId: string }
  /** A slide typed inside the open service plan (STG-169). */
  | { type: "newPlanSlide" }
  /** The open slide, onto the library shelf (STG-169). */
  | { type: "saveToLibrary" }
  | { type: "showLibraryKind"; kind: "song" | "media" | "slides" }
  | { type: "newSetList" }
  | { type: "openSetList"; setListId: string }
  /**
   * Last week's service, again (STG-47, ST2.9).
   *
   * A church's order is mostly the same from one Sunday to the next: a welcome,
   * two songs, the notices, the sermon. Starting from the last one is the
   * difference between two minutes and twenty.
   */
  | { type: "duplicateSetList"; setListId: string }
  | { type: "closeSetList" }
  | {
      type: "saveSetList";
      /** Null creates one. Main allocates the id, so a renderer cannot. */
      setListId: string | null;
      title: string;
      date: string;
      entries: SetEntryDraft[];
    }
  /** Put a whole running order on the screen. */
  | { type: "presentSetList"; setListId: string }
  /** Put the bundled hymns in the library (STG-10, ST1.2). */
  | { type: "addSamples" }
  /** Rename this machine (STG-14, ST1.9). A blank name is refused. */
  | { type: "renameDevice"; name: string }
  /** Choose the church's logo, for the key that clears the room (STG-22). */
  | { type: "chooseLogo" }
  | { type: "removeLogo" }
  /**
   * Change the order this run goes in (STG-24, ST5.7).
   *
   * It affects this run. Nothing here reaches the set list or the plan.
   */
  | { type: "runChange"; entryId: string; change: RunChange }
  /** Back to the order the church planned. */
  | { type: "resetRun" }
  /**
   * A clock on the wall before a service starts (STG-26, ST5.10).
   *
   * Over the top of whatever is open, including nothing at all, the same way
   * the covers are. Stopping it gives the slide back untouched.
   */
  | { type: "startCountdown"; minutes: number }
  /** More time on a clock already running, because a service slips. */
  | { type: "addCountdown"; minutes: number }
  | { type: "stopCountdown" }
  /** Puts the service away, back to the three ways in (STG-149, ST1.2). */
  | { type: "closeService" }
  | { type: "presentNow"; presentationId: string };

export type IntentType = Intent["type"];

/**
 * The only channels preload exposes.
 *
 * An allowlist rather than a prefix rule, because a renderer paints church
 * lyrics from a local cache and has no business reaching anything else
 * (docs/architecture.md, "Security").
 */
export const CHANNELS = {
  /** Renderer to main: an intent. */
  intent: "hearth:intent",
  /** Main to an output renderer: new state. */
  outputState: "hearth:output-state",
  /** Main to the control renderer: new state. */
  controlState: "hearth:control-state",
  /** Main to the editor renderer: new state. */
  editorState: "hearth:editor-state",
  /**
   * Main to every window: the church's logo, as a data URL (STG-22).
   *
   * Its own channel rather than a field on the state, because it is a picture
   * that changes once in a year and the state goes down behind every keypress.
   */
  logo: "hearth:logo",
  /** Renderer to main, invoked once on load, to get current state. */
  hello: "hearth:hello",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

export const ALL_CHANNELS: Channel[] = Object.values(CHANNELS);

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && ALL_CHANNELS.includes(value as Channel);
}

export function isBlank(value: unknown): value is Blank {
  return typeof value === "string" && (BLANKS as readonly string[]).includes(value);
}

/**
 * Whether something crossing the boundary is an intent.
 *
 * Validated in main on arrival rather than trusted, because a renderer is
 * sandboxed and the boundary is where a sandbox is worth anything. Written by
 * hand so this package keeps no dependencies, and exhaustive so a new intent
 * without a check here fails to compile.
 */
export function isIntent(value: unknown): value is Intent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    type?: unknown;
    position?: unknown;
    cueId?: unknown;
    blank?: unknown;
    presentationId?: unknown;
    itemId?: unknown;
    entryId?: unknown;
    setListId?: unknown;
    date?: unknown;
    entries?: unknown;
    change?: unknown;
    kind?: unknown;
    minutes?: unknown;
    name?: unknown;
    reference?: unknown;
    title?: unknown;
    slides?: unknown;
    sections?: unknown;
    songId?: unknown;
    fields?: unknown;
    orders?: unknown;
    themeId?: unknown;
  };

  switch (candidate.type) {
    case "advance":
    case "reverse":
    case "reload":
    case "openEditor":
    case "showControl":
    case "newPresentation":
    case "makeSlide":
    case "openLibrary":
    case "openSample":
    case "closeItem":
    case "showPlans":
    case "showLibrary":
    case "showSettings":
    case "newPlanSlide":
    case "saveToLibrary":
    case "newSetList":
    case "closeSetList":
    case "closeService":
    case "addSamples":
    case "chooseLogo":
    case "removeLogo":
    case "resetRun":
    case "stopCountdown":
      return true;
    case "startCountdown":
    case "addCountdown":
      return (
        typeof candidate.minutes === "number" &&
        Number.isFinite(candidate.minutes) &&
        candidate.minutes > 0 &&
        candidate.minutes <= 120
      );
    case "runChange":
      return (
        typeof candidate.entryId === "string" &&
        candidate.entryId.length > 0 &&
        RUN_CHANGES.includes(candidate.change as RunChange)
      );
    case "saveSong":
      return (
        (candidate.songId === null ||
          (typeof candidate.songId === "string" && candidate.songId.length > 0)) &&
        typeof candidate.title === "string" &&
        isSongFields(candidate.fields) &&
        isSlideDrafts(candidate.sections) &&
        (candidate.orders === undefined || isOrderDrafts(candidate.orders))
      );
    case "presentNow":
      return typeof candidate.presentationId === "string" && candidate.presentationId.length > 0;
    case "openItem":
    case "addToDeck":
      return typeof candidate.itemId === "string" && candidate.itemId.length > 0;
    case "showLibraryKind":
      return (
        candidate.kind === "song" || candidate.kind === "media" || candidate.kind === "slides"
      );
    case "openSetList":
    case "duplicateSetList":
    case "presentSetList":
      return typeof candidate.setListId === "string" && candidate.setListId.length > 0;
    case "saveSetList":
      return (
        (candidate.setListId === null ||
          (typeof candidate.setListId === "string" && candidate.setListId.length > 0)) &&
        typeof candidate.title === "string" &&
        typeof candidate.date === "string" &&
        isSetEntries(candidate.entries)
      );
    case "renameDevice":
      return typeof candidate.name === "string" && candidate.name.length <= 200;
    case "savePresentation":
      return (
        (candidate.presentationId === null ||
          (typeof candidate.presentationId === "string" && candidate.presentationId.length > 0)) &&
        typeof candidate.title === "string" &&
        isSlideDrafts(candidate.slides) &&
        (candidate.themeId === undefined ||
          candidate.themeId === null ||
          typeof candidate.themeId === "string") &&
        (candidate.reference === undefined ||
          candidate.reference === null ||
          (typeof candidate.reference === "string" && candidate.reference.length <= 200))
      );
    case "goTo":
      return Number.isInteger(candidate.position) && (candidate.position as number) >= 0;
    case "goToCue":
      return typeof candidate.cueId === "string" && candidate.cueId.length > 0;
    case "setBlank":
    case "toggleBlank":
      return isBlank(candidate.blank);
    default:
      return false;
  }
}

/**
 * More slides than any service will hold.
 *
 * A bound on the boundary rather than on the product. Nothing a person types
 * comes near it, and a renderer with a defect cannot hand main an unbounded
 * write. Imports go to the store directly and are not limited by this.
 */
const MOST_SLIDES = 2000;

function isSongFields(value: unknown): value is SongFields {
  if (typeof value !== "object" || value === null) return false;
  const fields = value as Record<string, unknown>;
  for (const name of ["author", "composer", "copyrightLine", "ccliNumber", "year", "defaultKey"]) {
    if (typeof fields[name] !== "string") return false;
  }
  return typeof fields["isPublicDomain"] === "boolean";
}

function isSlideDrafts(value: unknown): value is SlideDraft[] {
  if (!Array.isArray(value) || value.length > MOST_SLIDES) return false;
  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const slide = entry as {
      label?: unknown;
      body?: unknown;
      note?: unknown;
      sectionType?: unknown;
    };
    return (
      (slide.label === null || typeof slide.label === "string") &&
      typeof slide.body === "string" &&
      (slide.note === undefined || slide.note === null || typeof slide.note === "string") &&
      (slide.sectionType === undefined || typeof slide.sectionType === "string")
    );
  });
}

/** More items than a service will ever hold. */
const MOST_ENTRIES = 200;

function isSetEntries(value: unknown): value is SetEntryDraft[] {
  if (!Array.isArray(value) || value.length > MOST_ENTRIES) return false;
  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const one = entry as { kind?: unknown; itemId?: unknown; title?: unknown; notes?: unknown };
    return (
      (one.kind === "item" || one.kind === "marker") &&
      (one.itemId === null || typeof one.itemId === "string") &&
      typeof one.title === "string" &&
      (one.notes === undefined || one.notes === null || typeof one.notes === "string")
    );
  });
}

/** More orders than a song will ever be sung in. */
const MOST_ORDERS = 50;

function isOrderDrafts(value: unknown): value is OrderDraft[] {
  if (!Array.isArray(value) || value.length > MOST_ORDERS) return false;
  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const order = entry as { name?: unknown; sequence?: unknown; isDefault?: unknown };
    return (
      typeof order.name === "string" &&
      typeof order.isDefault === "boolean" &&
      Array.isArray(order.sequence) &&
      order.sequence.length <= MOST_SLIDES &&
      order.sequence.every((label) => typeof label === "string")
    );
  });
}

/**
 * A gradient as CSS.
 *
 * Here rather than in each renderer, so the output window and the editor's
 * preview cannot draw the same theme two ways.
 */
export function gradientCss(gradient: Gradient | null, fallback: string): string {
  if (gradient === null || gradient.stops.length < 2) return fallback;
  const stops = gradient.stops.join(", ");
  return gradient.kind === "radial"
    ? `radial-gradient(circle at 50% 42%, ${stops})`
    : `linear-gradient(${gradient.angle}deg, ${stops})`;
}

/** The API preload puts on the window. Typed here so both sides agree. */
export interface StageBridge {
  send(intent: Intent): void;
  onOutputState(listener: (state: OutputState) => void): () => void;
  onControlState(listener: (state: ControlState) => void): () => void;
  onEditorState(listener: (state: EditorState) => void): () => void;
  /** The church's logo as a data URL, or null where there is none (STG-22). */
  onLogo(listener: (logo: string | null) => void): () => void;
  hello(): Promise<{
    output: OutputState | null;
    control: ControlState | null;
    editor: EditorState | null;
  }>;
}

declare global {
  interface Window {
    hearth?: StageBridge;
  }
}
