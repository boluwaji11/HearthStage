/**
 * STG-3, R12.4, ST6.1.
 *
 * Where a section breaks. A congregation reading half a sentence is the most
 * common fault in presented lyrics, so the rules are tested rather than trusted.
 */
import { describe, it, expect } from "vitest";
import { blankSection } from "../src/fixtures";
import { splitBilingual, splitSection } from "../src/slides";

const lines = (count: number): string[] =>
  Array.from({ length: count }, (unused, index) => `Line ${index + 1}`);

describe("splitSection", () => {
  it("leaves a section that fits as one slide", () => {
    const slides = splitSection(blankSection({ lines: lines(4) }), { maxLines: 4 });
    expect(slides).toHaveLength(1);
    expect(slides[0]?.lines).toEqual(lines(4));
    expect(slides[0]?.count).toBe(1);
  });

  it("breaks between two lines, keeping every line whole", () => {
    const slides = splitSection(blankSection({ lines: lines(8) }), { maxLines: 4 });
    expect(slides.map((slide) => slide.lines)).toEqual([
      ["Line 1", "Line 2", "Line 3", "Line 4"],
      ["Line 5", "Line 6", "Line 7", "Line 8"],
    ]);
    // Every line arrives somewhere, whole, once.
    expect(slides.flatMap((slide) => slide.lines)).toEqual(lines(8));
  });

  it("evens out a split rather than leaving one line stranded", () => {
    // Five lines at a limit of four is four and one, which looks like a
    // mistake on a wall. Three and two reads as a decision.
    const slides = splitSection(blankSection({ lines: lines(5) }), { maxLines: 4 });
    expect(slides.map((slide) => slide.lines.length)).toEqual([3, 2]);
  });

  it("puts the longer slide first when the split is uneven", () => {
    const slides = splitSection(blankSection({ lines: lines(7) }), { maxLines: 4 });
    expect(slides.map((slide) => slide.lines.length)).toEqual([4, 3]);
  });

  it("keeps the plain arithmetic when balancing is turned off", () => {
    const slides = splitSection(blankSection({ lines: lines(5) }), {
      maxLines: 4,
      balanceLastSlide: false,
    });
    expect(slides.map((slide) => slide.lines.length)).toEqual([4, 1]);
  });

  it("breaks at a blank line before the line count forces it", () => {
    // A church that writes stanza gaps into a section means them.
    const section = blankSection({
      lines: ["One", "Two", "", "Three", "Four"],
    });
    const slides = splitSection(section, { maxLines: 4 });
    expect(slides.map((slide) => slide.lines)).toEqual([
      ["One", "Two"],
      ["Three", "Four"],
    ]);
  });

  it("ignores stanza gaps when asked to", () => {
    const section = blankSection({ lines: ["One", "Two", "", "Three", "Four"] });
    const slides = splitSection(section, { maxLines: 4, breakOnBlankLine: false });
    expect(slides).toHaveLength(1);
    expect(slides[0]?.lines).toEqual(["One", "Two", "Three", "Four"]);
  });

  it("numbers each slide within its section", () => {
    const slides = splitSection(blankSection({ lines: lines(9) }), { maxLines: 4 });
    expect(slides.map((slide) => slide.index)).toEqual([0, 1, 2]);
    expect(slides.every((slide) => slide.count === 3)).toBe(true);
  });

  it("returns nothing for a section with no words in it", () => {
    // A blank slide mid-song looks like a fault in the projector. The validator
    // reports the empty section separately.
    expect(splitSection(blankSection({ lines: [] }))).toEqual([]);
    expect(splitSection(blankSection({ lines: ["  ", ""] }))).toEqual([]);
  });

  it("survives a limit of one, and a nonsense limit", () => {
    expect(splitSection(blankSection({ lines: lines(3) }), { maxLines: 1 })).toHaveLength(3);
    expect(splitSection(blankSection({ lines: lines(3) }), { maxLines: 0 })).toHaveLength(3);
  });
});

describe("splitBilingual", () => {
  it("pairs a primary slide with its translation", () => {
    const english = blankSection({ id: "en", lines: ["One", "Two"] });
    const spanish = blankSection({ id: "es", language: "es", lines: ["Uno", "Dos"] });
    const slides = splitBilingual(english, spanish, { maxLines: 4 });
    expect(slides).toHaveLength(1);
    expect(slides[0]?.lines).toEqual(["One", "Two"]);
    expect(slides[0]?.translation).toEqual(["Uno", "Dos"]);
  });

  it("renders the primary alone where the translation runs out", () => {
    // A section missing its translation shows one language rather than an empty
    // half (ST17.1 acceptance).
    const english = blankSection({ id: "en", lines: lines(8) });
    const spanish = blankSection({ id: "es", language: "es", lines: ["Uno", "Dos"] });
    const slides = splitBilingual(english, spanish, { maxLines: 4 });
    expect(slides).toHaveLength(2);
    expect(slides[0]?.translation).toEqual(["Uno", "Dos"]);
    expect(slides[1]?.translation).toBeNull();
  });

  it("renders the primary alone when there is no translation at all", () => {
    const slides = splitBilingual(blankSection({ lines: ["One"] }), null);
    expect(slides[0]?.translation).toBeNull();
  });
});
