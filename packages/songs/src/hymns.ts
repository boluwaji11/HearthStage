/**
 * STG-10, ST1.2. The hymns Stage offers a church that has none.
 *
 * The words come from the Open Hymnal Project, which states the copyright of
 * every hymn part by part. `scripts/import-open-hymnal.ts` keeps only the ones
 * whose words are in the public domain, and `hymns.json` is what it wrote. The
 * script is run by hand and the file is committed, so the application reaches
 * nothing at runtime and a church with no connection gets the same library.
 *
 * They are offered rather than installed. A church that has its own songs
 * should not have to clear two hundred hymns out of the way to find them.
 */

import { isKey, type Key } from "./keys";
import type { Arrangement, Song, SongSection, WholeSong } from "./types";
import data from "./hymns.json";

/** A hymn as it is shipped: the words, and what a church needs to credit it. */
export interface BundledHymn {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  key: string | null;
  timeSignature: string | null;
  /** "8 6 8 6", the syllable count of each line. Printed on a hymn board. */
  metre: string | null;
  themes: string[];
  verses: string[][];
}

const HYMNS = data as BundledHymn[];

/** How many are on offer, for a screen that says so before writing any. */
export const BUNDLED_HYMN_COUNT = HYMNS.length;

function songOf(hymn: BundledHymn): Song {
  const key: Key | null = hymn.key !== null && isKey(hymn.key) ? hymn.key : null;
  return {
    id: hymn.id,
    origin: "local",
    title: hymn.title,
    alternateTitles: [],
    author: hymn.author,
    composer: null,
    publisher: null,
    year: hymn.year,
    ccliNumber: null,
    copyrightLine: "Public Domain",
    isPublicDomain: true,
    themes: hymn.themes,
    tempoBpm: null,
    timeSignature: hymn.timeSignature,
    typicalDurationSeconds: null,
    defaultKey: key,
    primaryLanguage: "en",
    lastUsedAt: null,
  };
}

/**
 * The hymns as records, built fresh each call.
 *
 * Built rather than stored, because the shipped file holds the words and the
 * schema holds everything else, and a change to the schema should not mean
 * regenerating a quarter of a megabyte of data.
 */
export function bundledHymns(): WholeSong[] {
  return HYMNS.map((hymn): WholeSong => {
    const song = songOf(hymn);
    const labels = hymn.verses.map((_, index) => `V${index + 1}`);

    const sections: SongSection[] = hymn.verses.map((lines, index) => ({
      id: `${hymn.id}:section:${index + 1}`,
      songId: hymn.id,
      sectionType: "verse",
      label: labels[index] as string,
      sortOrder: index,
      lines,
      language: "en",
      translationOf: null,
    }));

    // Every verse once, in the order it is printed. A church that sings four of
    // the six makes a second order for it (STG-9).
    const arrangement: Arrangement = {
      id: `${hymn.id}:arrangement:1`,
      songId: hymn.id,
      name: "As written",
      key: song.defaultKey ?? "C",
      tempoBpm: null,
      sequence: labels,
      chordpro: null,
      isDefault: true,
    };

    return { song, sections, arrangements: [arrangement], media: [] };
  });
}
