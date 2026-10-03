/**
 * STG-50, ST5.9. The leader says "back to the chorus" and the operator types.
 */
import { describe, it, expect } from "vitest";
import { findCue, type Named } from "../src/shared/cues";

function cue(partial: Partial<Named> & { entryId: string }): Named {
  return { label: null, occurrence: 1, skipped: false, ...partial };
}

const deck: Named[] = [
  cue({ entryId: "a", label: "V1" }),
  cue({ entryId: "b", label: "C", occurrence: 1 }),
  cue({ entryId: "c", label: "V2" }),
  cue({ entryId: "d", label: "C", occurrence: 2 }),
  cue({ entryId: "e", label: "B" }),
];

describe("finding a cue by name", () => {
  it("takes a label as it is written", () => {
    expect(findCue(deck, "V2")?.entryId).toBe("c");
  });

  it("does not care about case or spaces, because somebody is in a hurry", () => {
    expect(findCue(deck, " v2 ")?.entryId).toBe("c");
  });

  it("takes the first time a label comes round, where it comes round twice", () => {
    expect(findCue(deck, "C")?.entryId).toBe("b");
  });

  it("reads C2 as the second time the chorus comes round", () => {
    expect(findCue(deck, "C2")?.entryId).toBe("d");
  });

  it("prefers a section actually labelled C2 over the second chorus", () => {
    // A song with two written choruses labels them C1 and C2, and that is what
    // the arrangement's sequence says, so that is what the operator types.
    const written = [
      cue({ entryId: "x", label: "C1" }),
      cue({ entryId: "y", label: "C", occurrence: 2 }),
      cue({ entryId: "z", label: "C2" }),
    ];
    expect(findCue(written, "C2")?.entryId).toBe("z");
  });

  it("finds nothing for a label that is not there", () => {
    expect(findCue(deck, "V9")).toBeNull();
    expect(findCue(deck, "zz")).toBeNull();
  });

  it("finds nothing for nothing typed", () => {
    expect(findCue(deck, "")).toBeNull();
    expect(findCue(deck, "   ")).toBeNull();
  });

  it("refuses a cue the operator took out of this run", () => {
    const some = [cue({ entryId: "a", label: "V1", skipped: true }), cue({ entryId: "b", label: "V2" })];
    expect(findCue(some, "V1")).toBeNull();
    expect(findCue(some, "V2")?.entryId).toBe("b");
  });

  it("skips past a skipped occurrence rather than counting it", () => {
    const some = [
      cue({ entryId: "a", label: "C", occurrence: 1, skipped: true }),
      cue({ entryId: "b", label: "C", occurrence: 2 }),
    ];
    expect(findCue(some, "C")?.entryId).toBe("b");
    expect(findCue(some, "C2")?.entryId).toBe("b");
  });

  it("ignores a cue with no label, which is a slide rather than a section", () => {
    expect(findCue([cue({ entryId: "a" })], "1")).toBeNull();
  });
});
