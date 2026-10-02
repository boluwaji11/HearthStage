/**
 * STG-16, ST20.4, ST8.1.
 *
 * The output legibility floor, checked against the theme's own values rather
 * than against a screenshot. A screenshot test says a slide was fine on the day
 * it ran. This says the theme can never be wrong.
 *
 * The maths is a port of the platform's own audit, kept in `@hearth/colour`
 * because Stage is a separate repository now. See that package for why.
 */
import { describe, it, expect } from "vitest";
import { contrast } from "@hearth/colour";
import { BUILT_IN_THEMES, DEFAULT_THEME, themeFor, hasTheme } from "../src/main/themes";

/** `contrast` parses its own arguments, so colours go in as written. */
function ratio(a: string, b: string): number {
  return contrast(a, b) as number;
}

describe.each(BUILT_IN_THEMES)("the $name theme", ({ theme }) => {
  it("clears 7:1 against its own ground", () => {
    // The station floor from docs/design-system.md, which is the right bar for
    // an output: a sign read from the back of a dark room.
    expect(ratio(theme.colour, theme.background)).toBeGreaterThanOrEqual(7);
  });

  it("clears 7:1 against every stop of its gradient", () => {
    // The part a gradient makes easy to get wrong. A light patch halfway down a
    // dark ground is where the words stop being readable, and the flat colour
    // says nothing about it.
    for (const stop of theme.gradient?.stops ?? []) {
      expect(ratio(theme.colour, stop), stop).toBeGreaterThanOrEqual(7);
    }
  });

  it("names at least two stops where it has a gradient", () => {
    if (theme.gradient === null) return;
    expect(theme.gradient.stops.length).toBeGreaterThanOrEqual(2);
  });

  it("has cap height at or above 4% of output height", () => {
    expect(theme.textSize).toBeGreaterThanOrEqual(0.04);
  });

  it("has body weight at or above 400", () => {
    expect(theme.fontWeight).toBeGreaterThanOrEqual(400);
  });

  it("keeps a safe area, because projectors clip edges", () => {
    expect(theme.safeArea).toBeGreaterThan(0);
    expect(theme.safeArea).toBeLessThan(0.2);
  });

  it("dissolves rather than cuts, and quickly enough to feel immediate", () => {
    expect(theme.transitionMs).toBeGreaterThan(0);
    expect(theme.transitionMs).toBeLessThanOrEqual(400);
  });

  it("has an id nothing else has", () => {
    expect(BUILT_IN_THEMES.filter((other) => other.theme.id === theme.id)).toHaveLength(1);
  });
});

describe("choosing a theme by id", () => {
  it("finds every built-in one", () => {
    for (const entry of BUILT_IN_THEMES) {
      expect(themeFor(entry.theme.id)).toBe(entry.theme);
      expect(hasTheme(entry.theme.id)).toBe(true);
    }
  });

  it("falls back to the default for an id this build does not have", () => {
    // A library outlives a release, so a presentation can name a theme that is
    // gone. Wrong font beats blank screen.
    expect(themeFor("from-a-later-version")).toBe(DEFAULT_THEME);
    expect(hasTheme("from-a-later-version")).toBe(false);
  });

  it("falls back to the default for nothing at all", () => {
    expect(themeFor(null)).toBe(DEFAULT_THEME);
  });
});

describe("the built-in theme", () => {
  it("clears 7:1 against its own background", () => {
    // The station floor from docs/design-system.md, which is the right bar for
    // an output: a sign read from the back of a dark room.
    expect(ratio(DEFAULT_THEME.colour, DEFAULT_THEME.background)).toBeGreaterThanOrEqual(7);
  });

  it("clears 7:1 against black, which is what a cover leaves behind", () => {
    expect(ratio(DEFAULT_THEME.colour, "#000000")).toBeGreaterThanOrEqual(7);
  });

  it("has cap height at or above 4% of output height", () => {
    expect(DEFAULT_THEME.textSize).toBeGreaterThanOrEqual(0.04);
  });

  it("has body weight at or above 400", () => {
    // Legible beats fashionable. Body text never under 400.
    expect(DEFAULT_THEME.fontWeight).toBeGreaterThanOrEqual(400);
  });

  it("keeps a safe area, because projectors clip edges", () => {
    expect(DEFAULT_THEME.safeArea).toBeGreaterThan(0);
    expect(DEFAULT_THEME.safeArea).toBeLessThan(0.2);
  });

  it("carries a shadow, for the day a video background arrives", () => {
    expect(DEFAULT_THEME.textShadow).not.toBeNull();
  });

  it("dissolves rather than cuts, and quickly enough to feel immediate", () => {
    expect(DEFAULT_THEME.transitionMs).toBeGreaterThan(0);
    expect(DEFAULT_THEME.transitionMs).toBeLessThanOrEqual(400);
  });
});
