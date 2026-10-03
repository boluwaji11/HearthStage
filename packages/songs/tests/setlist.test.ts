/**
 * STG-46, ST2.8. The running order a church types for one service.
 *
 * The thing worth defending is that a set list points at the library rather
 * than copying it, and that it reaches the deck compiler as the same
 * `ServicePlan` a paired church's plan arrives as. Everything downstream is
 * then written once.
 */
import { describe, it, expect } from "vitest";
import { compileDeck, lookupFrom } from "../src/deck";
import { amazingGrace, holyHolyHoly } from "../src/fixtures";
import {
  newSetList,
  orderedEntries,
  setListHasErrors,
  setListPlan,
  validateSetList,
  type SetEntry,
  type SetList,
} from "../src/setlist";

function entry(partial: Partial<SetEntry> & { sortOrder: number; title: string }): SetEntry {
  return {
    id: `entry-${partial.sortOrder}`,
    setListId: "set-1",
    kind: "item",
    itemId: null,
    notes: null,
    ...partial,
  };
}

const MORNING: SetList = {
  id: "set-1",
  title: "Morning Service",
  date: "2026-10-04",
  updatedAt: null,
  entries: [
    entry({ sortOrder: 0, title: "Welcome", kind: "marker" }),
    entry({ sortOrder: 1, title: "Holy, Holy, Holy", itemId: "song-holy" }),
    entry({ sortOrder: 2, title: "Amazing Grace", itemId: "song-amazing-grace" }),
    entry({ sortOrder: 3, title: "Sermon", kind: "marker", notes: "Hand over at the end" }),
  ],
};

const kindOf = (itemId: string) =>
  itemId.startsWith("song-") ? ("song" as const) : ("presentation" as const);

describe("a set list", () => {
  it("starts empty, named by whoever types it, dated today", () => {
    const made = newSetList("set-2");
    expect(made.entries).toEqual([]);
    expect(made.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is presented in its own order, however it is held", () => {
    const shuffled: SetList = { ...MORNING, entries: [...MORNING.entries].reverse() };
    expect(orderedEntries(shuffled).map((one) => one.title)).toEqual([
      "Welcome",
      "Holy, Holy, Holy",
      "Amazing Grace",
      "Sermon",
    ]);
  });
});

describe("what it will not store", () => {
  it("refuses one with no name and no date anybody could read", () => {
    const codes = validateSetList({ ...MORNING, title: "  ", date: "next Sunday" }).map(
      (problem) => problem.code,
    );
    expect(codes).toContain("title.missing");
    expect(codes).toContain("date.invalid");
  });

  it("allows an empty one, because a church names Sunday before it fills it in", () => {
    const problems = validateSetList(newSetList("set-2", { title: "Morning Service" }));
    expect(setListHasErrors(problems)).toBe(false);
    expect(problems.map((one) => one.code)).toContain("entries.none");
  });

  it("refuses an entry that points at nothing", () => {
    const broken: SetList = {
      ...MORNING,
      entries: [entry({ sortOrder: 0, title: "A song", itemId: null })],
    };
    expect(setListHasErrors(validateSetList(broken))).toBe(true);
  });
});

describe("as the deck compiler takes it", () => {
  it("is the same shape a paired church's plan arrives as", () => {
    const plan = setListPlan(MORNING, kindOf);
    expect(plan.source).toBe("set_list");
    expect(plan.title).toBe("Morning Service");
    expect(plan.date).toBe("2026-10-04");
    expect(plan.items.map((item) => item.type)).toEqual([
      "marker",
      "song",
      "song",
      "marker",
    ]);
  });

  it("compiles to a deck of the songs it names", () => {
    const deck = compileDeck(setListPlan(MORNING, kindOf), lookupFrom([amazingGrace, holyHolyHoly]));
    expect(deck.problems).toEqual([]);
    expect(deck.groups.map((group) => group.title)).toEqual([
      "Welcome",
      "Holy, Holy, Holy",
      "Amazing Grace",
      "Sermon",
    ]);
    expect(deck.cues.length).toBeGreaterThan(4);
  });

  it("points at the library rather than copying it", () => {
    // The whole reason a library exists: a typo fixed in a hymn is fixed in
    // next Sunday's order as well.
    const fixed = {
      ...amazingGrace,
      sections: amazingGrace.sections.map((section, index) =>
        index === 0 ? { ...section, lines: ["A line somebody corrected"] } : section,
      ),
    };
    const deck = compileDeck(setListPlan(MORNING, kindOf), lookupFrom([fixed, holyHolyHoly]));
    expect(deck.cues.some((cue) => cue.lines?.[0] === "A line somebody corrected")).toBe(true);
  });

  it("reports an item that is no longer there, by the name the order calls it", () => {
    const deck = compileDeck(setListPlan(MORNING, kindOf), lookupFrom([holyHolyHoly]));
    expect(deck.problems.map((problem) => problem.code)).toContain("item.song.missing");
    expect(JSON.stringify(deck.problems)).toContain("Amazing Grace");
  });

  it("puts a marker's note where the operator reads it", () => {
    const plan = setListPlan(MORNING, kindOf);
    expect(plan.items[3]?.notes[0]?.body).toBe("Hand over at the end");
  });

  it("gives a marker nothing to put on the screen", () => {
    const deck = compileDeck(setListPlan(MORNING, kindOf), lookupFrom([amazingGrace, holyHolyHoly]));
    const welcome = deck.cues.find((cue) => cue.groupId === deck.groups[0]?.id);
    expect(welcome?.kind).toBe("marker");
    expect(welcome?.lines).toBeNull();
  });
});
