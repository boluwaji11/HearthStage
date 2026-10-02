/**
 * STG-1, R12.4, R12.5, R12.8.
 *
 * The schema in PRD section 9.4 makes three promises, and this file is where
 * they stop being prose. Lyrics are sections rather than a blob, a sequence
 * resolves against real labels, and a translation is aligned to its primary.
 */
import { describe, it, expect } from "vitest";
import {
  amazingGrace,
  blankArrangement,
  blankSection,
  blankSong,
  blankWholeSong,
  holyHolyHoly,
  sampleLibrary,
} from "../src/fixtures";
import { errorsOnly, hasErrors, validateWholeSong, type SongProblemCode } from "../src/validate";

function codes(whole: Parameters<typeof validateWholeSong>[0]): SongProblemCode[] {
  return validateWholeSong(whole).map((problem) => problem.code);
}

describe("the songs we ship", () => {
  it("are well formed, every one of them", () => {
    for (const whole of sampleLibrary) {
      expect(validateWholeSong(whole), whole.song.title).toEqual([]);
    }
  });

  it("are all public domain, because Stage ships no copyrighted lyrics", () => {
    for (const whole of sampleLibrary) {
      expect(whole.song.isPublicDomain, whole.song.title).toBe(true);
    }
  });
});

describe("lyrics are sections rather than a blob (R12.4)", () => {
  it("refuses a section holding one string with newlines in it", () => {
    // This is the failure the whole schema exists to prevent. A blob wearing an
    // array passes a type check and makes Phase 2 a rewrite, so it is caught
    // here rather than discovered by a renderer.
    const whole = blankWholeSong({
      sections: [blankSection({ lines: ["Line one\nLine two\nLine three"] })],
    });
    expect(codes(whole)).toContain("section.lines.containsNewline");
    expect(hasErrors(validateWholeSong(whole))).toBe(true);
  });

  it("names which line the newline was in", () => {
    const whole = blankWholeSong({
      sections: [blankSection({ lines: ["Fine", "Also fine", "Bad\nline"] })],
    });
    const problem = validateWholeSong(whole).find(
      (candidate) => candidate.code === "section.lines.containsNewline",
    );
    expect(problem).toMatchObject({ label: "V1", line: 2 });
  });

  it("refuses a section with no lines, and one holding only whitespace", () => {
    expect(codes(blankWholeSong({ sections: [blankSection({ lines: [] })] }))).toContain(
      "section.lines.empty",
    );
    expect(codes(blankWholeSong({ sections: [blankSection({ lines: ["  ", ""] })] }))).toContain(
      "section.lines.empty",
    );
  });

  it("refuses two sections sharing a label, because a sequence could not tell them apart", () => {
    const whole = blankWholeSong({
      sections: [
        blankSection({ id: "a", label: "V1" }),
        blankSection({ id: "b", label: "V1", sortOrder: 1 }),
      ],
    });
    expect(codes(whole)).toContain("section.label.duplicate");
  });

  it("refuses a section type outside the eight", () => {
    const whole = blankWholeSong({
      // A type from another presenter's vocabulary, which is how this arrives.
      sections: [blankSection({ sectionType: "refrain" as never })],
    });
    expect(codes(whole)).toContain("section.type.unknown");
  });
});

describe("a sequence is data, and it has to resolve (R12.5)", () => {
  it("refuses a sequence naming a section the song does not have", () => {
    // The acceptance criterion that matters most. A hole here is a hole in the
    // service, and finding it now beats finding it at 10:31 on a Sunday.
    const whole = blankWholeSong({
      sections: [blankSection({ label: "V1" })],
      arrangements: [blankArrangement({ sequence: ["V1", "C", "B"] })],
    });
    const problems = errorsOnly(validateWholeSong(whole));
    expect(problems.filter((p) => p.code === "arrangement.sequence.unknownLabel")).toHaveLength(2);
    expect(problems).toContainEqual({
      code: "arrangement.sequence.unknownLabel",
      severity: "error",
      name: "Default",
      label: "C",
    });
  });

  it("accepts a label repeating, because that is what a repeat is", () => {
    expect(validateWholeSong(holyHolyHoly)).toEqual([]);
    expect(holyHolyHoly.arrangements[0]?.sequence).toEqual(["V1", "V2", "V1"]);
  });

  it("refuses an empty sequence and an unreadable key", () => {
    const whole = blankWholeSong({
      arrangements: [blankArrangement({ sequence: [], key: "H" as never })],
    });
    expect(codes(whole)).toContain("arrangement.sequence.empty");
    expect(codes(whole)).toContain("arrangement.key.invalid");
  });

  it("warns when no arrangement is the default, and when several are", () => {
    expect(
      codes(blankWholeSong({ arrangements: [blankArrangement({ isDefault: false })] })),
    ).toContain("arrangements.noDefault");

    const two = blankWholeSong({
      arrangements: [
        blankArrangement({ id: "a", name: "One" }),
        blankArrangement({ id: "b", name: "Two" }),
      ],
    });
    expect(codes(two)).toContain("arrangements.manyDefaults");
  });
});

