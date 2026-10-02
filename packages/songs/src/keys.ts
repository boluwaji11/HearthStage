/**
 * STG-1, R12.3, R12.5.
 *
 * A key is typed rather than left as a string, because the two places a key is
 * read from are a human typing into a form and an importer reading somebody
 * else's file, and both produce "bb", "F#min" and "E♭" as readily as "Bb". A
 * string type pushes that mess into the transposition code, where a wrong key
 * is a chart in the wrong key on a music stand.
 */

/**
 * The tonics that appear as a key on a worship chart.
 *
 * Seventeen spellings of twelve pitch classes. Cb, Fb, B# and E# are real in
 * theory and absent in practice, so they are left out: transposition emits the
 * common spelling for a pitch class rather than the theoretically tidy one,
 * because the chart is read by a volunteer guitarist at 09:50.
 */
export const TONICS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
] as const;

export type Tonic = (typeof TONICS)[number];

/** A key, major or minor. "G", "Bb", "F#m", "C#m". */
export type Key = Tonic | `${Tonic}m`;

const TONIC_SET = new Set<string>(TONICS);

/** Semitones above C, for every spelling we accept. */
const PITCH_CLASS: Record<Tonic, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export function isTonic(value: string): value is Tonic {
  return TONIC_SET.has(value);
}

export function isKey(value: string): value is Key {
  if (isTonic(value)) return true;
  return value.endsWith("m") && isTonic(value.slice(0, -1));
}

/** The tonic of a key, with any minor marker removed. */
export function tonicOf(key: Key): Tonic {
  return (key.endsWith("m") ? key.slice(0, -1) : key) as Tonic;
}

export function isMinor(key: Key): boolean {
  return key.endsWith("m");
}

/** Semitones above C. Used by transposition, which arrives with STG-5. */
export function semitonesFromC(key: Key): number {
  return PITCH_CLASS[tonicOf(key)];
}

/**
 * Reads a key the way it was actually written down.
 *
 * Accepts the unicode accidentals, lower case, the several ways people write
 * minor, and surrounding whitespace. Returns null rather than guessing, because
 * a key we cannot read is a problem to report (`validate.ts`) rather than a
 * silent default that transposes a whole set wrongly.
 */
export function parseKey(input: string): Key | null {
  let text = input.trim().replace(/♯/g, "#").replace(/♭/g, "b");
  if (text.length === 0) return null;

  // "A minor", "a min", "Am", "a-moll". The marker is stripped first so what
  // remains is only a tonic, however it was spelled.
  let minor = false;
  const minorMarker = /[\s-]*(minor|min|moll|m)$/i;
  const match = minorMarker.exec(text);
  if (match && match.index > 0) {
    minor = true;
    text = text.slice(0, match.index);
  }

  text = text.trim();
  if (text.length === 0) return null;

  // "bb" and "f#" are how this gets typed. Only the letter's case carries
  // meaning, and a "b" after it always means flat.
  const letter = text[0]?.toUpperCase() ?? "";
  const accidental = text.slice(1).toLowerCase();
  if (accidental !== "" && accidental !== "#" && accidental !== "b") return null;

  const tonic = `${letter}${accidental}`;
  if (!isTonic(tonic)) return null;
  return minor ? (`${tonic}m` as Key) : tonic;
}

/**
 * Time signatures, as they are written. "4/4", "6/8", "12/8".
 *
 * A separate concept from a key, and validated rather than typed, because the
 * set is open: a church singing in 7/8 is unusual and allowed.
 */
const TIME_SIGNATURE = /^([1-9][0-9]?)\/(1|2|4|8|16|32)$/;

export function isTimeSignature(value: string): boolean {
  return TIME_SIGNATURE.test(value);
}
