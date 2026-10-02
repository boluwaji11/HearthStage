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
  | { kind: "message"; lines: string[] }
  | { kind: "nothing" };

/**
 * The bits of a theme a renderer needs to paint a slide.
 *
 * Sizes are a proportion of output height rather than pixels, so one theme is
 * right on a 1080p projector and on a 4K foyer screen (ST8.2).
 */
export interface ThemeState {
  id: string;
  fontFamily: string;
  fontWeight: number;
  /** Cap height as a fraction of output height. At or above 0.04 (ST20.4). */
  textSize: number;
  lineHeight: number;
  colour: string;
  background: string;
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

/** One cue, as the control surface and the stage display list it. */
export interface CueView {
  id: string;
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
  cueIds: string[];
}

export interface OutputView {
  outputId: string;
  name: string;
  /** The display it is on, by name, so an operator can tell them apart. */
  display: string;
  live: boolean;
}

/** Everything the control surface shows. Also what the remote will show. */
export interface ControlState {
  revision: number;
  service: { id: string; title: string; date: string; source: "set_list" | "plan" } | null;
  groups: GroupView[];
  cues: CueView[];
  position: number;
  blank: Blank;
  outputs: OutputView[];
  /** Named at compile time, so an operator knows before the service (ST5.2). */
  problems: { code: string; detail: string }[];
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
  origin: "local" | "hearth";
}

/** One slide as a person has it on screen: a label, and a box of text. */
export interface SlideDraft {
  label: string | null;
  /** The box, as typed. Main splits it into lines, because the model decides. */
  body: string;
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
  colour: string;
  fontFamily: string;
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
    readOnly: boolean;
  } | null;
  /** What is wrong with the last save attempt, by code (STG-145). */
  problems: { code: string; detail: string }[];
  /** Which presentation is live on the output, where one is. */
  presentingId: string | null;
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
    }
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
    title?: unknown;
    slides?: unknown;
    themeId?: unknown;
  };

  switch (candidate.type) {
    case "advance":
    case "reverse":
    case "reload":
    case "openEditor":
    case "newPresentation":
      return true;
    case "presentNow":
      return typeof candidate.presentationId === "string" && candidate.presentationId.length > 0;
    case "openItem":
      return typeof candidate.itemId === "string" && candidate.itemId.length > 0;
    case "savePresentation":
      return (
        (candidate.presentationId === null ||
          (typeof candidate.presentationId === "string" && candidate.presentationId.length > 0)) &&
        typeof candidate.title === "string" &&
        isSlideDrafts(candidate.slides) &&
        (candidate.themeId === undefined ||
          candidate.themeId === null ||
          typeof candidate.themeId === "string")
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

function isSlideDrafts(value: unknown): value is SlideDraft[] {
  if (!Array.isArray(value) || value.length > MOST_SLIDES) return false;
  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const slide = entry as { label?: unknown; body?: unknown; note?: unknown };
    return (
      (slide.label === null || typeof slide.label === "string") &&
      typeof slide.body === "string" &&
      (slide.note === undefined || slide.note === null || typeof slide.note === "string")
    );
  });
}

/** The API preload puts on the window. Typed here so both sides agree. */
export interface StageBridge {
  send(intent: Intent): void;
  onOutputState(listener: (state: OutputState) => void): () => void;
  onControlState(listener: (state: ControlState) => void): () => void;
  onEditorState(listener: (state: EditorState) => void): () => void;
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
