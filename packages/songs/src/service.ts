/**
 * STG-4, R11.2, ST5.1, ST5.3.
 *
 * What a service is, as data.
 *
 * One shape serves two sources. A **set list** is built inside Stage by a church
 * that presents without the platform, and a **plan** comes from Hearth over the
 * sync API. They carry the same information in the same order, so the deck
 * compiler takes one type and the renderer cannot tell which it was handed.
 *
 * That is the whole reason this type lives in the shared package rather than in
 * Stage. The platform's plan editor and Stage's set list editor are different
 * screens over one structure.
 */

import type { Key } from "./keys";

/**
 * A note on an item, optionally addressed to one position.
 *
 * R11.6. The drummer sees the drummer's note. A note addressed to a position is
 * shown to that position and to the operator, and never to the room.
 */
export interface ItemNote {
  /** null is a note for everybody. */
  position: string | null;
  body: string;
}

/** One verse of a passage, kept separately so slides can break on verses. */
export interface Verse {
  number: number;
  text: string;
}

export interface SongItem {
  type: "song";
  id: string;
  sortOrder: number;
  title: string;
  durationSeconds: number | null;
  notes: ItemNote[];
  songId: string;
  /** null takes the song's default arrangement. */
  arrangementId: string | null;
  /** This Sunday's key, where it differs from the arrangement's (ST5.6). */
  keyOverride: Key | null;
}

export interface ScriptureItem {
  type: "scripture";
  id: string;
  sortOrder: number;
  title: string;
  durationSeconds: number | null;
  notes: ItemNote[];
  reference: string;
  translation: string;
  /**
   * The resolved text. Stage holds public-domain translations itself, and a
   * paired church receives licensed text under its own licence (R11.5, ST7.6).
   * Either way the words are here before the service, so no lookup happens at
   * 10:31 and no internet is involved.
   */
  verses: Verse[];
}

export const MARKER_KINDS = [
  "sermon",
  "prayer",
  "offering",
  "announcement",
  "media",
  "welcome",
  "communion",
  "custom",
] as const;

export type MarkerKind = (typeof MARKER_KINDS)[number];

/**
 * An item that puts nothing on the wall.
 *
 * ST5.4. The sermon is in the deck because the operator's position in the deck
 * has to match the service's position in the room. Leaving it out is how an
 * operator loses their place during the notices.
 */
export interface MarkerItem {
  type: "marker";
  id: string;
  sortOrder: number;
  title: string;
  durationSeconds: number | null;
  notes: ItemNote[];
  kind: MarkerKind;
}

export type ServiceItem = SongItem | ScriptureItem | MarkerItem;

export interface ServicePlan {
  id: string;
  /** Where it came from, which decides who may edit it. */
  source: "set_list" | "plan";
  title: string;
  /** The service date in the church's timezone, YYYY-MM-DD. */
  date: string;
  /** RFC 3339, where a start time is known. */
  startsAt: string | null;
  items: ServiceItem[];
}

/** Items in the order they are presented, whatever order they are stored in. */
export function orderedItems(plan: ServicePlan): ServiceItem[] {
  return [...plan.items].sort((left, right) => left.sortOrder - right.sortOrder);
}

/** The planned length of a service, which is the number a plan editor shows (R11.3). */
export function plannedSeconds(plan: ServicePlan): number {
  return plan.items.reduce((total, item) => total + (item.durationSeconds ?? 0), 0);
}

/**
 * The notes one position should see: the global ones, plus their own.
 *
 * R11.6 acceptance. A volunteer sees notes addressed to them and not notes
 * addressed to somebody else.
 */
export function notesFor(item: ServiceItem, position: string | null): ItemNote[] {
  return item.notes.filter(
    (note) => note.position === null || (position !== null && note.position === position),
  );
}
