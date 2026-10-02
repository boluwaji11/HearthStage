/**
 * STG-5, R12.6, ST2.6, ST11.3.
 *
 * Chord symbols, and moving them to another key.
 *
 * The same function transposes the chart the platform prints, the chart on the
 * music stand view, and the chords over lyrics on Stage's confidence monitor.
 * They have to agree, because a guitarist reading Bb while the keyboard reads B
 * is audible to the whole room.
 *
 * **Spelling is chosen by the target key, rather than by a fixed preference.**
 * Transposing G to Bb gives Eb and not D#, because a chart in Bb with a D# in it
 * is read twice by every player who sees it. Keys that carry flats get flats and
 * keys that carry sharps get sharps, and the table of which is which is written
 * out below rather than computed, so it can be read and checked.
 */

import { isTonic, semitonesFromC, type Key, type Tonic } from "./keys";

/** Pitch class to name, as a sharp key spells it. */
const SHARP_NAMES: Tonic[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** Pitch class to name, as a flat key spells it. */
const FLAT_NAMES: Tonic[] = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

/**
 * Which way each key spells its accidentals.
 *
 * Written out for all 34 keys rather than derived from a count of sharps and
 * flats, because the derivation is the part that goes subtly wrong and this
 * table can be checked against a sheet of manuscript paper.
 */
const SPELLING: Record<Key, "sharp" | "flat"> = {
  // Majors with sharps, and C which has neither.
  C: "sharp",
  G: "sharp",
  D: "sharp",
  A: "sharp",
  E: "sharp",
  B: "sharp",
  "F#": "sharp",
  "C#": "sharp",
  "G#": "sharp",
  "D#": "sharp",
  "A#": "sharp",
  // Majors with flats.
  F: "flat",
  Bb: "flat",
  Eb: "flat",
  Ab: "flat",
  Db: "flat",
  Gb: "flat",
  // Minors with sharps.
  Am: "sharp",
  Em: "sharp",
  Bm: "sharp",
  "F#m": "sharp",
  "C#m": "sharp",
  "G#m": "sharp",
  "D#m": "sharp",
  "A#m": "sharp",
  Cm: "flat",
  // Minors with flats.
  Dm: "flat",
  Gm: "flat",
  Fm: "flat",
  Bbm: "flat",
  Ebm: "flat",
  Abm: "flat",
  Dbm: "flat",
  Gbm: "flat",
};

function spellingFor(key: Key): "sharp" | "flat" {
  return SPELLING[key] ?? "sharp";
}

function nameFor(pitchClass: number, key: Key): Tonic {
  const index = ((pitchClass % 12) + 12) % 12;
  const names = spellingFor(key) === "flat" ? FLAT_NAMES : SHARP_NAMES;
  return names[index] as Tonic;
}

export interface Chord {
  root: Tonic;
  /**
   * Everything after the root: "m", "7", "maj7", "sus4", "m7b5", "add9".
   * Carried through transposition untouched, because it says nothing about
   * pitch.
   */
  quality: string;
  /** The note after a slash, which is a pitch and so is transposed too. */
  bass: Tonic | null;
}

/**
 * Reads a chord symbol.
 *
 * The root is a letter and an optional accidental, taken greedily, which is the
 * convention every chart follows: `Bb5` is a B flat with a 5 on it rather than a
 * B with a flat five. A symbol it cannot read returns null and is left exactly
 * as written, so `N.C.`, a repeat mark and a chart's own shorthand survive a
 * transposition unharmed.
 */
export function parseChord(text: string): Chord | null {
  const trimmed = text.trim().replace(/♯/g, "#").replace(/♭/g, "b");
  if (trimmed === "") return null;

  const match = /^([A-G])([#b]?)(.*)$/.exec(trimmed);
  if (match === null) return null;

  const [, letter = "", accidental = "", remainder = ""] = match;
  const root = `${letter}${accidental}`;
  if (!isTonic(root)) return null;

  const slash = remainder.lastIndexOf("/");
  if (slash === -1) {
    return { root, quality: remainder, bass: null };
  }

  const bassText = remainder.slice(slash + 1).trim();
  const bassMatch = /^([A-G])([#b]?)$/.exec(bassText);
  if (bassMatch === null) {
    // A slash that is not a bass note, for example "G/riff". Left whole.
    return { root, quality: remainder, bass: null };
  }

  const bass = `${bassMatch[1] ?? ""}${bassMatch[2] ?? ""}`;
  if (!isTonic(bass)) return { root, quality: remainder, bass: null };

  return { root, quality: remainder.slice(0, slash), bass };
}

export function formatChord(chord: Chord): string {
  return `${chord.root}${chord.quality}${chord.bass === null ? "" : `/${chord.bass}`}`;
}

/** Semitones from one key to another, upward, 0 to 11. */
export function semitonesBetween(from: Key, to: Key): number {
  return (((semitonesFromC(to) - semitonesFromC(from)) % 12) + 12) % 12;
}

export function transposeChord(chord: Chord, semitones: number, target: Key): Chord {
  return {
    root: nameFor(semitonesFromC(chord.root as Key) + semitones, target),
    quality: chord.quality,
    bass: chord.bass === null ? null : nameFor(semitonesFromC(chord.bass as Key) + semitones, target),
  };
}

/**
 * One chord symbol, moved from one key to another.
 *
 * Anything unreadable comes back unchanged, which is the behaviour a chart full
 * of a church's own annotations needs.
 */
export function transposeSymbol(symbol: string, from: Key, to: Key): string {
  const chord = parseChord(symbol);
  if (chord === null) return symbol;
  return formatChord(transposeChord(chord, semitonesBetween(from, to), to));
}

/* ------------------------------------------------------------------ */
/* ChordPro                                                            */
/* ------------------------------------------------------------------ */

/** A run of lyric text, with the chord that sits above its first character. */
export interface ChordProPart {
  /** The parsed chord, where the bracket held one. */
  chord: Chord | null;
  /** What was between the brackets, whether it parsed or not. */
  symbol: string | null;
  text: string;
}

export type ChordProLine =
  | { kind: "directive"; name: string; value: string | null; raw: string }
  | { kind: "comment"; raw: string }
  | { kind: "lyric"; parts: ChordProPart[]; raw: string }
  | { kind: "blank"; raw: string };

/**
 * Reads a ChordPro chart into lines.
 *
 * Directives, comments and blank lines are kept as they were written, because a
 * chart is a document a church has edited and a parser that normalises it hands
 * back something its owner does not recognise.
 */
export function parseChordPro(source: string): ChordProLine[] {
  return source.split(/\r?\n/).map((raw) => parseLine(raw));
}

function parseLine(raw: string): ChordProLine {
  const trimmed = raw.trim();

  if (trimmed === "") return { kind: "blank", raw };
  if (trimmed.startsWith("#")) return { kind: "comment", raw };

  const directive = /^\{\s*([^:}]+?)\s*(?::\s*(.*?)\s*)?\}$/.exec(trimmed);
  if (directive !== null) {
    return {
      kind: "directive",
      name: (directive[1] ?? "").toLowerCase(),
      value: directive[2] ?? null,
      raw,
    };
  }

  const parts: ChordProPart[] = [];
  const pattern = /\[([^\]]*)\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const before = raw.slice(cursor, match.index);
    if (before !== "") {
      // Lyrics ahead of the first chord, which is how a line starting mid-word
      // is written.
      parts.push({ chord: null, symbol: null, text: before });
    }
    const symbol = match[1] ?? "";
    cursor = match.index + match[0].length;
    const nextBracket = raw.indexOf("[", cursor);
    const text = raw.slice(cursor, nextBracket === -1 ? undefined : nextBracket);
    parts.push({ chord: parseChord(symbol), symbol, text });
    cursor += text.length;
    pattern.lastIndex = cursor;
  }

  if (parts.length === 0) {
    return { kind: "lyric", parts: [{ chord: null, symbol: null, text: raw }], raw };
  }

  return { kind: "lyric", parts, raw };
}

/**
 * A whole chart in another key.
 *
 * The `{key: ...}` directive is rewritten where there is one, so the chart says
 * what it is. Everything else about the document survives: spacing, comments,
 * section directives, and any symbol the parser could not read.
 */
export function transposeChordPro(source: string, from: Key, to: Key): string {
  const semitones = semitonesBetween(from, to);

  return parseChordPro(source)
    .map((line) => {
      if (line.kind === "directive") {
        if (line.name === "key" || line.name === "k") {
          return line.raw.replace(/:\s*.*?\s*\}/, `: ${to}}`);
        }
        return line.raw;
      }
      if (line.kind !== "lyric") return line.raw;

      return line.parts
        .map((part) => {
          if (part.symbol === null) return part.text;
          const moved =
            part.chord === null
              ? part.symbol
              : formatChord(transposeChord(part.chord, semitones, to));
          return `[${moved}]${part.text}`;
        })
        .join("");
    })
    .join("\n");
}

/** The key a chart declares, where it declares one. */
export function keyOf(source: string): string | null {
  for (const line of parseChordPro(source)) {
    if (line.kind === "directive" && (line.name === "key" || line.name === "k")) {
      return line.value;
    }
  }
  return null;
}

/** Every distinct chord symbol in a chart, in the order they first appear. */
export function chordsIn(source: string): string[] {
  const seen: string[] = [];
  for (const line of parseChordPro(source)) {
    if (line.kind !== "lyric") continue;
    for (const part of line.parts) {
      if (part.symbol !== null && part.symbol !== "" && !seen.includes(part.symbol)) {
        seen.push(part.symbol);
      }
    }
  }
  return seen;
}

/**
 * A chart as two rows per line, chords sitting over the words they belong to.
 *
 * This is what a printed chart and the confidence monitor both show (ST11.3),
 * so the alignment is computed once here rather than twice in two renderers.
 * Returns the lines to draw, with the chord row first.
 */
export function chordsOverLyrics(source: string): string[] {
  const output: string[] = [];

  for (const line of parseChordPro(source)) {
    if (line.kind === "directive" || line.kind === "comment") {
      output.push(line.raw);
      continue;
    }
    if (line.kind === "blank") {
      output.push("");
      continue;
    }

    let chordRow = "";
    let lyricRow = "";

    for (const part of line.parts) {
      const symbol =
        part.symbol === null ? "" : part.chord === null ? part.symbol : formatChord(part.chord);

      if (symbol !== "") {
        // The column this chord wants is wherever its syllable starts. Where
        // the previous chord was wider than the words under it, the chord moves
        // right by one and the words move with it, so two chords never run
        // together as "Gmaj7C" and a chord never drifts off its own word.
        let column = lyricRow.length;
        if (chordRow.length > 0 && column <= chordRow.length) {
          column = chordRow.length + 1;
        }
        chordRow = chordRow.padEnd(column, " ") + symbol;
        lyricRow = lyricRow.padEnd(column, " ");
      }

      lyricRow += part.text;
    }

    if (chordRow.trim() !== "") output.push(chordRow.replace(/\s+$/, ""));
    output.push(lyricRow.replace(/\s+$/, ""));
  }

  return output;
}
