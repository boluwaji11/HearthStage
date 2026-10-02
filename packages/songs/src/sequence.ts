/**
 * STG-2, R12.5, ST5.2.
 *
 * Resolving an arrangement's sequence into the sections it names.
 *
 * `["V1","C","V2","C","B","C","C"]` against a song's labelled sections produces
 * seven entries, in that order, with the chorus appearing four times. This is
 * the function the whole schema exists to make possible: the slide order is
 * built with no human step, and the same resolution drives the printed chart and
 * the music stand view, so a slide and a chart can never disagree.
 *
 * Two things it refuses to do. It does not skip a label it cannot find, because
 * a skipped section is a hole in a service that nobody notices until it is
 * happening. It does not guess at a near match, because "V1" and "V 1" being
 * treated as the same thing is how an importer's sloppiness becomes a wrong
 * slide.
 */

import type { Arrangement, SongSection, WholeSong } from "./types";

/**
 * One section, at one point in the sequence.
 *
 * `occurrence` is which time round this is: the second chorus is occurrence 2 of
 * label "C". Stage shows it on the confidence monitor so a leader knows a third
 * chorus is coming, and a deck needs it to give every cue a stable identity even
 * when the same section appears four times.
 */
export interface ResolvedSection {
  /** Position in the sequence, from 0. */
  position: number;
  label: string;
  section: SongSection;
  /** Which appearance of this label this is, from 1. */
  occurrence: number;
  /** How many times this label appears in the whole sequence. */
  occurrencesTotal: number;
}

export type SequenceProblem =
  | { code: "arrangement.unknown"; arrangementId: string }
  | { code: "arrangement.none" }
  | { code: "sequence.empty"; arrangementName: string }
  | { code: "sequence.unknownLabel"; arrangementName: string; label: string; position: number };

export interface ResolvedSequence {
  arrangement: Arrangement;
  sections: ResolvedSection[];
  /**
   * Anything the sequence asked for and did not get. A caller presenting a
   * service treats a non-empty list as a failure to show somebody, rather than
   * rendering the sections that did resolve.
   */
  problems: SequenceProblem[];
}

/**
 * The arrangement to use: the one asked for, the default, or the only one.
 *
 * A plan item names an arrangement (R11.4). A song added from the floor does
 * not, and takes the default.
 */
export function pickArrangement(
  whole: WholeSong,
  arrangementId: string | null,
): { arrangement: Arrangement | null; problems: SequenceProblem[] } {
  if (whole.arrangements.length === 0) {
    return { arrangement: null, problems: [{ code: "arrangement.none" }] };
  }

  if (arrangementId !== null) {
    const named = whole.arrangements.find((candidate) => candidate.id === arrangementId);
    if (named !== undefined) return { arrangement: named, problems: [] };
    // Asked for one that is not there. The default is a better answer than
    // nothing, and the problem is reported so somebody finds out.
    const fallback = defaultArrangement(whole);
    return {
      arrangement: fallback,
      problems: [{ code: "arrangement.unknown", arrangementId }],
    };
  }

  return { arrangement: defaultArrangement(whole), problems: [] };
}

function defaultArrangement(whole: WholeSong): Arrangement | null {
  const marked = whole.arrangements.find((candidate) => candidate.isDefault);
  // A song with no arrangement marked default still has to present, so the
  // first one stands in. `validateWholeSong` warns about it separately.
  return marked ?? whole.arrangements[0] ?? null;
}

/**
 * The sections an arrangement's sequence names, in order.
 *
 * Labels are matched after trimming, because a label with a trailing space is
 * an importer's doing rather than a church's intent. Matching is otherwise
 * exact and case sensitive: "C" and "c" are different labels, and a song using
 * both means it.
 */
export function resolveSequence(
  whole: WholeSong,
  arrangementId: string | null = null,
): ResolvedSequence | null {
  const picked = pickArrangement(whole, arrangementId);
  if (picked.arrangement === null) return null;

  const arrangement = picked.arrangement;
  const problems = [...picked.problems];

  const byLabel = new Map<string, SongSection>();
  for (const section of whole.sections) {
    const label = section.label.trim();
    // First one wins. A duplicate label is an error from the validator, and
    // choosing silently here would hide it.
    if (!byLabel.has(label)) byLabel.set(label, section);
  }

  const labels = arrangement.sequence.map((label) => label.trim());

  if (labels.length === 0) {
    problems.push({ code: "sequence.empty", arrangementName: arrangement.name });
    return { arrangement, sections: [], problems };
  }

  const totals = new Map<string, number>();
  for (const label of labels) {
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const sections: ResolvedSection[] = [];

  labels.forEach((label, position) => {
    const section = byLabel.get(label);
    if (section === undefined) {
      problems.push({
        code: "sequence.unknownLabel",
        arrangementName: arrangement.name,
        label,
        position,
      });
      return;
    }
    const occurrence = (seen.get(label) ?? 0) + 1;
    seen.set(label, occurrence);
    sections.push({
      position,
      label,
      section,
      occurrence,
      occurrencesTotal: totals.get(label) ?? 1,
    });
  });

  return { arrangement, sections, problems };
}

/**
 * The sequence as a person writes it. "V1 C V2 C B C C".
 *
 * Used on a printed chart, in an export, and on the confidence monitor, so it
 * is here rather than in each of them.
 */
export function formatSequence(sequence: string[]): string {
  return sequence.map((label) => label.trim()).join(" ");
}

/** The reverse, for a field somebody types a sequence into. */
export function parseSequence(input: string): string[] {
  return input
    .split(/[\s,>|]+/)
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}
