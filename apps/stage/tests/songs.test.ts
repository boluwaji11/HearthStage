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
import {
  DEFAULT_ARRANGEMENT_NAME,
  fieldsOf,
  labelsFor,
  orderDrafts,
  sectionDrafts,
  songFrom,
} from "../src/main/songs";
import type { OrderDraft, SlideDraft, SongFields } from "@hearth/stage-protocol";

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
    const one: SlideDraft[] = [{ label: null, body: "one", sectionType: "chorus" }];
    expect(labelsFor(one)).toEqual(["C"]);
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

/**
 * STG-9, ST2.3. The ways a song is sung.
 *
 * The editor stores itself while somebody types, so every state between two
 * edits has to be a state the library will take. Most of these tests are that
 * one idea: a sequence naming a slide that was renamed a second ago, an order
 * somebody emptied, a name typed twice, a key carried across a save that never
 * asked about keys.
 */
describe("orders", () => {
  const ORDERS: OrderDraft[] = [
    { name: "Full", sequence: ["V1", "V2", "V3"], isDefault: true },
    { name: "Short", sequence: ["V1", "V3"], isDefault: false },
  ];

  function withOrders(orders: OrderDraft[], existing?: Parameters<typeof songFrom>[0]["existing"]) {
    return songFrom({
      id: "song_1",
      title: "Amazing Grace",
      fields: FIELDS,
      sections: SECTIONS,
      orders,
      existing,
    });
  }

  it("gives a song nobody made one for every section once", () => {
    const { arrangements } = typed();
    expect(arrangements).toHaveLength(1);
    expect(arrangements[0]?.name).toBe(DEFAULT_ARRANGEMENT_NAME);
    expect(arrangements[0]?.sequence).toEqual(["V1", "V2", "V3"]);
    expect(arrangements[0]?.isDefault).toBe(true);
  });

  it("stores the ones somebody made", () => {
    const { arrangements } = withOrders(ORDERS);
    expect(arrangements.map((one) => one.name)).toEqual(["Full", "Short"]);
    expect(arrangements[1]?.sequence).toEqual(["V1", "V3"]);
  });

  it("is a song the library will take", () => {
    expect(hasErrors(validateWholeSong(withOrders(ORDERS)))).toBe(false);
  });

  it("gives exactly one of them the default", () => {
    const marked = withOrders([
      { name: "Full", sequence: ["V1"], isDefault: true },
      { name: "Short", sequence: ["V1"], isDefault: true },
    ]);
    expect(marked.arrangements.filter((one) => one.isDefault)).toHaveLength(1);
    expect(marked.arrangements.find((one) => one.isDefault)?.name).toBe("Full");
  });

  it("gives the first one the default when nobody marked any", () => {
    const none = withOrders(ORDERS.map((order) => ({ ...order, isDefault: false })));
    expect(none.arrangements[0]?.isDefault).toBe(true);
  });

  it("presents the one marked default", () => {
    const whole = withOrders([
      { name: "Full", sequence: ["V1", "V2", "V3"], isDefault: false },
      { name: "Short", sequence: ["V1", "V3"], isDefault: true },
    ]);
    const deck = compileDeck(songPlan(whole), lookupFrom([whole]));
    expect(deck.problems).toEqual([]);
    expect(deck.groups[0]?.sequence).toEqual(["V1", "V3"]);
  });

  it("drops a title the song no longer has, rather than storing a hole", () => {
    const stale = withOrders([{ name: "Full", sequence: ["V1", "V9", "V2"], isDefault: true }]);
    // V9 is gone. V3 is on the end because this song has never been saved, so
    // nothing has been left out of an order on purpose yet.
    expect(stale.arrangements[0]?.sequence).toEqual(["V1", "V2", "V3"]);
    expect(stale.arrangements[0]?.sequence).not.toContain("V9");
    expect(hasErrors(validateWholeSong(stale))).toBe(false);
  });

  it("drops an order left with nothing in it", () => {
    const emptied = withOrders([
      { name: "Full", sequence: ["V1"], isDefault: true },
      { name: "Gone", sequence: [], isDefault: false },
    ]);
    expect(emptied.arrangements.map((one) => one.name)).toEqual(["Full"]);
  });

  it("names an order nobody named, because a name is how it is referred to", () => {
    const unnamed = withOrders([{ name: "   ", sequence: ["V1"], isDefault: true }]);
    expect(unnamed.arrangements[0]?.name).toBe("Order 1");
  });

  it("moves a name typed twice along, because two cannot share one", () => {
    const clashing = withOrders([
      { name: "Short", sequence: ["V1"], isDefault: true },
      { name: "Short", sequence: ["V2"], isDefault: false },
    ]);
    expect(clashing.arrangements.map((one) => one.name)).toEqual(["Short", "Short 2"]);
    expect(validateWholeSong(clashing).some((p) => p.code === "arrangement.name.duplicate")).toBe(
      false,
    );
  });

  it("carries the key, the tempo and the chart across, because this screen asks for none of them", () => {
    const before = withOrders(ORDERS);
    const first = before.arrangements[0];
    if (first === undefined) throw new Error("no arrangement");
    const played = {
      ...before,
      arrangements: [{ ...first, key: "Bb" as const, tempoBpm: 72, chordpro: "[G]Amazing" }],
    };

    const again = withOrders([{ name: "Full", sequence: ["V1", "V2"], isDefault: true }], played);
    expect(again.arrangements[0]?.id).toBe(first.id);
    expect(again.arrangements[0]?.key).toBe("Bb");
    expect(again.arrangements[0]?.tempoBpm).toBe(72);
    expect(again.arrangements[0]?.chordpro).toBe("[G]Amazing");
  });

  it("keeps the orders a save says nothing about", () => {
    const before = withOrders(ORDERS);
    const again = songFrom({
      id: "song_1",
      title: "Amazing Grace",
      fields: FIELDS,
      sections: SECTIONS,
      existing: before,
    });
    expect(again.arrangements.map((one) => one.name)).toEqual(["Full", "Short"]);
  });

  it("never gives two of them the same id, whatever order they arrive in", () => {
    const before = withOrders(ORDERS);
    const added = withOrders(
      [
        { name: "New", sequence: ["V1"], isDefault: false },
        { name: "Full", sequence: ["V1", "V2"], isDefault: true },
        { name: "Short", sequence: ["V1"], isDefault: false },
      ],
      before,
    );
    const ids = added.arrangements.map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("adds a slide nothing sings to the default order, so it can reach a screen", () => {
    // The defect this closes: a verse typed into a song that already had orders
    // saved into the library and appeared in none of them, so pressing Present
    // never showed it and nothing said why.
    const whole = songFrom({
      id: "song_1",
      title: "Amazing Grace",
      fields: FIELDS,
      sections: [...SECTIONS, { label: null, body: "A verse somebody typed today" }],
      orders: [
        { name: "Full", sequence: ["V1", "V2", "V3"], isDefault: true },
        { name: "Short", sequence: ["V1", "V3"], isDefault: false },
      ],
    });

    const full = whole.arrangements.find((one) => one.name === "Full");
    expect(full?.sequence).toEqual(["V1", "V2", "V3", "V4"]);
    // The church's own shorter order is left exactly as they made it.
    expect(whole.arrangements.find((one) => one.name === "Short")?.sequence).toEqual(["V1", "V3"]);
  });

  it("leaves a song alone where every slide is already sung somewhere", () => {
    const whole = withOrders([
      { name: "Full", sequence: ["V1", "V2"], isDefault: true },
      { name: "Short", sequence: ["V3"], isDefault: false },
    ]);
    expect(whole.arrangements[0]?.sequence).toEqual(["V1", "V2"]);
  });

  it("reads back as the window shows them", () => {
    const whole = withOrders(ORDERS);
    expect(orderDrafts(whole)).toEqual([
      { name: "Full", sequence: ["V1", "V2", "V3"], isDefault: true },
      { name: "Short", sequence: ["V1", "V3"], isDefault: false },
    ]);
  });
});
