/**
 * STG-8, ST2.2. Breaking a pasted block of lyrics into sections.
 *
 * The rule under all of it: this proposes and never decides. A splitter that
 * guessed silently would put a chorus in the middle of a verse on a wall, and
 * the person who pasted it would have no idea why.
 */
import { describe, it, expect } from "vitest";
import { headingOf, proposeSplit } from "../src/index";

describe("telling a heading from a lyric", () => {
  it("reads the words a church writes above a section", () => {
    expect(headingOf("Verse 1")).toEqual({ label: "V1", sectionType: "verse" });
    expect(headingOf("Chorus")).toEqual({ label: "C", sectionType: "chorus" });
    expect(headingOf("Pre-Chorus")).toEqual({ label: "P", sectionType: "pre_chorus" });
    expect(headingOf("Bridge 2")).toEqual({ label: "B2", sectionType: "bridge" });
    expect(headingOf("Refrain")?.sectionType).toBe("chorus");
    expect(headingOf("Outro")?.sectionType).toBe("ending");
    expect(headingOf("Interlude")?.sectionType).toBe("instrumental");
  });

  it("reads them however they are decorated", () => {
    for (const written of ["[Chorus]", "(Chorus)", "CHORUS:", "chorus", "Chorus -", "【Chorus】"]) {
      expect(headingOf(written), written).toEqual({ label: "C", sectionType: "chorus" });
    }
  });

  it("reads the short forms a church types into a sequence", () => {
    expect(headingOf("V2")).toEqual({ label: "V2", sectionType: "verse" });
    expect(headingOf("[C]")).toEqual({ label: "C", sectionType: "chorus" });
  });

  it("refuses a lyric that begins with a section word", () => {
    // The whole line has to match. A rule that looked at the start of a line
    // would break this hymn in half.
    expect(headingOf("Chorus of angels sing")).toBeNull();
    expect(headingOf("Verse after verse of mercy")).toBeNull();
    expect(headingOf("Bridge over troubled water, and more besides")).toBeNull();
  });

  it("refuses a blank line and a long line", () => {
    expect(headingOf("   ")).toBeNull();
    expect(headingOf("C".repeat(40))).toBeNull();
  });
});

describe("a block the text broke up itself", () => {
  const WITH_HEADINGS = `Verse 1
Amazing grace! how sweet the sound
That saved a wretch like me

Chorus
Praise the Lord

Verse 2
'Twas grace that taught my heart to fear`;

  it("breaks at the headings, and keeps them off the words", () => {
    const proposal = proposeSplit(WITH_HEADINGS);

    expect(proposal.reason).toBe("markers");
    expect(proposal.guessed).toBe(false);
    expect(proposal.sections).toHaveLength(3);
    expect(proposal.sections[0]?.lines[0]).toBe("Amazing grace! how sweet the sound");
    expect(proposal.sections.map((section) => section.label)).toEqual(["V1", "C", "V2"]);
    expect(proposal.sections.map((section) => section.sectionType)).toEqual([
      "verse",
      "chorus",
      "verse",
    ]);
  });

  it("keeps words that arrive above the first heading", () => {
    const proposal = proposeSplit(`A line nobody labelled\n\nChorus\nPraise\n\nVerse 1\nWords`);
    expect(proposal.sections[0]?.lines).toEqual(["A line nobody labelled"]);
    expect(proposal.sections[0]?.label).toBeNull();
    expect(proposal.sections).toHaveLength(3);
  });

  it("ignores a single heading at the top, which says what a block is", () => {
    const proposal = proposeSplit("Chorus\nPraise the Lord\nFor he is good");
    expect(proposal.reason).toBe("single");
  });
});

describe("a block with gaps in it", () => {
  it("breaks at the blank lines", () => {
    const proposal = proposeSplit("One\nTwo\n\nThree\nFour\n\nFive");
    expect(proposal.reason).toBe("blank-lines");
    expect(proposal.guessed).toBe(false);
    expect(proposal.sections.map((section) => section.lines)).toEqual([
      ["One", "Two"],
      ["Three", "Four"],
      ["Five"],
    ]);
  });

  it("names no labels, because the gaps said where and nothing said what", () => {
    const proposal = proposeSplit("One\n\nTwo");
    expect(proposal.sections.every((section) => section.label === null)).toBe(true);
  });

  it("treats a run of blank lines as one break", () => {
    expect(proposeSplit("One\n\n\n\nTwo").sections).toHaveLength(2);
  });
});

describe("a solid block, with nothing to go on", () => {
  const SOLID = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"].join("\n");

  it("breaks every four lines and says it is guessing", () => {
    const proposal = proposeSplit(SOLID);
    expect(proposal.reason).toBe("line-count");
    expect(proposal.guessed).toBe(true);
    expect(proposal.sections).toHaveLength(2);
  });

  it("takes the line limit it is given", () => {
    expect(proposeSplit(SOLID, { maxLines: 2 }).sections).toHaveLength(4);
  });

  it("leaves a short block alone, and does not call that a guess", () => {
    const proposal = proposeSplit("One\nTwo");
    expect(proposal.reason).toBe("single");
    expect(proposal.guessed).toBe(false);
    expect(proposal.sections).toHaveLength(1);
  });

  it("proposes nothing for nothing", () => {
    expect(proposeSplit("   \n\n  ").sections).toEqual([]);
  });
});

describe("what it never does", () => {
  it("loses a line", () => {
    const text = `Verse 1\nOne\nTwo\n\nChorus\nThree\n\nVerse 2\nFour\nFive`;
    const kept = proposeSplit(text).sections.flatMap((section) => section.lines);
    expect(kept).toEqual(["One", "Two", "Three", "Four", "Five"]);
  });

  it("loses a line out of a solid block either", () => {
    const lines = Array.from({ length: 11 }, (unused, n) => `Line ${n + 1}`);
    const kept = proposeSplit(lines.join("\n")).sections.flatMap((section) => section.lines);
    expect(kept).toEqual(lines);
  });

  it("reads every line ending, because text arrives from a paste", () => {
    expect(proposeSplit("One\r\n\r\nTwo").sections).toHaveLength(2);
    expect(proposeSplit("One\r\rTwo").sections).toHaveLength(2);
  });
});
