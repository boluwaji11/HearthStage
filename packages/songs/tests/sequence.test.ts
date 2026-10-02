/**
 * STG-2, R12.5, ST5.2.
 *
 * The function the schema exists to make possible. A sequence is data, so the
 * slide order is built with nobody clicking anything.
 */
import { describe, it, expect } from "vitest";
import {
  amazingGrace,
  blankArrangement,
  blankSection,
  blankWholeSong,
  holyHolyHoly,
} from "../src/fixtures";
import { formatSequence, parseSequence, pickArrangement, resolveSequence } from "../src/sequence";

describe("resolveSequence", () => {
  it("returns the sections the sequence names, in order", () => {
    const resolved = resolveSequence(amazingGrace, "ag-sunday");
    expect(resolved?.sections.map((entry) => entry.label)).toEqual(["V1", "V2", "V3"]);
    expect(resolved?.problems).toEqual([]);
  });

  it("resolves a repeat as separate entries, numbered", () => {
    // "V1 V2 V1" is three cues. A sequence that collapsed the repeat would put
    // the service one slide short of where the band is.
    const resolved = resolveSequence(holyHolyHoly, "hhh-sunday");
    expect(resolved?.sections.map((entry) => entry.label)).toEqual(["V1", "V2", "V1"]);
    expect(resolved?.sections.map((entry) => entry.occurrence)).toEqual([1, 1, 2]);
    expect(resolved?.sections[0]?.occurrencesTotal).toBe(2);
    expect(resolved?.sections[1]?.occurrencesTotal).toBe(1);
  });

  it("handles the sequence from the PRD, V1 C V2 C B C C", () => {
    const whole = blankWholeSong({
      sections: [
        blankSection({ id: "v1", label: "V1" }),
        blankSection({ id: "v2", label: "V2", sortOrder: 1 }),
        blankSection({ id: "c", label: "C", sectionType: "chorus", sortOrder: 2 }),
        blankSection({ id: "b", label: "B", sectionType: "bridge", sortOrder: 3 }),
      ],
      arrangements: [
        blankArrangement({ sequence: ["V1", "C", "V2", "C", "B", "C", "C"] }),
      ],
    });
    const resolved = resolveSequence(whole);
    expect(resolved?.sections).toHaveLength(7);
    expect(resolved?.sections.map((entry) => entry.label)).toEqual([
      "V1",
      "C",
      "V2",
      "C",
      "B",
      "C",
      "C",
    ]);
    // Four choruses, each one knowing which it is.
    expect(
      resolved?.sections.filter((entry) => entry.label === "C").map((entry) => entry.occurrence),
    ).toEqual([1, 2, 3, 4]);
  });

  it("reports a label it cannot find rather than skipping it", () => {
    // A skipped section is a hole in a service that nobody notices until it is
    // happening.
    const whole = blankWholeSong({
      sections: [blankSection({ label: "V1" })],
      arrangements: [blankArrangement({ sequence: ["V1", "C", "B"] })],
    });
    const resolved = resolveSequence(whole);
    expect(resolved?.sections.map((entry) => entry.label)).toEqual(["V1"]);
    expect(resolved?.problems).toEqual([
      { code: "sequence.unknownLabel", arrangementName: "Default", label: "C", position: 1 },
      { code: "sequence.unknownLabel", arrangementName: "Default", label: "B", position: 2 },
    ]);
  });

  it("tolerates a label an importer left whitespace on", () => {
    const whole = blankWholeSong({
      sections: [blankSection({ label: "V1" })],
      arrangements: [blankArrangement({ sequence: [" V1 "] })],
    });
    expect(resolveSequence(whole)?.problems).toEqual([]);
  });

  it("keeps case significant, because a song using C and c means it", () => {
    const whole = blankWholeSong({
      sections: [blankSection({ label: "C" })],
      arrangements: [blankArrangement({ sequence: ["c"] })],
    });
    expect(resolveSequence(whole)?.problems[0]?.code).toBe("sequence.unknownLabel");
  });

  it("reports an empty sequence and resolves nothing", () => {
    const whole = blankWholeSong({ arrangements: [blankArrangement({ sequence: [] })] });
    const resolved = resolveSequence(whole);
    expect(resolved?.sections).toEqual([]);
    expect(resolved?.problems[0]?.code).toBe("sequence.empty");
  });

  it("returns null when the song has no arrangement at all", () => {
    expect(resolveSequence(blankWholeSong({ arrangements: [] }))).toBeNull();
  });
});

describe("pickArrangement", () => {
  it("takes the one asked for", () => {
    expect(pickArrangement(amazingGrace, "ag-short").arrangement?.name).toBe("Two verses");
  });

  it("takes the default when none is asked for, which is a song called from the floor", () => {
    expect(pickArrangement(amazingGrace, null).arrangement?.name).toBe("Sunday");
  });

  it("falls back to the default when the named one is gone, and says so", () => {
    const picked = pickArrangement(amazingGrace, "deleted-last-week");
    expect(picked.arrangement?.name).toBe("Sunday");
    expect(picked.problems).toEqual([
      { code: "arrangement.unknown", arrangementId: "deleted-last-week" },
    ]);
  });

  it("falls back to the first when nothing is marked default", () => {
    const whole = blankWholeSong({
      arrangements: [
        blankArrangement({ id: "a", name: "First", isDefault: false }),
        blankArrangement({ id: "b", name: "Second", isDefault: false }),
      ],
    });
    expect(pickArrangement(whole, null).arrangement?.name).toBe("First");
  });
});

describe("writing a sequence down", () => {
  it("formats the way a chart prints it", () => {
    expect(formatSequence(["V1", "C", "V2", "C"])).toBe("V1 C V2 C");
  });

  it("reads back what somebody typed, however they separated it", () => {
    expect(parseSequence("V1 C V2  C")).toEqual(["V1", "C", "V2", "C"]);
    expect(parseSequence("V1, C, B")).toEqual(["V1", "C", "B"]);
    expect(parseSequence("V1 > C > B")).toEqual(["V1", "C", "B"]);
    expect(parseSequence("   ")).toEqual([]);
  });
});
