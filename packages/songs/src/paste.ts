/**
 * STG-8, ST2.2, ST3.2. Breaking a pasted block of lyrics into sections.
 *
 * Lyrics arrive from a web page, a Word document or an old presenter's export,
 * and they arrive as a wall of text. The schema needs ordered labelled sections
 * (the platform PRD section 9.4), so something has to turn one into the other,
 * and the honest options are to ask the person to do it by hand or to propose
 * something they can look at.
 *
 * **This proposes. A person decides.** The return value says what it found and
 * how sure it is, and the caller shows it to somebody before anything is
 * stored. A splitter that silently guessed wrong would put a chorus in the
 * middle of a verse on a wall, and the person who pasted it would have no idea
 * why.
 *
 * Three ways in, in order of how much the text actually told us:
 *
 * 1. **The text says so.** Lines like `Verse 2`, `[Chorus]` or `B` on their own
 *    are headings. This is how most lyrics on the internet are written, and it
 *    gives the label and the kind of section for nothing.
 * 2. **Blank lines.** No headings, so the gaps the writer left are the breaks.
 * 3. **A count of lines.** A solid block with neither. This is a guess, it says
 *    so, and it exists because four lines is right often enough to be worth
 *    offering and wrong in a way a person spots in a second.
 */

import type { SectionType } from "./types";

export type SplitReason = "markers" | "blank-lines" | "line-count" | "single";

export interface ProposedSection {
  /** From a heading the text carried. Null leaves the label to be generated. */
  label: string | null;
  /** From the same heading. Null means nothing in the text said. */
  sectionType: SectionType | null;
  lines: string[];
}

export interface SplitProposal {
  reason: SplitReason;
  sections: ProposedSection[];
  /** True where the break came from a rule rather than from the text. */
  guessed: boolean;
}

export interface SplitOptions {
  /** Lines per section when there is nothing else to go on. */
  maxLines?: number;
}

/** The words a church writes above a section, and what each one means. */
const WORDS: [RegExp, SectionType, string][] = [
  [/^pre[- ]?chorus$/i, "pre_chorus", "P"],
  [/^chorus$/i, "chorus", "C"],
  [/^refrain$/i, "chorus", "C"],
  [/^verse$/i, "verse", "V"],
  [/^bridge$/i, "bridge", "B"],
  [/^intro(duction)?$/i, "intro", "I"],
  [/^tag$/i, "tag", "T"],
  [/^(instrumental|interlude|solo)$/i, "instrumental", "M"],
  [/^(ending|outro|coda)$/i, "ending", "E"],
];

/** The short forms, as a church types them into a sequence. */
const SHORT: Record<string, SectionType> = {
  V: "verse",
  C: "chorus",
  P: "pre_chorus",
  B: "bridge",
  T: "tag",
  I: "intro",
  M: "instrumental",
  E: "ending",
};

interface Heading {
  label: string;
  sectionType: SectionType;
}

/**
 * Whether a line is a heading rather than words to sing.
 *
 * The whole line has to match. "Chorus of angels sing" begins with a section
 * word and is a lyric, so a rule that looked at the start of a line would break
 * a hymn in half.
 */
export function headingOf(line: string): Heading | null {
  const bare = line
    .trim()
    .replace(/^[[(（【]\s*/, "")
    .replace(/\s*[\])）】]$/, "")
    .replace(/\s*[:.\-–]\s*$/, "")
    .trim();

  if (bare === "" || bare.length > 24) return null;

  const numbered = /^(.*?)\s*(\d{1,2})?$/.exec(bare);
  const word = (numbered?.[1] ?? bare).trim();
  const number = numbered?.[2] ?? "";

  for (const [pattern, sectionType, prefix] of WORDS) {
    if (pattern.test(word)) return { label: `${prefix}${number}`, sectionType };
  }

  const short = /^([VCPBTIME])\s*(\d{1,2})?$/i.exec(bare);
  if (short !== null) {
    const letter = (short[1] as string).toUpperCase();
    const type = SHORT[letter];
    if (type !== undefined) return { label: `${letter}${short[2] ?? ""}`, sectionType: type };
  }

  return null;
}

const DEFAULT_MAX_LINES = 4;

/**
 * What this block of text could be broken into.
 *
 * Returns one section where there is nothing to split, so a caller can treat
 * every paste the same way and show the proposal only when there is more than
 * one section in it.
 */
export function proposeSplit(text: string, options: SplitOptions = {}): SplitProposal {
  const maxLines = Math.max(1, Math.floor(options.maxLines ?? DEFAULT_MAX_LINES));

  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/\s+$/, "").replace(/^﻿/, ""));

  const headed = byHeading(lines);
  if (headed !== null) return { reason: "markers", sections: headed, guessed: false };

  const stanzas = byBlankLine(lines);
  if (stanzas.length > 1) {
    return {
      reason: "blank-lines",
      sections: stanzas.map((block) => ({ label: null, sectionType: null, lines: block })),
      guessed: false,
    };
  }

  const solid = stanzas[0] ?? [];
  if (solid.length <= maxLines) {
    return {
      reason: "single",
      sections: solid.length === 0 ? [] : [{ label: null, sectionType: null, lines: solid }],
      guessed: false,
    };
  }

  const chunks: string[][] = [];
  for (let at = 0; at < solid.length; at += maxLines) {
    chunks.push(solid.slice(at, at + maxLines));
  }
  return {
    reason: "line-count",
    sections: chunks.map((block) => ({ label: null, sectionType: null, lines: block })),
    guessed: true,
  };
}

/**
 * Sections from headings the text carried.
 *
 * Null where there are none, or where there is one and it sits at the top of
 * everything, because a single heading says what the block is rather than where
 * it breaks.
 */
function byHeading(lines: string[]): ProposedSection[] | null {
  const sections: ProposedSection[] = [];
  let current: ProposedSection | null = null;
  let before: string[] = [];

  for (const line of lines) {
    const heading = line.trim() === "" ? null : headingOf(line);
    if (heading !== null) {
      if (current !== null) sections.push(current);
      current = { label: heading.label, sectionType: heading.sectionType, lines: [] };
      continue;
    }
    if (line.trim() === "") continue;
    if (current === null) before.push(line);
    else current.lines.push(line);
  }
  if (current !== null) sections.push(current);

  const kept = sections.filter((section) => section.lines.length > 0);
  if (kept.length < 2) return null;

  // Words above the first heading are a section of their own rather than
  // something to throw away.
  if (before.length > 0) {
    kept.unshift({ label: null, sectionType: null, lines: before });
  }
  return kept;
}

function byBlankLine(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) blocks.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}
