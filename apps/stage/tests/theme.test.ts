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
import { DEFAULT_THEME } from "../src/main/session";

/** `contrast` parses its own arguments, so colours go in as written. */
function ratio(a: string, b: string): number {
  return contrast(a, b) as number;
}

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
