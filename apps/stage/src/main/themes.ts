/**
 * STG-148, ST8.1, ST8.2. The looks Stage ships with.
 *
 * **A theme is data** (ST8.2): a font, sizes as a proportion of output height,
 * colours, alignment, a safe area, a shadow and a transition. No code, so a
 * theme can be stored, synced from the platform (ST8.5) and edited without a
 * release (ST8.6).
 *
 * **Four rather than one**, because a church presents in more than one room.
 * The sanctuary with the lights down and the lobby screen in daylight are
 * different problems, and a church that cannot answer the second one with a
 * theme answers it by turning the projector up.
 *
 * Every one of them clears 7:1 against its own background and against black,
 * which is what a cover leaves behind. That is asserted by a test rather than
 * by care, because the next person to add a theme will be choosing colours they
 * like.
 */

import type { ThemeState } from "@hearth/stage-protocol";

const SERIF =
  '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

const SANS =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif';

/**
 * The one a church uses without touching anything (ST8.1).
 *
 * `textSize` is cap height at 0.072, which clears the 0.04 legibility floor in
 * ST20.4 with room to spare, because the floor is a floor rather than a target.
 */
export const DEFAULT_THEME: ThemeState = {
  id: "hearth-default",
  fontFamily: SERIF,
  fontWeight: 500,
  textSize: 0.072,
  lineHeight: 1.28,
  colour: "oklch(0.985 0.003 75)",
  background: "oklch(0.142 0.008 75)",
  textAlign: "center",
  verticalAlign: "middle",
  safeArea: 0.075,
  transitionMs: 200,
  textShadow: "0 0.08em 0.3em oklch(0 0 0 / 0.55)",
};

/** Notices and a sermon outline, where a serif reads as a hymn board. */
const PLAIN: ThemeState = {
  ...DEFAULT_THEME,
  id: "hearth-plain",
  fontFamily: SANS,
  fontWeight: 500,
  textSize: 0.066,
  lineHeight: 1.35,
};

/**
 * Dark words on a light ground, for a screen in a lit room.
 *
 * A lobby display and an overflow room are read in daylight, where a dark slide
 * is a mirror. The shadow comes off, because a shadow under dark text on a
 * light ground is dirt.
 */
const DAYLIGHT: ThemeState = {
  ...DEFAULT_THEME,
  id: "hearth-daylight",
  fontFamily: SANS,
  fontWeight: 500,
  colour: "oklch(0.185 0.01 75)",
  background: "oklch(0.967 0.005 75)",
  textShadow: null,
};

/**
 * The one for a projector that has lost its contrast.
 *
 * Bigger, heavier, pure white on black. A church with a fifteen year old
 * projector in a room with three windows has this problem and no budget, and
 * telling them to buy a projector is the answer every other product gives.
 */
const STRONG: ThemeState = {
  ...DEFAULT_THEME,
  id: "hearth-strong",
  fontFamily: SANS,
  fontWeight: 600,
  textSize: 0.085,
  lineHeight: 1.22,
  colour: "#ffffff",
  background: "#000000",
  textShadow: "0 0.06em 0.22em rgba(0, 0, 0, 0.9)",
};

export interface BuiltInTheme {
  theme: ThemeState;
  /** What it is called in the picker. */
  name: string;
}

export const BUILT_IN_THEMES: BuiltInTheme[] = [
  { theme: DEFAULT_THEME, name: "Hearth" },
  { theme: PLAIN, name: "Plain" },
  { theme: DAYLIGHT, name: "Daylight" },
  { theme: STRONG, name: "Strong" },
];

const BY_ID = new Map(BUILT_IN_THEMES.map((entry) => [entry.theme.id, entry.theme]));

/**
 * The theme an id names, or the default.
 *
 * A presentation can hold the id of a theme this build does not have, because a
 * library outlives a release and a synced theme may be missing. Falling back to
 * the default puts the words on the screen in the wrong font, which beats
 * putting nothing on the screen.
 */
export function themeFor(themeId: string | null | undefined): ThemeState {
  if (themeId === null || themeId === undefined) return DEFAULT_THEME;
  return BY_ID.get(themeId) ?? DEFAULT_THEME;
}

export function hasTheme(themeId: string): boolean {
  return BY_ID.has(themeId);
}
