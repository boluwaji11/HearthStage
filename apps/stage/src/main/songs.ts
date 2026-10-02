/**
 * STG-7, ST2.1, ST2.2. A song, typed in.
 *
 * The schema is the spine (the platform PRD section 9.4): lyrics are ordered
 * labelled sections, and an arrangement's sequence is data. So this turns boxes
 * on a screen into those records, and the two awkward parts are both here.
 *
 * **A label is generated when nobody types one.** A label is what a sequence
 * refers to, so a song has to have them, and a volunteer typing their first song
 * has never heard of one. Sections get `V1`, `V2`, `C`, `B` from their type and
 * their order, and the slide title field overwrites them for anybody who cares.
 *
 * **Nothing on the screen asks what kind of section this is.** A song is a thing
 * with slides, the same as the notices, and a volunteer typing their first one
 * should meet one editor. The type rides along on the draft untouched, so
 * editing the words of an imported song leaves its choruses as choruses, and a
 * section nobody has typed a type for is a verse. Setting types is part of
 * arrangements, STG-9, where they start to matter.
 *
 * **A song gets an order whether or not anybody asked.** A song with no order
 * cannot present, and the order nobody asked for is the obvious one: every
 * section once, in the order they were typed. A church that wants a second one
 * makes it in the window, and STG-9 is what carries it here.
 */

import {
  SECTION_TYPES,
  isKey,
  labelsFor,
  type Arrangement,
  type Key,
  type SectionType,
  type Song,
  type SongSection,
  type WholeSong,
} from "@hearth/songs";
import type { OrderDraft, SlideDraft, SongFields } from "@hearth/stage-protocol";

export { labelsFor };

/** The arrangement a typed song gets, which STG-9 lets a church change. */
export const DEFAULT_ARRANGEMENT_NAME = "As written";

const TYPES = new Set<string>(SECTION_TYPES);

export function fieldsOf(song: Song): SongFields {
  return {
    author: song.author ?? "",
    composer: song.composer ?? "",
    copyrightLine: song.copyrightLine ?? "",
    ccliNumber: song.ccliNumber ?? "",
    year: song.year === null ? "" : String(song.year),
    isPublicDomain: song.isPublicDomain,
    defaultKey: song.defaultKey ?? "",
  };
}

/** A song's sections as the boxes the editor shows. */
export function sectionDrafts(whole: WholeSong): SlideDraft[] {
  return [...whole.sections]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((section) => ({
      label: section.label,
      body: section.lines.join("\n"),
      // Carried through the window without being shown, so editing the words
      // leaves an imported song's structure alone.
      sectionType: section.sectionType,
    }));
}

/**
 * A song's orders as the window shows them (STG-9, ST2.3).
 *
 * Default first, which is the order the store returns them in, because the one
 * that presents is the one a person is looking for.
 */
export function orderDrafts(whole: WholeSong): OrderDraft[] {
  return whole.arrangements.map((arrangement) => ({
    name: arrangement.name,
    sequence: [...arrangement.sequence],
    isDefault: arrangement.isDefault,
  }));
}

function typeOf(draft: SlideDraft): SectionType {
  const given = draft.sectionType ?? "";
  return TYPES.has(given) ? (given as SectionType) : "verse";
}

/** The fields a song has that nothing on this screen asks about, yet. */
function blankSong(id: string): Song {
  return {
    id,
    origin: "local",
    title: "",
    alternateTitles: [],
    author: null,
    composer: null,
    publisher: null,
    year: null,
    ccliNumber: null,
    copyrightLine: null,
    isPublicDomain: false,
    themes: [],
    tempoBpm: null,
    timeSignature: null,
    typicalDurationSeconds: null,
    defaultKey: null,
    primaryLanguage: "en",
    lastUsedAt: null,
  };
}

export interface SongDraft {
  id: string;
  title: string;
  fields: SongFields;
  sections: SlideDraft[];
  /** The ways it is sung (STG-9). Absent keeps the record's own. */
  orders?: OrderDraft[];
  /** The record being replaced, where there is one. */
  existing?: WholeSong | null;
}

/**
 * The records a typed song becomes.
 *
 * Validation is the store's job, so this builds what it was given rather than
 * refusing anything. A song with no sections comes back with none, and the
 * store says why it cannot be saved.
 */
