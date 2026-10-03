/**
 * STG-51, ST6.8. A typo corrected on the wall, put back where it came from.
 *
 * The thing worth defending is that everything around the corrected slide
 * survives: the blank lines somebody typed are the shape of the verse, and a
 * correction that reflowed them would be a different song.
 */
import { describe, it, expect } from "vitest";
import { correctSlide, splitLines } from "../src/slides";

const LIMITS = { maxLines: 2 };

describe("correcting one slide of a section", () => {
  const verse = ["Amazing grace", "how sweet the sound", "", "That saved a wretch", "like me"];

  it("rewrites the slide named", () => {
    const after = correctSlide(verse, 0, ["Amazing grace,", "how sweet the sound"], LIMITS);
    expect(after).toEqual([
      "Amazing grace,",
      "how sweet the sound",
      "",
      "That saved a wretch",
      "like me",
    ]);
  });

  it("keeps the blank line, which is the shape somebody typed", () => {
    const after = correctSlide(verse, 1, ["That saved a wretch,", "like me"], LIMITS);
    expect(after[2]).toBe("");
    expect(after.slice(3)).toEqual(["That saved a wretch,", "like me"]);
  });

  it("takes a slide down to fewer lines", () => {
    const after = correctSlide(verse, 1, ["That saved a wretch like me"], LIMITS);
    expect(after).toEqual([
      "Amazing grace",
      "how sweet the sound",
      "",
      "That saved a wretch like me",
    ]);
  });

  it("takes a slide up to more lines", () => {
    const after = correctSlide(verse, 0, ["Amazing", "grace, how", "sweet the sound"], LIMITS);
    expect(after.slice(0, 3)).toEqual(["Amazing", "grace, how", "sweet the sound"]);
    expect(after.slice(3)).toEqual(["", "That saved a wretch", "like me"]);
  });

  it("corrects a later slide where an earlier one repeats the same words", () => {
    const repeated = ["Hallelujah", "Hallelujah", "", "Hallelujah", "Hallelujah"];
    const after = correctSlide(repeated, 1, ["Hallelujah!", "Hallelujah!"], { maxLines: 2 });
    expect(after).toEqual(["Hallelujah", "Hallelujah", "", "Hallelujah!", "Hallelujah!"]);
  });

  it("leaves the block alone for a slide it does not have", () => {
    expect(correctSlide(verse, 9, ["x"], LIMITS)).toEqual(verse);
    expect(correctSlide(verse, -1, ["x"], LIMITS)).toEqual(verse);
  });

  it("leaves the block it was given alone", () => {
    const before = [...verse];
    correctSlide(verse, 0, ["x"], LIMITS);
    expect(verse).toEqual(before);
  });

  it("splits back into the same slides, with the correction in it", () => {
    const after = correctSlide(verse, 1, ["That saved a wretch,", "like me"], LIMITS);
    expect(splitLines(after, LIMITS).map((slide) => slide.lines)).toEqual([
      ["Amazing grace", "how sweet the sound"],
      ["That saved a wretch,", "like me"],
    ]);
  });
});
