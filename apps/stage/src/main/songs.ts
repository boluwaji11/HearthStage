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
 * **A song gets an arrangement whether or not anybody asked.** A song with no
 * arrangement cannot present, and the arrangement nobody asked for is the
 * obvious one: every section once, in the order they were typed. Making,
 * naming and reordering arrangements is STG-9.
 */

import {
  SECTION_TYPES,
  isKey,
  type Arrangement,
  type Key,
  type SectionType,
  type Song,
  type SongSection,
  type WholeSong,
} from "@hearth/songs";
import type { SlideDraft, SongFields } from "@hearth/stage-protocol";

/** The arrangement a typed song gets, which STG-9 lets a church change. */
export const DEFAULT_ARRANGEMENT_NAME = "As written";

const TYPES = new Set<string>(SECTION_TYPES);

/** The short form a label takes, by section type. */
const PREFIX: Record<SectionType, string> = {
  intro: "I",
  verse: "V",
  pre_chorus: "P",
  chorus: "C",
  bridge: "B",
  tag: "T",
  instrumental: "M",
  ending: "E",
};

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

function typeOf(draft: SlideDraft): SectionType {
  const given = draft.sectionType ?? "";
  return TYPES.has(given) ? (given as SectionType) : "verse";
}

/**
 * Labels for a set of sections, filling in the ones nobody typed.
 *
 * Numbered per type, so three verses are V1 V2 V3 and a single chorus is C
 * rather than C1. A label somebody typed is kept as it is, and a clash with a
 * generated one is resolved by moving the generated one along, because a
 * sequence refers to labels and two sections cannot share one.
 */
export function labelsFor(drafts: SlideDraft[]): string[] {
  const taken = new Set(
    drafts.map((draft) => (draft.label ?? "").trim()).filter((label) => label !== ""),
  );
  const counts = new Map<SectionType, number>();
  const used = new Set<string>();

  return drafts.map((draft) => {
    const typed = (draft.label ?? "").trim();
    if (typed !== "" && !used.has(typed)) {
      used.add(typed);
      return typed;
    }

    const type = typeOf(draft);
    const sameType = drafts.filter((other) => typeOf(other) === type).length;
    let n = (counts.get(type) ?? 0) + 1;
    let label = sameType === 1 ? PREFIX[type] : `${PREFIX[type]}${n}`;
    while (taken.has(label) || used.has(label)) {
      n += 1;
      label = `${PREFIX[type]}${n}`;
    }
    counts.set(type, n);
    used.add(label);
    return label;
  });
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

  const sections: SongSection[] = usable.map((section, index) => ({
    id: `${id}:section:${index + 1}`,
    songId: id,
    sectionType: typeOf(section),
    label: labels[index] as string,
    sortOrder: index,
    lines: section.body
      .split(/\r\n|\r|\n/)
      .map((line) => line.replace(/\s+$/, ""))
      .filter((line) => line.trim() !== ""),
    language: previous?.song.primaryLanguage ?? "en",
    translationOf: null,
  }));

  // Every section once, in the order they were typed. A song with no
  // arrangement cannot present, and this is the one nobody has to ask for.
  const arrangement: Arrangement = {
    id: `${id}:arrangement:1`,
    songId: id,
    name: DEFAULT_ARRANGEMENT_NAME,
    key: key ?? "C",
    tempoBpm: previous?.arrangements.find((one) => one.isDefault)?.tempoBpm ?? null,
    sequence: labels,
    chordpro: previous?.arrangements.find((one) => one.isDefault)?.chordpro ?? null,
    isDefault: true,
  };

  return {
    song,
    sections,
    arrangements: sections.length === 0 ? [] : [arrangement],
    media: [],
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
