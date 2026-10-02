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
  kind: "lyric" | "scripture" | "marker";
  label: string | null;
  occurrence: number;
  occurrencesTotal: number;
  slideIndex: number;
  slideCount: number;
  /** First line, for a list. The whole slide goes down in `OutputState`. */
  preview: string | null;
}

export interface GroupView {
  id: string;
  title: string;
  kind: "lyric" | "scripture" | "marker";
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

export type Intent =
  | { type: "advance" }
  | { type: "reverse" }
  | { type: "goTo"; position: number }
  | { type: "goToCue"; cueId: string }
  | { type: "setBlank"; blank: Blank }
  | { type: "toggleBlank"; blank: Blank }
  | { type: "reload" };

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
  const candidate = value as { type?: unknown; position?: unknown; cueId?: unknown; blank?: unknown };

  switch (candidate.type) {
    case "advance":
    case "reverse":
    case "reload":
      return true;
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

/** The API preload puts on the window. Typed here so both sides agree. */
export interface StageBridge {
  send(intent: Intent): void;
  onOutputState(listener: (state: OutputState) => void): () => void;
  onControlState(listener: (state: ControlState) => void): () => void;
  hello(): Promise<{ output: OutputState | null; control: ControlState | null }>;
}

declare global {
  interface Window {
    hearth?: StageBridge;
  }
}
