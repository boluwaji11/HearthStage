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
  aWeekAfter,
  duplicateSetList,
  newSetList,
  nextUp,
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

/**
 * STG-47, ST2.9. Last week's service, again.
 *
 * A church's order is mostly the same from one Sunday to the next, so the
 * fastest way to build next week's is to start from last week's and change two
 * things. The part worth defending is that last week's is untouched by it.
 */
describe("using last week's again", () => {
  it("carries the structure across", () => {
    const next = duplicateSetList(MORNING, "set-2");
    expect(next.entries.map((one) => one.title)).toEqual([
      "Welcome",
      "Holy, Holy, Holy",
      "Amazing Grace",
      "Sermon",
    ]);
    expect(next.entries.map((one) => one.itemId)).toEqual([
      null,
      "song-holy",
      "song-amazing-grace",
      null,
    ]);
  });

  it("keeps the name, because a church calls it the same thing every week", () => {
    expect(duplicateSetList(MORNING, "set-2").title).toBe("Morning Service");
  });

  it("moves the date on by a week, to the same weekday", () => {
    expect(duplicateSetList(MORNING, "set-2").date).toBe("2026-10-11");
    expect(aWeekAfter("2026-12-27")).toBe("2027-01-03");
    // Across the end of February, and across a daylight saving change.
    expect(aWeekAfter("2028-02-26")).toBe("2028-03-04");
    expect(aWeekAfter("2026-03-25")).toBe("2026-04-01");
  });

  it("leaves last week's exactly as it was", () => {
    const before = JSON.stringify(MORNING);
    duplicateSetList(MORNING, "set-2");
    expect(JSON.stringify(MORNING)).toBe(before);
  });

  it("gives every entry an identity of its own, so the two cannot collide", () => {
    const next = duplicateSetList(MORNING, "set-2");
    const ids = [...MORNING.entries, ...next.entries].map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(next.entries.every((one) => one.setListId === "set-2")).toBe(true);
  });

  it("is a service the store will take", () => {
    expect(setListHasErrors(validateSetList(duplicateSetList(MORNING, "set-2")))).toBe(false);
  });
});

/**
 * STG-48, ST12.5. Which plan a church is offered when Stage opens.
 *
 * A volunteer opens this at 09:40 on the morning of the service, so the one
 * they want is almost always the soonest one that has not happened.
 */
describe("the plan to open on", () => {
  const plans = [
    { id: "a", title: "Morning Service", date: "2026-10-04" },
    { id: "b", title: "Evening Service", date: "2026-10-04" },
    { id: "c", title: "Last week", date: "2026-09-27" },
    { id: "d", title: "Harvest", date: "2026-10-11" },
  ];

  it("offers the soonest one still ahead", () => {
    expect(nextUp(plans, "2026-09-29")?.id).toBe("b");
  });

  it("counts today as ahead, because that is the morning of the service", () => {
    expect(nextUp(plans, "2026-10-04")?.id).toBe("b");
  });

  it("breaks a tie on the title, so the order does not wander", () => {
    const one = nextUp(plans, "2026-10-01");
    const other = nextUp([...plans].reverse(), "2026-10-01");
    expect(one?.id).toBe(other?.id);
  });

  it("falls back to the most recent one behind", () => {
    expect(nextUp(plans, "2026-11-01")?.id).toBe("d");
  });

  it("offers nothing when there is nothing", () => {
    expect(nextUp([], "2026-10-04")).toBeNull();
  });
});
