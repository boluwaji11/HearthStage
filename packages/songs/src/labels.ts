/**
 * STG-7, STG-9, ST2.1, ST2.3. The name a section goes by.
 *
 * A label is what an order refers to, so every section has to have one, and the
 * volunteer typing their first song has never heard of one. Sections get `V1`,
 * `V2`, `C`, `B` from their kind and their order, and anybody who cares can
 * type their own over the top.
 *
 * It lives in the model rather than in the editor because two places need the
 * same answer. The main process needs it when it writes the record, and the
 * window needs it to show the leader what to type into an order while the song
 * is still unsaved.
 */

import { SECTION_TYPES, type SectionType } from "./types";

/** Enough of a section for a label to be worked out. */
export interface Labelled {
  label?: string | null;
  sectionType?: string | null;
}

const TYPES = new Set<string>(SECTION_TYPES);

/** The short form a label takes, by section kind. */
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

function typeOf(section: Labelled): SectionType {
  const given = section.sectionType ?? "";
  return TYPES.has(given) ? (given as SectionType) : "verse";
}

/**
 * Labels for a set of sections, filling in the ones nobody typed.
 *
 * Numbered per kind, so three verses are V1 V2 V3 and a single chorus is C
 * rather than C1. A label somebody typed is kept as it is, and a clash with a
 * generated one is resolved by moving the generated one along, because an order
 * refers to labels and two sections cannot share one.
 */
export function labelsFor(sections: Labelled[]): string[] {
  const taken = new Set(
    sections.map((section) => (section.label ?? "").trim()).filter((label) => label !== ""),
  );
  const counts = new Map<SectionType, number>();
  const used = new Set<string>();

  return sections.map((section) => {
    const typed = (section.label ?? "").trim();
    if (typed !== "" && !used.has(typed)) {
      used.add(typed);
      return typed;
    }

    const type = typeOf(section);
    const sameType = sections.filter((other) => typeOf(other) === type).length;
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
