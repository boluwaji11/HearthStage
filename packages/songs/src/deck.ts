/**
 * STG-4, ST5.1, ST5.2, ST5.4.
 *
 * Compiling a service into a deck.
 *
 * A deck is the service as a flat list of cues the operator advances through,
 * grouped by item so the control surface can show where in the service they
 * are. It is built from a Stage set list or a Hearth plan without caring which,
 * and the build is **pure and deterministic**, which is what makes it testable
 * against golden fixtures and what keeps measurement and network out of a cue
 * advance.
 *
 * Compilation happens when a service is opened and when a plan change is
 * accepted. A cue advance never compiles anything (ST5.11, ST21.1).
 *
 * **It fails loudly.** A song in the plan that is missing from the library, an
 * arrangement sequencing a section that does not exist, a scripture item with
 * no text: each is a problem on the deck, named, at the moment the service is
 * opened. The alternative is finding out at 10:31 on a Sunday, which is the
 * thing this whole package exists to prevent.
 */

import { resolveSequence, type SequenceProblem } from "./sequence";
import { DEFAULT_LIMITS, splitSection, type SlideLimits } from "./slides";
import type { ItemNote, ServiceItem, ServicePlan, Verse } from "./service";
import { orderedItems } from "./service";
import type { Key } from "./keys";
import type { SectionType, WholeSong } from "./types";

export type CueKind = "lyric" | "scripture" | "marker";

export interface Cue {
  /**
   * Stable within a deck, and stable across a recompile of the same service, so
   * a persisted cue pointer survives a restart and lands on the same slide
   * (ST19.1, ST19.2).
   */
  id: string;
  groupId: string;
  kind: CueKind;
  /** Position in the flat deck, from 0. This is what an advance moves. */
  position: number;
  /** The words. Null on a marker, which puts nothing on the wall. */
  lines: string[] | null;
  /** "V1", "C". Shown on the confidence monitor and kept off the wall (ST6.3). */
  label: string | null;
  sectionType: SectionType | null;
  /** Which appearance of this label this is, from 1. The second chorus is 2. */
  occurrence: number;
  occurrencesTotal: number;
  /** Position within the section, and how many slides it became. */
  slideIndex: number;
  slideCount: number;
  /** A scripture cue carries its reference on every slide of the passage (ST7.3). */
  reference: string | null;
}

export interface CueGroup {
  id: string;
  itemId: string;
  kind: CueKind;
  title: string;
  /** The key actually being played: the item's override, or the arrangement's. */
  key: Key | null;
  tempoBpm: number | null;
  durationSeconds: number | null;
  notes: ItemNote[];
  /** The arrangement's sequence, for the confidence monitor. */
  sequence: string[];
  cues: Cue[];
}

export type DeckProblem =
  | { code: "item.song.missing"; itemId: string; songId: string; title: string }
  | { code: "item.scripture.empty"; itemId: string; reference: string }
  | { code: "item.song.noSlides"; itemId: string; title: string }
  | ({ itemId: string; title: string } & SequenceProblem);

export interface Deck {
  planId: string;
  title: string;
  date: string;
  source: ServicePlan["source"];
  groups: CueGroup[];
  /** Every cue in order. The operator advances through this. */
  cues: Cue[];
  /** Everything wrong with the service, found at compile time. */
  problems: DeckProblem[];
}

/** A song lookup. A Map, a cache, or a closure over a database read. */
export type SongLookup = (songId: string) => WholeSong | undefined;

export function lookupFrom(songs: WholeSong[]): SongLookup {
  const byId = new Map(songs.map((whole) => [whole.song.id, whole]));
  return (songId) => byId.get(songId);
}

export interface CompileOptions {
  limits?: SlideLimits;
}

export function compileDeck(
  plan: ServicePlan,
  lookup: SongLookup,
  options: CompileOptions = {},
): Deck {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const groups: CueGroup[] = [];
  const problems: DeckProblem[] = [];
  const cues: Cue[] = [];

  for (const item of orderedItems(plan)) {
    const group = compileItem(item, lookup, limits, problems);
    if (group === null) continue;
    groups.push(group);
  }

  // Positions are assigned once, over the whole deck, after every group is
  // built. A cue's position is its index in what the operator advances through,
  // so it cannot be known while a single group is being compiled.
  let position = 0;
  for (const group of groups) {
    for (const cue of group.cues) {
      cue.position = position;
      cues.push(cue);
      position += 1;
    }
  }

  return {
    planId: plan.id,
    title: plan.title,
    date: plan.date,
    source: plan.source,
    groups,
    cues,
    problems,
  };
}

