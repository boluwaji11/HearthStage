/**
 * STG-7, ST2.1, ST2.2. A song, typed in.
 *
 * Two things here would cost a church a rewrite if they were wrong, which is
 * why they have tests rather than care: a section has to end up with a label,
 * because a sequence refers to labels, and a song has to end up with an
 * arrangement, because a song without one cannot present.
 */
import { describe, it, expect } from "vitest";
import { hasErrors, validateWholeSong } from "@hearth/songs";
import { DEFAULT_ARRANGEMENT_NAME, fieldsOf, labelsFor, sectionDrafts, songFrom } from "../src/main/songs";
import type { SlideDraft, SongFields } from "@hearth/stage-protocol";

const FIELDS: SongFields = {
  author: "John Newton",
  composer: "",
  copyrightLine: "Public Domain",
  ccliNumber: "22025",
  year: "1779",
  isPublicDomain: true,
  defaultKey: "G",
};

const SECTIONS: SlideDraft[] = [
  { label: null, body: "Amazing grace! how sweet the sound\nThat saved a wretch like me" },
  { label: null, body: "'Twas grace that taught my heart to fear" },
  { label: null, body: "Through many dangers, toils and snares" },
];

function typed(sections = SECTIONS, fields = FIELDS, title = "Amazing Grace") {
  return songFrom({ id: "song_1", title, fields, sections });
}

describe("typing a song in", () => {
  it("is a song the library will take", () => {
    expect(hasErrors(validateWholeSong(typed()))).toBe(false);
  });

  it("keeps the fields a licensed song has to show", () => {
    const { song } = typed();
    expect(song.title).toBe("Amazing Grace");
    expect(song.author).toBe("John Newton");
    expect(song.ccliNumber).toBe("22025");
    expect(song.copyrightLine).toBe("Public Domain");
    expect(song.year).toBe(1779);
    expect(song.isPublicDomain).toBe(true);
    expect(song.defaultKey).toBe("G");
  });

  it("leaves a field nobody filled in as nothing rather than as an empty string", () => {
    const { song } = typed(SECTIONS, { ...FIELDS, author: "   ", year: "" });
    expect(song.author).toBeNull();
    expect(song.year).toBeNull();
  });

  it("refuses a key it cannot read rather than guessing one", () => {
    expect(typed(SECTIONS, { ...FIELDS, defaultKey: "H" }).song.defaultKey).toBeNull();
  });

  it("writes it as a local song, because the library holds what Stage owns", () => {
    expect(typed().song.origin).toBe("local");
  });

  it("drops a box with nothing in it", () => {
    const whole = typed([...SECTIONS, { label: null, body: "  \n " }]);
    expect(whole.sections).toHaveLength(3);
  });
});

describe("labels, which nobody is asked for", () => {
  it("numbers sections of the same kind", () => {
    expect(labelsFor(SECTIONS)).toEqual(["V1", "V2", "V3"]);
  });

  it("leaves a single section of a kind unnumbered", () => {
    expect(labelsFor([{ label: null, body: "one", sectionType: "chorus" }])).toEqual(["C"]);
  });

  it("keeps a label somebody typed", () => {
    const mixed: SlideDraft[] = [
      { label: "Verse one", body: "a" },
      { label: null, body: "b" },
    ];
    expect(labelsFor(mixed)).toEqual(["Verse one", "V1"]);
  });

  it("never repeats one, because a sequence refers to labels", () => {
    const clashing: SlideDraft[] = [
      { label: "V1", body: "a" },
      { label: null, body: "b" },
      { label: null, body: "c" },
    ];
    const labels = labelsFor(clashing);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("puts every label on the song, in order", () => {
    expect(typed().sections.map((section) => section.label)).toEqual(["V1", "V2", "V3"]);
    expect(typed().sections.map((section) => section.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe("the arrangement nobody asked for", () => {
  it("is every section once, in the order they were typed", () => {
    const [arrangement] = typed().arrangements;
    expect(arrangement?.name).toBe(DEFAULT_ARRANGEMENT_NAME);
    expect(arrangement?.sequence).toEqual(["V1", "V2", "V3"]);
    expect(arrangement?.isDefault).toBe(true);
  });

  it("takes the song's key, and falls back to C where there is none", () => {
    expect(typed().arrangements[0]?.key).toBe("G");
    expect(typed(SECTIONS, { ...FIELDS, defaultKey: "" }).arrangements[0]?.key).toBe("C");
  });

  it("is absent on a song with no words yet, which the store reports", () => {
    const empty = typed([]);
    expect(empty.arrangements).toEqual([]);
    expect(hasErrors(validateWholeSong(empty))).toBe(true);
  });
});

describe("editing a song that already exists", () => {
  const first = typed();

  it("leaves a section's kind alone, so a chorus stays a chorus", () => {
    const drafts = sectionDrafts({
      ...first,
      sections: first.sections.map((section, index) =>
        index === 1 ? { ...section, sectionType: "chorus" as const } : section,
      ),
    });

    // The window never shows the kind and sends it back untouched, which is
    // what stops editing the words flattening an imported song's structure.
    const again = songFrom({
      id: "song_1",
      title: "Amazing Grace",
      fields: FIELDS,
      sections: drafts,
      existing: first,
    });
    expect(again.sections[1]?.sectionType).toBe("chorus");
  });

  it("round trips through the boxes the editor shows", () => {
    const drafts = sectionDrafts(first);
    expect(drafts.map((draft) => draft.body)).toEqual(
      first.sections.map((section) => section.lines.join("\n")),
    );
    expect(fieldsOf(first.song)).toEqual(FIELDS);
  });
});
