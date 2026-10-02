/**
 * STG-148, ST8.1, ST8.2, ST9.1. The looks Stage ships with.
 *
 * **A theme is data** (ST8.2): a font, sizes as a proportion of output height,
 * colours, a ground, alignment, a safe area, a shadow and a transition. No
 * code, so a theme can be stored, synced from the platform (ST8.5) and edited
 * without a release (ST8.6).
 *
 * **Four rather than one**, because a church presents in more than one room.
 * The sanctuary with the lights down and the lobby screen in daylight are
 * different problems, and a church that cannot answer the second one with a
 * theme answers it by turning the projector up.
 *
 * **The ground has depth in it** (ST9.1). A flat fill behind twelve words is
 * what free church software looks like, and on a nine foot screen it reads as a
 * document rather than as a slide. These use gradients, which cost nothing and
 * need no files. A church's own photographs and video arrive with the media
 * library in STG-151 and STG-67, and that is the thing these are standing in
 * for rather than competing with.
 *
 * Every one of them clears 7:1 against its ground **and against every stop of
 * its gradient**, which is the part a gradient makes easy to get wrong. That is
 * asserted by a test rather than by care, because the next person to add a
 * theme will be choosing colours they like.
 */

import type { ThemeState } from "@hearth/stage-protocol";

const SERIF =
  '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

const SANS =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif';

/**
 * The one a church uses without touching anything (ST8.1).
 *
 * Warm ink with a glow behind the words, so the centre of a wide screen holds
 * the eye and the corners fall away. `textSize` is cap height at 0.072, which
 * clears the 0.04 legibility floor in ST20.4 with room to spare, because the
 * floor is a floor rather than a target.
 */
export const DEFAULT_THEME: ThemeState = {
  id: "hearth-default",
  fontFamily: SERIF,
  fontWeight: 500,
  textSize: 0.072,
  lineHeight: 1.3,
  colour: "oklch(0.985 0.004 80)",
  background: "oklch(0.148 0.012 70)",
  gradient: {
    kind: "radial",
    angle: 0,
    stops: ["oklch(0.238 0.028 68)", "oklch(0.148 0.012 70)", "oklch(0.108 0.01 70)"],
  },
  textAlign: "center",
  verticalAlign: "middle",
  safeArea: 0.075,
  transitionMs: 200,
  textShadow: "0 0.07em 0.3em oklch(0 0 0 / 0.6)",
};

/**
 * Notices and a sermon outline.
 *
 * A serif reads as a hymn board, which is wrong for "Church lunch, the 12th".
 * Sans, ranged left, on a cool ground that is clearly a different thing from
 * the singing, so the room knows the moment has changed without being told.
 */
const PLAIN: ThemeState = {
  ...DEFAULT_THEME,
  id: "hearth-plain",
  fontFamily: SANS,
  fontWeight: 500,
  textSize: 0.064,
  lineHeight: 1.4,
  colour: "oklch(0.975 0.006 255)",
  background: "oklch(0.188 0.035 262)",
  gradient: {
    kind: "linear",
    angle: 155,
    stops: ["oklch(0.268 0.052 268)", "oklch(0.168 0.032 258)"],
  },
  textAlign: "left",
  textShadow: "0 0.06em 0.26em oklch(0 0 0 / 0.5)",
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
  textSize: 0.068,
  lineHeight: 1.34,
  colour: "oklch(0.235 0.022 55)",
  background: "oklch(0.963 0.008 85)",
  gradient: {
    kind: "linear",
    angle: 165,
    stops: ["oklch(0.985 0.006 95)", "oklch(0.934 0.016 72)"],
  },
  textAlign: "center",
  textShadow: null,
};

/**
 * The one for a projector that has lost its contrast.
 *
 * Bigger, heavier, pure white on black, and flat on purpose: a gradient here
 * spends the contrast this theme exists to keep. A church with a fifteen year
 * old projector in a room with three windows has this problem and no budget,
 * and telling them to buy a projector is the answer every other product gives.
 */
const STRONG: ThemeState = {
  ...DEFAULT_THEME,
  id: "hearth-strong",
  fontFamily: SANS,
  fontWeight: 600,
  textSize: 0.088,
  lineHeight: 1.22,
  colour: "#ffffff",
  background: "#000000",
  gradient: null,
  textAlign: "center",
  textShadow: "0 0.05em 0.2em rgba(0, 0, 0, 0.9)",
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
