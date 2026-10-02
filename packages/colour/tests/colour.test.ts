/**
 * The arithmetic, checked against values that can be verified by hand.
 */
import { describe, it, expect } from "vitest";
import { ACROSS_A_ROOM, contrast, luminance, parseColour } from "../src/index";

describe("parseColour", () => {
  it("reads hex", () => {
    expect(parseColour("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColour("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("reads oklch, including an alpha it ignores", () => {
    const white = parseColour("oklch(1 0 0)");
    expect(white.r).toBeCloseTo(1, 2);
    expect(parseColour("oklch(0.5 0 0 / 0.5)").r).toBeCloseTo(parseColour("oklch(0.5 0 0)").r, 6);
  });

  it("refuses what it cannot read", () => {
    expect(() => parseColour("rebeccapurple")).toThrow(/Cannot read the colour/);
  });
});

describe("contrast", () => {
  it("gives black on white the maximum", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("gives a colour against itself the minimum", () => {
    expect(contrast("#808080", "#808080")).toBeCloseTo(1, 6);
  });

  it("does not care which way round the pair is", () => {
    expect(contrast("#111111", "#eeeeee")).toBeCloseTo(contrast("#eeeeee", "#111111"), 6);
  });

  it("takes a parsed colour as well as a string", () => {
    expect(contrast(parseColour("#000000"), "#ffffff")).toBeCloseTo(21, 1);
  });

  it("agrees with the platform on the stone ramp", () => {
    // The same pair the platform's own audit checks, so the two
    // implementations can be shown to agree.
    const ratio = contrast("oklch(0.985 0.003 75)", "oklch(0.142 0.008 75)");
    expect(ratio).toBeGreaterThan(ACROSS_A_ROOM);
  });
});

describe("luminance", () => {
  it("clamps out of gamut rather than returning nonsense", () => {
    expect(luminance({ r: 4, g: -2, b: 0.5 })).toBeLessThanOrEqual(1);
    expect(luminance({ r: 4, g: -2, b: 0.5 })).toBeGreaterThanOrEqual(0);
  });
});
