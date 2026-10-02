/**
 * STG-1. The song schema from [PRD.md section 9.4](../../../PRD.md), as types.
 *
 * Three properties of this shape are load bearing, and each one exists for a
 * reason that only shows up later:
 *
 * 1. **Lyrics are an ordered set of labelled sections.** Stage renders a slide
 *    per section. A single text blob would need a parser, a parser would need an
 *    import step, and deleting the import step is the whole product idea.
 *    `SongSection.lines` holds one line per element, and a validator refuses a
 *    line containing a newline (R12.4).
 * 2. **An arrangement's sequence is data.** `["V1","C","V2","C","B","C","C"]`
 *    builds the slide order with nobody clicking anything, and the same
 *    sequence drives the printed chart (R12.5).
 * 3. **Translations are section aligned.** A bilingual slide is a join on
 *    `translationOf` rather than a second song (R12.8).
 *
 * Storage is deliberately absent. The platform holds these in Postgres with a
 * `tenant_id` and row-level security, Stage holds them in SQLite with no tenant
 * at all, and the column names are each store's business. What both agree on is
 * this shape.
 */

import type { Key } from "./keys";

export const SECTION_TYPES = [
  "intro",
  "verse",
  "pre_chorus",
  "chorus",
  "bridge",
  "tag",
  "instrumental",
  "ending",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * One labelled block of lyrics.
 *
 * `label` is what a sequence refers to, so it is the section's identity to a
 * human: "V1", "C", "B2". It is unique within a song, and a sequence entry that
 * matches no label is a fatal problem rather than a skipped slide.
 */
export interface SongSection {
  id: string;
  songId: string;
  sectionType: SectionType;
  /** "V1", "C", "B2". Unique within the song. */
  label: string;
  sortOrder: number;
  /** Ordered lines of text. One line per element. */
  lines: string[];
  /** ISO 639-1, two letters. The song names its primary language. */
  language: string;
  /** The id of the section in the primary language this one translates. */
  translationOf: string | null;
}

/**
 * A way of performing a song: a key, a tempo, and an order of sections.
 *
 * A song has several. "Sunday 2026" and "Acoustic" are the same lyrics in a
 * different order, which is why the sequence lives here rather than on the song.
 */
export interface Arrangement {
  id: string;
  songId: string;
  name: string;
  key: Key;
  tempoBpm: number | null;
  /** Ordered section labels. A label may repeat. */
  sequence: string[];
  /** The full chart, transposable. ChordPro arrives with STG-5. */
  chordpro: string | null;
  isDefault: boolean;
}

export const MEDIA_KINDS = ["reference_audio", "practice_track", "video", "chart_pdf"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * A file attached to an arrangement.
 *
 * `storageKey` is a platform storage key or a local content hash depending on
 * which product is holding it, so it is a string here and resolved by whoever
 * reads it.
 */
export interface ArrangementMedia {
  id: string;
  arrangementId: string;
  kind: MediaKind;
  storageKey: string;
  durationSeconds: number | null;
}

/**
 * Where a song came from, which decides who may write it.
 *
 * PRD-STAGE section 2. A `local` song was typed into Stage or imported there,
 * and Stage owns it. A `hearth` song was synced from the platform, and is
 * read-only on the laptop. One writer per record, so nothing merges.
 *
 * The platform's own rows are all `hearth` from its point of view, which is why
 * this field has a default rather than being asked for on every insert.
 */
export const SONG_ORIGINS = ["local", "hearth"] as const;

export type SongOrigin = (typeof SONG_ORIGINS)[number];

export interface Song {
  id: string;
  origin: SongOrigin;
  title: string;
  alternateTitles: string[];
  author: string | null;
  composer: string | null;
  publisher: string | null;
  year: number | null;
  /** CCLI song number. Digits, as a string, because it is an identifier. */
  ccliNumber: string | null;
  copyrightLine: string | null;
  isPublicDomain: boolean;
  themes: string[];
  tempoBpm: number | null;
  /** "4/4", "6/8". Open set, validated rather than typed. */
  timeSignature: string | null;
  typicalDurationSeconds: number | null;
  defaultKey: Key | null;
  /** ISO 639-1. Sections in this language are the primary ones. */
  primaryLanguage: string;
  /** RFC 3339. Maintained from usage rather than typed. */
  lastUsedAt: string | null;
}

/**
 * A song with everything needed to present it.
 *
 * The sync contract returns a song whole, because a song without its sections
 * is nothing anyone can use and two round trips to assemble one is waste. The
 * renderer, the importers and the deck compiler all take this.
 */
export interface WholeSong {
  song: Song;
  sections: SongSection[];
  arrangements: Arrangement[];
  media: ArrangementMedia[];
}

export const USAGE_SOURCES = ["platform", "stage"] as const;

export type UsageSource = (typeof USAGE_SOURCES)[number];

/**
 * One performance of one song, which is what a CCLI report is made of.
 *
 * Small churches are fined for failing to report, and no free tool does this,
 * so the row is written when a song is actually shown rather than when a plan
 * is opened (R12.9, R12.10, ST18.2).
 *
 * The nullable references are the honest part. An unpaired Stage has a set list
 * and no service occurrence. A song called from the floor and absent from the
 * plan has no plan item, and that is exactly the usage a church forgets.
 */
export interface SongUsage {
  id: string;
  songId: string;
  arrangementId: string | null;
  /** The platform's plan item, where this came from a plan. */
  planItemId: string | null;
  /** The platform's service occurrence, where there was one. */
  serviceOccurrenceId: string | null;
  /** Stage's own set list, where the church is unpaired. */
  setListId: string | null;
  /** The date in the church's own timezone, as YYYY-MM-DD. */
  usedOn: string;
  keyUsed: Key | null;
  source: UsageSource;
}
