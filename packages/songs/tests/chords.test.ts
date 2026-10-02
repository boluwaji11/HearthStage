/**
 * STG-5, R12.6.
 *
 * The acceptance criterion reads: a chart in G transposes to Bb correctly for
 * all chords including slash chords and sharps, verified against a fixture set.
 *
 * The fixture set is the table below: 60 chord symbols across six key changes,
 * covering every quality a worship chart uses, slash chords with natural and
 * altered bass notes, and the cases where the spelling has to follow the target
 * key rather than a fixed preference.
 *
 * **It is a corpus of symbols rather than 50 real charts, deliberately.** Real
 * charts are copyrighted, and Hearth ships no copyrighted content. The two
 * public-domain hymn charts in the fixtures are transposed whole, as the
 * document-level check.
 */
import { describe, it, expect } from "vitest";
import {
  chordsIn,
  chordsOverLyrics,
  formatChord,
  keyOf,
  parseChord,
  parseChordPro,
  semitonesBetween,
  transposeChordPro,
  transposeSymbol,
} from "../src/chords";
import { amazingGrace, holyHolyHoly } from "../src/fixtures";
import type { Key } from "../src/keys";

/** [symbol, from, to, expected] */
const CORPUS: [string, Key, Key, string][] = [
  // G to Bb, the criterion's own example. Three semitones up, into a flat key.
  ["G", "G", "Bb", "Bb"],
  ["C", "G", "Bb", "Eb"],
  ["D", "G", "Bb", "F"],
  ["Em", "G", "Bb", "Gm"],
  ["Am", "G", "Bb", "Cm"],
  ["Bm", "G", "Bb", "Dm"],
  ["G7", "G", "Bb", "Bb7"],
  ["Cmaj7", "G", "Bb", "Ebmaj7"],
  ["Dsus4", "G", "Bb", "Fsus4"],
  ["Am7", "G", "Bb", "Cm7"],
  ["D/F#", "G", "Bb", "F/A"],
  ["C/E", "G", "Bb", "Eb/G"],
  ["G/B", "G", "Bb", "Bb/D"],
  ["F#m", "G", "Bb", "Am"],
  ["F#m7b5", "G", "Bb", "Am7b5"],
  ["Cadd9", "G", "Bb", "Ebadd9"],
  ["Dsus2", "G", "Bb", "Fsus2"],
  ["C6", "G", "Bb", "Eb6"],
  ["D9", "G", "Bb", "F9"],
  ["G13", "G", "Bb", "Bb13"],
  ["Bdim", "G", "Bb", "Ddim"],
  ["Caug", "G", "Bb", "Ebaug"],
  ["D7#9", "G", "Bb", "F7#9"],
  ["Gmaj7/B", "G", "Bb", "Bbmaj7/D"],
  ["A#", "G", "Bb", "Db"],

  // G to A. Two semitones, into a sharp key, so F# rather than Gb.
  ["G", "G", "A", "A"],
  ["C", "G", "A", "D"],
  ["E", "G", "A", "F#"],
  ["Em", "G", "A", "F#m"],
  ["F#m", "G", "A", "G#m"],
  ["D/F#", "G", "A", "E/G#"],
  ["Bm7", "G", "A", "C#m7"],
  ["Am", "G", "A", "Bm"],

  // A to Eb. Six semitones, into a flat key, so Gb rather than F#.
  ["A", "A", "Eb", "Eb"],
  ["C", "A", "Eb", "Gb"],
  ["D", "A", "Eb", "Ab"],
  ["E", "A", "Eb", "Bb"],
  ["F#m", "A", "Eb", "Cm"],
  ["A/C#", "A", "Eb", "Eb/G"],
  ["Bm", "A", "Eb", "Fm"],

  // Eb to E. One semitone, flat key to sharp key, the respelling case.
  ["Eb", "Eb", "E", "E"],
  ["Ab", "Eb", "E", "A"],
  ["Bb", "Eb", "E", "B"],
  ["Cm", "Eb", "E", "C#m"],
  ["Gm", "Eb", "E", "G#m"],
  ["Eb/G", "Eb", "E", "E/G#"],
  ["Db", "Eb", "E", "D"],

  // C to F#, a tritone into a sharp key.
  ["C", "C", "F#", "F#"],
  ["F", "C", "F#", "B"],
  ["G", "C", "F#", "C#"],
  ["Am", "C", "F#", "D#m"],
  ["Dm7", "C", "F#", "G#m7"],
  ["G/B", "C", "F#", "C#/F"],
  ["Em", "C", "F#", "A#m"],

  // D to Db, down a semitone into a flat key, which is how a key is dropped
  // for a congregation that cannot reach it.
  ["D", "D", "Db", "Db"],
  ["A", "D", "Db", "Ab"],
  ["G", "D", "Db", "Gb"],
  ["Bm", "D", "Db", "Bbm"],
  ["F#m", "D", "Db", "Fm"],
  ["D/F#", "D", "Db", "Db/F"],
  ["Esus4", "D", "Db", "Ebsus4"],

  // No change asked for, which has to be a no-op.
  ["F#m7b5/C", "G", "G", "F#m7b5/C"],
  ["Bb", "Bb", "Bb", "Bb"],
];