function compileItem(
  item: ServiceItem,
  lookup: SongLookup,
  limits: SlideLimits,
  problems: DeckProblem[],
): CueGroup | null {
  const groupId = `group:${item.id}`;

  if (item.type === "marker") {
    return {
      id: groupId,
      itemId: item.id,
      kind: "marker",
      title: item.title,
      key: null,
      tempoBpm: null,
      durationSeconds: item.durationSeconds,
      notes: item.notes,
      sequence: [],
      cues: [
        {
          id: `${groupId}:marker`,
          groupId,
          kind: "marker",
          position: 0,
          lines: null,
          label: null,
          sectionType: null,
          occurrence: 1,
          occurrencesTotal: 1,
          slideIndex: 0,
          slideCount: 1,
          reference: null,
        },
      ],
    };
  }

  if (item.type === "scripture") {
    const cues = compileScripture(item.id, groupId, item.reference, item.verses, limits);
    if (cues.length === 0) {
      problems.push({
        code: "item.scripture.empty",
        itemId: item.id,
        reference: item.reference,
      });
    }
    return {
      id: groupId,
      itemId: item.id,
      kind: "scripture",
      title: item.title,
      key: null,
      tempoBpm: null,
      durationSeconds: item.durationSeconds,
      notes: item.notes,
      sequence: [],
      cues,
    };
  }

  const whole = lookup(item.songId);
  if (whole === undefined) {
    // A plan naming a song the library does not have. Reported rather than
    // skipped silently, because an operator needs to know before the service
    // that one item will not present.
    problems.push({
      code: "item.song.missing",
      itemId: item.id,
      songId: item.songId,
      title: item.title,
    });
    return null;
  }

  const resolved = resolveSequence(whole, item.arrangementId);
  if (resolved === null) {
    problems.push({ code: "arrangement.none", itemId: item.id, title: item.title });
    return null;
  }

  for (const problem of resolved.problems) {
    problems.push({ ...problem, itemId: item.id, title: item.title });
  }

  const cues: Cue[] = [];
  for (const entry of resolved.sections) {
    const slides = splitSection(entry.section, limits);
    for (const slide of slides) {
      cues.push({
        // The occurrence is in the id, so the first and second chorus are
        // different cues and a restored pointer lands on the right one.
        id: `${groupId}:${entry.label}:${entry.occurrence}:${slide.index}`,
        groupId,
        kind: "lyric",
        position: 0,
        lines: slide.lines,
        label: entry.label,
        sectionType: entry.section.sectionType,
        occurrence: entry.occurrence,
        occurrencesTotal: entry.occurrencesTotal,
        slideIndex: slide.index,
        slideCount: slide.count,
        reference: null,
      });
    }
  }

  if (cues.length === 0) {
    problems.push({ code: "item.song.noSlides", itemId: item.id, title: item.title });
  }

  return {
    id: groupId,
    itemId: item.id,
    kind: "lyric",
    title: item.title,
    key: item.keyOverride ?? resolved.arrangement.key,
    tempoBpm: resolved.arrangement.tempoBpm,
    durationSeconds: item.durationSeconds,
    notes: item.notes,
    sequence: resolved.arrangement.sequence,
    cues,
  };
}

/**
 * Scripture cues, broken at verse boundaries (ST7.3).
 *
 * Verses are kept whole and packed onto slides up to the line limit. A single
 * verse longer than a slide takes a slide of its own rather than being split
 * mid-sentence, and splitting such a verse properly arrives with STG-57.
 */
function compileScripture(
  itemId: string,
  groupId: string,
  reference: string,
  verses: Verse[],
  limits: SlideLimits,
): Cue[] {
  const usable = verses.filter((verse) => verse.text.trim() !== "");
  if (usable.length === 0) return [];

  const maxLines = Math.max(1, Math.floor((limits.maxLines ?? DEFAULT_LIMITS.maxLines)));
  const groups: Verse[][] = [];
  let current: Verse[] = [];

  for (const verse of usable) {
    if (current.length >= maxLines) {
      groups.push(current);
      current = [];
    }
    current.push(verse);
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group, index) => ({
    id: `${groupId}:verse:${group[0]?.number ?? index}`,
    groupId,
    kind: "scripture" as const,
    position: 0,
    lines: group.map((verse) => `${verse.number} ${verse.text}`),
    label: null,
    sectionType: null,
    occurrence: 1,
    occurrencesTotal: 1,
    slideIndex: index,
    slideCount: groups.length,
    // On every slide of the passage, because a congregation arriving at slide
    // three still needs to know where they are.
    reference,
  }));
}

/** The cue after this one, or null at the end of the deck. */
export function nextCue(deck: Deck, position: number): Cue | null {
  return deck.cues[position + 1] ?? null;
}

export function cueAt(deck: Deck, position: number): Cue | null {
  return deck.cues[position] ?? null;
}

/** Where a cue id sits now, for restoring a pointer after a recompile. */
export function positionOf(deck: Deck, cueId: string): number | null {
  const index = deck.cues.findIndex((cue) => cue.id === cueId);
  return index === -1 ? null : index;
}

export function groupOf(deck: Deck, cue: Cue): CueGroup | null {
  return deck.groups.find((group) => group.id === cue.groupId) ?? null;
}

/** Whether anything found would stop part of the service presenting. */
export function deckIsComplete(deck: Deck): boolean {
  return deck.problems.length === 0;
}
