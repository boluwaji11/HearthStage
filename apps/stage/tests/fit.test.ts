/**
 * STG-18, ST6.2, ST20.4.
 *
 * The fitting search, against a known model of text rather than a browser. A
 * monospace model is enough: what is being tested is the search and the shared
 * size, and a real font's metrics would make the expected numbers unreadable
 * without making the test stronger.
 */
import { describe, it, expect } from "vitest";
import { FitCache, largestFitting, safeBox, sectionSize, type Measure } from "../src/output/fit";

/** Monospace: every glyph half an em wide, every line `lineHeight` ems tall. */
function monospace(lineHeight = 1.3): Measure {
  return (lines, size) => ({
    width: Math.max(0, ...lines.map((line) => line.length)) * size * 0.5,
    height: lines.length * size * lineHeight,
  });
}

const box = { width: 1000, height: 600 };

describe("largestFitting", () => {
  it("takes the theme's size when it already fits", () => {
    const size = largestFitting(["short"], box, monospace(), { minPx: 10, maxPx: 80 });
    expect(size).toBe(80);
  });

  it("comes down until a long line fits", () => {
    // 120 characters at 1000px wide: 1000 / (120 * 0.5) is 16.6px.
    const line = "x".repeat(120);
    const size = largestFitting([line], box, monospace(), { minPx: 8, maxPx: 80 });
    expect(size).toBeGreaterThan(16);
    expect(size).toBeLessThanOrEqual(16.7);
    // And what it returns actually fits.
    expect(monospace()([line], size).width).toBeLessThanOrEqual(box.width + 0.5);
  });

  it("comes down for height as well as width", () => {
    const lines = Array.from({ length: 20 }, () => "x");
    const size = largestFitting(lines, box, monospace(), { minPx: 4, maxPx: 80 });
    // 20 lines at 1.3 line height in 600px is 23px.
    expect(size).toBeLessThanOrEqual(23.1);
    expect(monospace()(lines, size).height).toBeLessThanOrEqual(box.height + 0.5);
  });

  it("stops at the floor rather than shrinking past readable", () => {
    // ST20.4. Below the floor the words stop being readable from the back of
    // the room, so the floor is returned and the overflow becomes a problem to
    // report rather than something hidden by tiny text.
    const absurd = ["x".repeat(4000)];
    const size = largestFitting(absurd, box, monospace(), { minPx: 24, maxPx: 80 });
    expect(size).toBe(24);
  });

  it("takes the theme's size for no lines at all", () => {
    expect(largestFitting([], box, monospace(), { minPx: 10, maxPx: 80 })).toBe(80);
  });

  it("measures a handful of times rather than stepping a pixel at a time", () => {
    let calls = 0;
    const counted: Measure = (lines, size) => {
      calls += 1;
      return monospace()(lines, size);
    };
    largestFitting(["x".repeat(90)], box, counted, { minPx: 8, maxPx: 200 });
    // Binary search over 192px to half a pixel is nine steps, plus two probes.
    expect(calls).toBeLessThan(15);
  });
});

describe("sectionSize", () => {
  it("gives every slide in a section the same size, the smallest that fits", () => {
    // The case this exists for: a short first slide and a long second one. A
    // congregation reads a size jump between them as a mistake.
    const short = ["Amazing grace"];
    const long = ["x".repeat(120)];

    const shared = sectionSize([short, long], box, monospace(), { minPx: 8, maxPx: 80 });
    const aloneShort = largestFitting(short, box, monospace(), { minPx: 8, maxPx: 80 });
    const aloneLong = largestFitting(long, box, monospace(), { minPx: 8, maxPx: 80 });

    expect(aloneShort).toBe(80);
    expect(shared).toBe(aloneLong);
    expect(shared).toBeLessThan(aloneShort);
  });

  it("leaves a section that fits at the theme's size", () => {
    expect(sectionSize([["a"], ["b"]], box, monospace(), { minPx: 8, maxPx: 80 })).toBe(80);
  });

  it("takes the theme's size for an empty section", () => {
    expect(sectionSize([], box, monospace(), { minPx: 8, maxPx: 80 })).toBe(80);
  });
});

describe("FitCache", () => {
  it("measures once per section, theme and output size", () => {
    let calls = 0;
    const counted: Measure = (lines, size) => {
      calls += 1;
      return monospace()(lines, size);
    };
    const cache = new FitCache();
    const slides = [["x".repeat(90)]];
    const range = { minPx: 8, maxPx: 80 };

    const first = cache.resolve("section-a", "theme", slides, box, counted, range);
    const after = calls;
    const second = cache.resolve("section-a", "theme", slides, box, counted, range);

    expect(second).toBe(first);
    // No measuring at all the second time, which is the point: an advance
    // applies a number rather than running layout.
    expect(calls).toBe(after);
  });

  it("measures again when the output changes size", () => {
    const cache = new FitCache();
    const slides = [["x".repeat(90)]];
    const range = { minPx: 8, maxPx: 80 };

    const wide = cache.resolve("s", "theme", slides, { width: 1000, height: 600 }, monospace(), range);
    const narrow = cache.resolve("s", "theme", slides, { width: 500, height: 600 }, monospace(), range);
    expect(narrow).toBeLessThan(wide);
    expect(cache.size).toBe(2);
  });

  it("measures again when the theme changes", () => {
    const cache = new FitCache();
    cache.resolve("s", "one", [["x"]], box, monospace(), { minPx: 8, maxPx: 80 });
    cache.resolve("s", "two", [["x"]], box, monospace(), { minPx: 8, maxPx: 80 });
    expect(cache.size).toBe(2);
  });

  it("does not grow without limit", () => {
    const cache = new FitCache(4);
    for (let index = 0; index < 20; index += 1) {
      cache.resolve(`section-${index}`, "theme", [["x"]], box, monospace(), { minPx: 8, maxPx: 80 });
    }
    expect(cache.size).toBeLessThanOrEqual(4);
  });
});

describe("safeBox", () => {
  it("insets by a fraction of the shorter edge", () => {
    // A fraction of the shorter edge, so a wide screen does not end up with an
    // absurd left and right margin.
    expect(safeBox({ width: 1920, height: 1080 }, 0.075)).toEqual({
      width: 1920 - 1080 * 0.15,
      height: 1080 - 1080 * 0.15,
    });
  });

  it("never returns nothing, however big the inset", () => {
    const tiny = safeBox({ width: 100, height: 100 }, 0.9);
    expect(tiny.width).toBeGreaterThan(0);
    expect(tiny.height).toBeGreaterThan(0);
  });
});