export function songFrom(draft: SongDraft): WholeSong {
  const { id, fields } = draft;
  const previous = draft.existing ?? null;

  const usable = draft.sections.filter((section) => section.body.trim() !== "");
  const labels = labelsFor(usable);

  const key: Key | null = isKey(fields.defaultKey) ? fields.defaultKey : null;
  const year = /^[0-9]{3,4}$/.test(fields.year.trim()) ? Number(fields.year.trim()) : null;

  const song: Song = {
    ...(previous?.song ?? blankSong(id)),
    id,
    origin: "local",
    title: draft.title.trim(),
    author: blankToNull(fields.author),
    composer: blankToNull(fields.composer),
    copyrightLine: blankToNull(fields.copyrightLine),
    ccliNumber: blankToNull(fields.ccliNumber),
    year,
    isPublicDomain: fields.isPublicDomain,
    defaultKey: key,
  };

  const sections: SongSection[] = usable.map((section, index) => {
    const label = labels[index] as string;
    // Matched by label, because a label is a section's identity to a person and
    // the only thing that survives the trip through a window that shows neither
    // ids nor languages. Everything this screen does not ask about is carried
    // across from the record being replaced.
    const before = previous?.sections.find((candidate) => candidate.label === label) ?? null;

    return {
      id: before?.id ?? `${id}:section:${index + 1}`,
      songId: id,
      sectionType: section.sectionType === undefined ? (before?.sectionType ?? "verse") : typeOf(section),
      label,
      sortOrder: index,
      lines: section.body
        .split(/\r\n|\r|\n/)
        .map((line) => line.replace(/\s+$/, ""))
        .filter((line) => line.trim() !== ""),
      // A translated section keeps its language and what it translates. The
      // editor shows neither, so regenerating them would turn a church's
      // bilingual hymn into an English verse nobody asked for (R12.8, ST17.1).
      language: before?.language ?? previous?.song.primaryLanguage ?? "en",
      translationOf: before?.translationOf ?? null,
    };
  });

  return {
    song,
    sections,
    arrangements:
      sections.length === 0 ? [] : ordersInto(id, draft.orders, labels, key, previous),
    media: [],
  };
}

/**
 * The orders a song is sung in (STG-9, ST2.3).
 *
 * Three things happen here rather than in the window.
 *
 * **A title the song no longer has comes out of the sequence.** Renaming a
 * slide while an order points at the old name would otherwise store a record
 * that cannot present, and the editor stores itself as somebody types, so the
 * moment between the two edits is a moment that has to be survivable. An order
 * left with nothing in it comes out with it.
 *
 * **Exactly one is default.** The one marked, or the first. Presenting a song
 * nobody has chosen an order for takes the default (ST5.2), so there has to be
 * one and there cannot be two.
 *
 * **A song with no orders gets the obvious one.** Every section once, in the
 * order they were typed. A song with none cannot present at all.
 */
function ordersInto(
  id: string,
  orders: OrderDraft[] | undefined,
  labels: string[],
  key: Key | null,
  previous: WholeSong | null,
): Arrangement[] {
  const known = new Set(labels);
  const taken = new Set<string>();
  const names = new Set<string>();

  const kept = (orders ?? orderDrafts(previous ?? blankWhole(id)))
    .map((order) => ({
      name: order.name.trim(),
      sequence: order.sequence.map((label) => label.trim()).filter((label) => known.has(label)),
      isDefault: order.isDefault,
    }))
    .filter((order) => order.sequence.length > 0);

  if (kept.length === 0) {
    kept.push({ name: DEFAULT_ARRANGEMENT_NAME, sequence: labels, isDefault: true });
  }

  // Names are an order's identity to a person, so two cannot share one. The
  // second "Short" becomes "Short 2" rather than being refused, because this
  // runs on every keystroke and refusing would lose what somebody typed.
  const named = kept.map((order, index) => {
    let name = order.name === "" ? `Order ${index + 1}` : order.name;
    let n = 2;
    while (names.has(name)) name = `${order.name === "" ? `Order ${index + 1}` : order.name} ${n++}`;
    names.add(name);
    return { ...order, name };
  });

  const matched = named.map((order) => {
    const before = previous?.arrangements.find((candidate) => candidate.name === order.name) ?? null;
    if (before !== null) taken.add(before.id);
    return { order, before };
  });

  // The first one marked default wins, and a set with none marked gives it to
  // the first, because the record has to have exactly one.
  const chosen = named.findIndex((order) => order.isDefault);
  const defaultAt = chosen === -1 ? 0 : chosen;

  let n = 1;
  return matched.map(({ order, before }, index) => {
    let fresh = `${id}:arrangement:${n}`;
    while (before === null && taken.has(fresh)) fresh = `${id}:arrangement:${++n}`;
    if (before === null) taken.add(fresh);

    return {
      id: before?.id ?? fresh,
      songId: id,
      name: order.name,
      // The key and the tempo are an order's, and nothing on this screen asks
      // for either. They are carried across untouched, and they start to matter
      // with the chord chart in STG-44.
      key: before?.key ?? key ?? "C",
      tempoBpm: before?.tempoBpm ?? null,
      sequence: order.sequence,
      chordpro: before?.chordpro ?? null,
      isDefault: index === defaultAt,
    };
  });
}

/** A stand-in, so an absent record and an absent order read the same way. */
function blankWhole(id: string): WholeSong {
  return { song: blankSong(id), sections: [], arrangements: [], media: [] };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
