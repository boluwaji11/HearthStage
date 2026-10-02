/**
 * STG-7, ST2.1, ST2.2. A song, typed in.
 *
 * Two things here would cost a church a rewrite if they were wrong, which is
 * why they have tests rather than care: a section has to end up with a label,
 * because a sequence refers to labels, and a song has to end up with an
 * arrangement, because a song without one cannot present.
 */
import { describe, it, expect } from "vitest";
import { compileDeck, hasErrors, lookupFrom, songPlan, validateWholeSong } from "@hearth/songs";
import { amazingGrace } from "@hearth/songs/fixtures";
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

describe("what the editor does not show, it does not destroy", () => {
  it("keeps a translated section's language and what it translates", () => {
    // Amazing Grace carries a Spanish first verse pointing at the English one.
    // The editor shows neither language nor the link, so regenerating them
    // would turn a church's bilingual hymn into an English verse (R12.8).
    const drafts = sectionDrafts(amazingGrace);
    const again = songFrom({
      id: amazingGrace.song.id,
      title: amazingGrace.song.title,
      fields: fieldsOf(amazingGrace.song),
      sections: drafts,
      existing: amazingGrace,
    });

    const spanish = again.sections.find((section) => section.label === "V1-es");
    expect(spanish?.language).toBe("es");
    expect(spanish?.translationOf).toBe("ag-v1");
    expect(spanish?.id).toBe("ag-v1-es");
  });

  it("keeps every section's id, so nothing pointing at one breaks", () => {
    const again = songFrom({
      id: amazingGrace.song.id,
      title: amazingGrace.song.title,
      fields: fieldsOf(amazingGrace.song),
      sections: sectionDrafts(amazingGrace),
      existing: amazingGrace,
    });
    expect(again.sections.map((section) => section.id)).toEqual(
      amazingGrace.sections.map((section) => section.id),
    );
  });

  it("survives a reorder, because sections are matched by label", () => {
    const drafts = sectionDrafts(amazingGrace);
    const shuffled = [drafts[3], drafts[0], drafts[1], drafts[2]] as typeof drafts;

    const again = songFrom({
      id: amazingGrace.song.id,
      title: amazingGrace.song.title,
      fields: fieldsOf(amazingGrace.song),
      sections: shuffled,
      existing: amazingGrace,
    });

    expect(again.sections[0]?.label).toBe("V1-es");
    expect(again.sections[0]?.translationOf).toBe("ag-v1");
    expect(again.sections[0]?.sortOrder).toBe(0);
    expect(hasErrors(validateWholeSong(again))).toBe(false);
  });

  it("gives a section nobody has typed a kind for the one it had", () => {
    const withChorus = {
      ...amazingGrace,
      sections: amazingGrace.sections.map((section, index) =>
        index === 1 ? { ...section, sectionType: "chorus" as const } : section,
      ),
    };
    const again = songFrom({
      id: withChorus.song.id,
      title: withChorus.song.title,
      fields: fieldsOf(withChorus.song),
      sections: sectionDrafts(withChorus).map(({ sectionType, ...rest }) => rest),
      existing: withChorus,
    });
    expect(again.sections[1]?.sectionType).toBe("chorus");
  });
});

describe("presenting one song on its own", () => {
  it("compiles to a deck of its own words", () => {
    const plan = songPlan(amazingGrace, { date: "2026-10-04" });
    const deck = compileDeck(plan, lookupFrom([amazingGrace]));

    expect(deck.problems).toEqual([]);
    expect(deck.cues.length).toBeGreaterThan(0);
    expect(deck.cues[0]?.lines?.[0]).toBe("Amazing grace! how sweet the sound");
    expect(deck.groups[0]?.title).toBe("Amazing Grace");
    expect(deck.groups[0]?.key).toBe("G");
  });

  it("follows the song's own arrangement", () => {
    const plan = songPlan(amazingGrace);
    const deck = compileDeck(plan, lookupFrom([amazingGrace]));
    expect(deck.groups[0]?.sequence).toEqual(
      amazingGrace.arrangements.find((one) => one.isDefault)?.sequence,
    );
  });
});
