/**
 * STG-3, R12.4, ST6.1.
 *
 * Breaking a section into slides.
 *
 * A section is one slide where it fits and several where it does not. The rules
 * are short and all three matter:
 *
 * - **A break falls between two lines.** A congregation reading half a sentence
 *   is the single most common fault in presented lyrics, so a line arrives on
 *   one slide, whole.
 * - **Blank lines are a stanza boundary**, so a section written with a gap in it
 *   breaks there first, before the line count forces a break somewhere worse.
 * - **The last slide is never left with one line** where the split can be
 *   evened out. A four line section at a limit of three reads better as two and
 *   two than as three and one.
 *
 * The theme owns the limit, because how many lines fit is a fact about the
 * typography and the screen rather than about the song. Measurement of the
 * actual rendered text is a separate job and arrives with STG-18.
 */

import type { SongSection } from "./types";

export interface SlideLimits {
  /** Most lines a slide may carry. */
  maxLines: number;
  /**
   * Whether a blank line in the lyrics forces a break.
   *
   * On by default. A church that writes stanza gaps into every section and
   * wants them ignored turns it off.
   */
  breakOnBlankLine?: boolean;
  /**
   * Whether to even out a split rather than leave a one-line last slide.
   *
   * On by default.
   */
  balanceLastSlide?: boolean;
}

export const DEFAULT_LIMITS: Required<SlideLimits> = {
  maxLines: 4,
  breakOnBlankLine: true,
  balanceLastSlide: true,
};

export interface Slide {
  lines: string[];
  /** Position within the section, from 0. */
  index: number;
  /** How many slides this section became. */
  count: number;
}

/**
 * The slides one section becomes.
 *
 * A section whose lines are all blank returns no slides, which the validator
 * reports as an error separately. Returning an empty slide instead would put a
 * blank screen in the middle of a song and look like a fault in the projector.
 */
export function splitSection(section: SongSection, limits: SlideLimits = DEFAULT_LIMITS): Slide[] {
  const settings = { ...DEFAULT_LIMITS, ...limits };
  const maxLines = Math.max(1, Math.floor(settings.maxLines));

  const stanzas = settings.breakOnBlankLine
    ? splitOnBlankLines(section.lines)
    : [section.lines.filter((line) => line.trim() !== "")];

  const groups: string[][] = [];
  for (const stanza of stanzas) {
    if (stanza.length === 0) continue;
    for (const chunk of chunkLines(stanza, maxLines, settings.balanceLastSlide)) {
      groups.push(chunk);
    }
  }

  return groups.map((lines, index) => ({ lines, index, count: groups.length }));
}

function splitOnBlankLines(lines: string[]): string[][] {
  const stanzas: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) stanzas.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) stanzas.push(current);
  return stanzas;
}

/**
 * Lines in groups of at most `maxLines`, evened out where that reads better.
 *
 * Five lines at a limit of four is four and one, which looks like a mistake on
 * a wall. Balanced it is three and two. Six at a limit of four is three and
 * three. The arithmetic is: once a split is needed, use the fewest slides that
 * fit and spread the lines across them as evenly as possible.
 */
function chunkLines(lines: string[], maxLines: number, balance: boolean): string[][] {
  if (lines.length <= maxLines) return [lines];

  const slideCount = Math.ceil(lines.length / maxLines);

  if (!balance) {
    const chunks: string[][] = [];
    for (let index = 0; index < lines.length; index += maxLines) {
      chunks.push(lines.slice(index, index + maxLines));
    }
    return chunks;
  }

  const base = Math.floor(lines.length / slideCount);
  // The first `remainder` slides take one extra line, so the longer slides come
  // first and the section does not taper off.
  const remainder = lines.length % slideCount;

  const chunks: string[][] = [];
  let cursor = 0;
  for (let slide = 0; slide < slideCount; slide += 1) {
    const size = base + (slide < remainder ? 1 : 0);
    chunks.push(lines.slice(cursor, cursor + size));
    cursor += size;
  }
  return chunks;
}

/**
 * Two languages on one slide, section aligned (R12.8, ST6.9).
 *
 * The primary and its translation are split independently and paired by index,
 * because the two languages rarely need the same number of lines. Where one has
 * more slides than the other, the shorter one's slides run out and the primary
 * renders alone rather than against an empty half.
 */
export interface BilingualSlide {
  lines: string[];
  translation: string[] | null;
  index: number;
  count: number;
}

export function splitBilingual(
  primary: SongSection,
  translation: SongSection | null,
  limits: SlideLimits = DEFAULT_LIMITS,
): BilingualSlide[] {
  const primarySlides = splitSection(primary, limits);
  const translationSlides = translation === null ? [] : splitSection(translation, limits);

  return primarySlides.map((slide, index) => ({
    lines: slide.lines,
    translation: translationSlides[index]?.lines ?? null,
    index,
    count: primarySlides.length,
  }));
}