describe("the chord corpus", () => {
  it("has enough in it to be worth calling a fixture set", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(50);
  });

  it.each(CORPUS)("%s from %s to %s is %s", (symbol, from, to, expected) => {
    expect(transposeSymbol(symbol, from, to)).toBe(expected);
  });

  it("never produces a double accidental", () => {
    // The failure mode of naive transposition: A# plus a semitone becoming B#,
    // or Gb minus one becoming Fb. Neither appears on a chart a volunteer can
    // read.
    for (const [symbol, from, to] of CORPUS) {
      expect(transposeSymbol(symbol, from, to)).not.toMatch(/[A-G](##|bb|#b|b#)/);
    }
  });
});

describe("spelling follows the target key", () => {
  it("gives a flat key flats", () => {
    // Eb rather than D#, because a chart in Bb with a D# in it is read twice by
    // every player who sees it.
    expect(transposeSymbol("C", "G", "Bb")).toBe("Eb");
    expect(transposeSymbol("C", "A", "Eb")).toBe("Gb");
  });

  it("gives a sharp key sharps", () => {
    expect(transposeSymbol("E", "G", "A")).toBe("F#");
    expect(transposeSymbol("Am", "C", "F#")).toBe("D#m");
  });

  it("round-trips between two keys that spell the same pitches", () => {
    for (const symbol of ["G", "C", "D/F#", "Em7", "G7", "Cmaj7"]) {
      const there = transposeSymbol(symbol, "G", "Bb");
      expect(transposeSymbol(there, "Bb", "G")).toBe(symbol);
    }
  });
});

describe("parseChord", () => {
  it("takes the root greedily, which is what every chart means", () => {
    // Bb5 is a B flat with a 5 on it. A parser reading B with a flat five is
    // wrong about every flat chord in every chart.
    expect(parseChord("Bb5")).toEqual({ root: "Bb", quality: "5", bass: null });
    expect(parseChord("Bm7b5")).toEqual({ root: "B", quality: "m7b5", bass: null });
  });

  it("separates a bass note and leaves anything else after a slash alone", () => {
    expect(parseChord("D/F#")).toEqual({ root: "D", quality: "", bass: "F#" });
    expect(parseChord("G/riff")).toEqual({ root: "G", quality: "/riff", bass: null });
  });

  it("reads the unicode accidentals a hymnal PDF carries", () => {
    expect(formatChord(parseChord("E♭maj7") as never)).toBe("Ebmaj7");
  });

  it("returns null for what is not a chord, so a chart's own marks survive", () => {
    for (const text of ["N.C.", "%", "x4", "(hold)", ""]) {
      expect(parseChord(text), text).toBeNull();
    }
  });

  it("leaves an unreadable symbol exactly as written when transposing", () => {
    expect(transposeSymbol("N.C.", "G", "Bb")).toBe("N.C.");
    expect(transposeSymbol("x4", "G", "Bb")).toBe("x4");
  });
});

describe("semitonesBetween", () => {
  it("counts upward, and treats a drop as the equivalent rise", () => {
    expect(semitonesBetween("G", "Bb")).toBe(3);
    expect(semitonesBetween("G", "G")).toBe(0);
    expect(semitonesBetween("D", "Db")).toBe(11);
    expect(semitonesBetween("Bb", "A")).toBe(11);
  });
});

describe("parseChordPro", () => {
  it("tells directives, comments, blanks and lyrics apart", () => {
    const lines = parseChordPro("{title: A Song}\n# a note to self\n\n[G]Words");
    expect(lines.map((line) => line.kind)).toEqual(["directive", "comment", "blank", "lyric"]);
    expect(lines[0]).toMatchObject({ name: "title", value: "A Song" });
  });

  it("splits a lyric line into chords and the words under them", () => {
    const line = parseChordPro("A[G]mazing [C]grace")[0];
    expect(line?.kind).toBe("lyric");
    if (line?.kind !== "lyric") return;
    expect(line.parts.map((part) => [part.symbol, part.text])).toEqual([
      [null, "A"],
      ["G", "mazing "],
      ["C", "grace"],
    ]);
  });

  it("handles a line with no chords at all", () => {
    const line = parseChordPro("Just words")[0];
    if (line?.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.parts).toEqual([{ chord: null, symbol: null, text: "Just words" }]);
  });

  it("finds the declared key and the chords used", () => {
    const chart = amazingGrace.arrangements[0]?.chordpro ?? "";
    expect(keyOf(chart)).toBe("G");
    expect(chordsIn(chart)).toEqual(["G", "G7", "C", "D/F#", "D"]);
  });
});

describe("transposing a whole chart", () => {
  const chart = amazingGrace.arrangements[0]?.chordpro ?? "";

  it("moves every chord and rewrites the key directive", () => {
    const moved = transposeChordPro(chart, "G", "Bb");
    expect(keyOf(moved)).toBe("Bb");
    expect(chordsIn(moved)).toEqual(["Bb", "Bb7", "Eb", "F/A", "F"]);
  });

  it("leaves the document otherwise exactly as its owner wrote it", () => {
    const moved = transposeChordPro(chart, "G", "Bb");
    // Same number of lines, same comments, same section directives, same words.
    expect(moved.split("\n")).toHaveLength(chart.split("\n").length);
    expect(moved).toContain("{comment: NEW BRITAIN. Public domain.}");
    expect(moved).toContain("{start_of_verse: V1}");
    expect(moved).toContain("mazing grace! how ");
  });

  it("keeps the words byte for byte", () => {
    // Everything but the chords and the key directive, which is the one thing
    // a transposition is meant to change.
    const words = (source: string) =>
      parseChordPro(source)
        .filter((line) => line.kind === "lyric")
        .map((line) => (line.kind === "lyric" ? line.parts.map((p) => p.text).join("") : ""))
        .join("\n");
    expect(words(transposeChordPro(chart, "G", "Eb"))).toBe(words(chart));
  });

  it("transposes the second hymn, which has a minor chord and a slash", () => {
    const hymn = holyHolyHoly.arrangements[0]?.chordpro ?? "";
    expect(chordsIn(hymn)).toEqual(["D", "A", "G", "Bm", "F#m", "D/F#"]);
    expect(chordsIn(transposeChordPro(hymn, "D", "F"))).toEqual([
      "F",
      "C",
      "Bb",
      "Dm",
      "Am",
      "F/A",
    ]);
  });

  it("is a no-op when the key does not change", () => {
    expect(transposeChordPro(chart, "G", "G")).toBe(chart);
  });
});

describe("chordsOverLyrics", () => {
  it("puts a chord above the syllable it belongs to", () => {
    const [chords = "", lyrics = ""] = chordsOverLyrics("A[G]mazing [C]grace");
    expect(lyrics).toBe("Amazing grace");
    // Asserted as columns rather than as a string with hand counted spaces,
    // because the column is the thing that has to be right.
    expect(chords.indexOf("G")).toBe(lyrics.indexOf("mazing"));
    expect(chords.indexOf("C")).toBe(lyrics.indexOf("grace"));
  });

  it("stops a wide chord colliding with the next one", () => {
    // "Gmaj7" is wider than the "A " under it, so the words move along rather
    // than the two chords running together as "Gmaj7C".
    const [chords = "", lyrics = ""] = chordsOverLyrics("[Gmaj7]A [C]b");
    expect(chords).toBe("Gmaj7 C");
    expect(chords.indexOf("C")).toBe(lyrics.indexOf("b"));
  });

  it("keeps every chord above its own word across a real hymn line", () => {
    const [chords = "", lyrics = ""] = chordsOverLyrics(
      "[D]Holy, holy, [A]holy! [D]Lord God Al[G]mighty!",
    );
    expect(lyrics).toBe("Holy, holy, holy! Lord God Almighty!");
    expect(chords.indexOf("G")).toBe(lyrics.indexOf("mighty!"));
    expect(chords.indexOf("A")).toBe(lyrics.indexOf("holy!"));
  });

  it("keeps directives and blank lines where they were", () => {
    const rows = chordsOverLyrics("{key: G}\n\n[G]Words");
    expect(rows[0]).toBe("{key: G}");
    expect(rows[1]).toBe("");
  });

  it("gives a line with no chords one row", () => {
    expect(chordsOverLyrics("Just words")).toEqual(["Just words"]);
  });
});