describe("translations are section aligned (R12.8)", () => {
  it("accepts a translation pointing at its primary", () => {
    expect(validateWholeSong(amazingGrace)).toEqual([]);
    const spanish = amazingGrace.sections.find((section) => section.language === "es");
    expect(spanish?.translationOf).toBe("ag-v1");
  });

  it("refuses a translation pointing at a section that is not there", () => {
    const whole = blankWholeSong({
      sections: [
        blankSection({ id: "a", label: "V1" }),
        blankSection({ id: "b", label: "V1-es", language: "es", translationOf: "missing", sortOrder: 1 }),
      ],
    });
    expect(codes(whole)).toContain("section.translationOf.unknown");
  });

  it("refuses a translation in the same language as what it translates", () => {
    // Two English sections joined would render one language twice on a
    // bilingual slide, which looks like a bug to six hundred people.
    const whole = blankWholeSong({
      sections: [
        blankSection({ id: "a", label: "V1" }),
        blankSection({ id: "b", label: "V1b", translationOf: "a", sortOrder: 1 }),
      ],
    });
    expect(codes(whole)).toContain("section.translationOf.sameLanguage");
  });

  it("refuses a translation of a translation", () => {
    const whole = blankWholeSong({
      song: blankSong({ primaryLanguage: "en" }),
      sections: [
        blankSection({ id: "a", label: "V1" }),
        blankSection({ id: "b", label: "V1-es", language: "es", translationOf: "a", sortOrder: 1 }),
        blankSection({ id: "c", label: "V1-fr", language: "fr", translationOf: "b", sortOrder: 2 }),
      ],
    });
    expect(codes(whole)).toContain("section.translationOf.notPrimary");
  });
});

describe("the song record", () => {
  it("needs a title", () => {
    expect(codes(blankWholeSong({ song: blankSong({ title: "   " }) }))).toContain("title.missing");
  });

  it("refuses a song with no sections and no arrangements", () => {
    const whole = blankWholeSong({ sections: [], arrangements: [] });
    expect(codes(whole)).toContain("sections.none");
    expect(codes(whole)).toContain("arrangements.none");
  });

  it("warns on a time signature, CCLI number or year that cannot be right", () => {
    const whole = blankWholeSong({
      song: blankSong({ timeSignature: "four four", ccliNumber: "CCLI-22025", year: 240 }),
    });
    expect(codes(whole)).toContain("timeSignature.invalid");
    expect(codes(whole)).toContain("ccliNumber.invalid");
    expect(codes(whole)).toContain("year.implausible");
    // Warnings, so an imported library still presents.
    expect(hasErrors(validateWholeSong(whole))).toBe(false);
  });

  it("catches a section or arrangement belonging to another song", () => {
    const whole = blankWholeSong({
      sections: [blankSection({ songId: "another-song" })],
      arrangements: [blankArrangement({ songId: "another-song" })],
    });
    expect(codes(whole)).toContain("section.song.mismatch");
    expect(codes(whole)).toContain("arrangement.song.mismatch");
  });

  it("reports every problem rather than stopping at the first", () => {
    // An import report naming one of eleven faults sends somebody round the
    // loop eleven times (ST3.3).
    const whole = blankWholeSong({
      song: blankSong({ title: "", primaryLanguage: "english" }),
      sections: [blankSection({ lines: [] })],
      arrangements: [blankArrangement({ name: "", sequence: ["C"] })],
    });
    expect(validateWholeSong(whole).length).toBeGreaterThanOrEqual(5);
  });
});
