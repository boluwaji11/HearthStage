/**
 * STG-1, R12.3.
 *
 * A key is read from two places, a person typing and an importer reading
 * somebody else's file, and both produce spellings a strict parser rejects. The
 * cases here are the ones that came out of real chord charts.
 */
import { describe, it, expect } from "vitest";
import { isKey, isMinor, parseKey, semitonesFromC, tonicOf, isTimeSignature } from "../src/keys";

describe("parseKey", () => {
  it("reads a key written properly", () => {
    expect(parseKey("G")).toBe("G");
    expect(parseKey("Bb")).toBe("Bb");
    expect(parseKey("F#")).toBe("F#");
  });

  it("reads the way a person types", () => {
    expect(parseKey("bb")).toBe("Bb");
    expect(parseKey("f#")).toBe("F#");
    expect(parseKey("  eb  ")).toBe("Eb");
  });

  it("reads the unicode accidentals a hymnal PDF carries", () => {
    expect(parseKey("E♭")).toBe("Eb");
    expect(parseKey("F♯m")).toBe("F#m");
  });

  it("reads the several ways people write minor", () => {
    expect(parseKey("Am")).toBe("Am");
    expect(parseKey("A minor")).toBe("Am");
    expect(parseKey("a min")).toBe("Am");
    expect(parseKey("C#m")).toBe("C#m");
    expect(parseKey("ebm")).toBe("Ebm");
  });

  it("refuses what it cannot read rather than guessing", () => {
    // A guessed key transposes a whole set wrongly, and nobody finds out until
    // the band is playing.
    expect(parseKey("H")).toBeNull();
    expect(parseKey("Gbb")).toBeNull();
    expect(parseKey("")).toBeNull();
    expect(parseKey("m")).toBeNull();
    expect(parseKey("key of G")).toBeNull();
  });
});

describe("the parts of a key", () => {
  it("separates the tonic from the mode", () => {
    expect(tonicOf("F#m")).toBe("F#");
    expect(tonicOf("F#")).toBe("F#");
    expect(isMinor("F#m")).toBe(true);
    expect(isMinor("F#")).toBe(false);
  });

  it("gives enharmonic spellings the same pitch class", () => {
    // The thing transposition depends on. C# and Db are one pitch and two
    // spellings, and a transposition that treats them as two pitches is wrong
    // by a semitone.
    expect(semitonesFromC("C#")).toBe(semitonesFromC("Db"));
    expect(semitonesFromC("F#m")).toBe(semitonesFromC("Gb"));
    expect(semitonesFromC("C")).toBe(0);
    expect(semitonesFromC("B")).toBe(11);
  });

  it("recognises every key it claims to accept", () => {
    expect(isKey("G")).toBe(true);
    expect(isKey("Abm")).toBe(true);
    expect(isKey("Hm")).toBe(false);
  });
});

describe("isTimeSignature", () => {
  it("accepts what churches actually play in", () => {
    for (const value of ["4/4", "3/4", "6/8", "12/8", "2/2", "7/8"]) {
      expect(isTimeSignature(value), value).toBe(true);
    }
  });

  it("refuses the rest", () => {
    for (const value of ["4", "4/3", "0/4", "four four", "4/4 "]) {
      expect(isTimeSignature(value), value).toBe(false);
    }
  });
});
